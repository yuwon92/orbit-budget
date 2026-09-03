import { budgetFromRule, occurrenceDates, recurringSumForCategory } from './budget'
import { db } from './db'

/**
 * 앱을 열 때 호출. 이번 달 반복 규칙을 확인해서 아직 생성되지 않은 예정 거래를 만든다.
 * 월 단위는 한 달에 한 건, 주 단위는 그 달의 해당 요일마다 한 건씩 만든다.
 * 트랜잭션으로 감싸서 동시에 두 번 호출돼도 중복 생성되지 않는다.
 */
export async function materializeRecurring(today: string): Promise<void> {
  const month = today.slice(0, 7)
  await db.transaction('rw', db.recurringRules, db.transactions, async () => {
    // 예정 여부는 생성 당시 값에 머물 수 있으므로, 날짜가 오면 실제 발생 거래로 확정한다.
    await db.transactions.where('date').belowOrEqual(today).modify({ isPlanned: false })
    const rules = await db.recurringRules.toArray()
    const monthTx = await db.transactions.where('date').startsWith(month).toArray()
    for (const rule of rules) {
      if (rule.lastGeneratedMonth && rule.lastGeneratedMonth >= month) continue
      // 규칙을 고쳐 다시 만들 때, 이미 지나간 발생분까지 겹쳐 만들지 않도록 날짜로 거른다.
      const made = new Set(monthTx.filter((t) => t.recurringRuleId === rule.id).map((t) => t.date))
      for (const date of occurrenceDates(rule, month)) {
        if (made.has(date)) continue
        await db.transactions.add({
          id: crypto.randomUUID(),
          date,
          amount: rule.amount,
          type: rule.type,
          categoryId: rule.categoryId,
          memo: rule.name,
          // 날짜가 아직 안 왔으면 예정, 이미 지났거나 오늘이면 발생한 것으로 본다.
          isPlanned: date > today,
          createdAt: Date.now(),
          recurringRuleId: rule.id,
        })
      }
      await db.recurringRules.update(rule.id, { lastGeneratedMonth: month })
    }
  })
}

/**
 * 규칙을 수정한 뒤 호출. 이번 달의 아직 안 지난 예정 거래를 지우고 새 값으로 다시 만든다.
 * 이미 발생한(날짜가 지난) 거래는 건드리지 않는다 — 남은 날짜만 새 값으로 다시 선다.
 * 되돌린 뒤 다시 만드는 쪽(materializeRecurring)이 남아있는 날짜를 건너뛰므로 중복은 안 생긴다.
 */
export async function resyncRuleForMonth(ruleId: string, today: string): Promise<void> {
  const month = today.slice(0, 7)
  await db.transaction('rw', db.recurringRules, db.transactions, async () => {
    const monthTx = await db.transactions.where('date').startsWith(month).toArray()
    const stillPlanned = monthTx.filter((t) => t.recurringRuleId === ruleId && t.isPlanned && t.date > today)
    await db.transactions.bulkDelete(stillPlanned.map((t) => t.id))
    await db.recurringRules.update(ruleId, { lastGeneratedMonth: null })
  })
  await materializeRecurring(today)
}

/**
 * 계산 방법이 걸린 카테고리의 월 예산을 이번 달 기준으로 다시 계산해서 저장한다.
 * 앱을 열 때(달이 바뀌면 요일 수가 달라진다)와 반복 거래를 고친 뒤에 부른다.
 * 직접 입력(manual, 또는 방법이 없는 예전 카테고리)은 건드리지 않는다.
 */
export async function syncRuleBudgets(month: string): Promise<void> {
  await db.transaction('rw', db.categories, db.recurringRules, async () => {
    const [categories, rules] = await Promise.all([
      db.categories.toArray(),
      db.recurringRules.toArray(),
    ])
    for (const category of categories) {
      const rule = category.budgetRule
      if (!rule || rule.kind === 'manual') continue
      const next = budgetFromRule(rule, month, recurringSumForCategory(rules, category.id, month))
      if (next !== null && next !== category.monthlyBudget) {
        await db.categories.update(category.id, { monthlyBudget: next })
      }
    }
  })
}

/** 규칙 삭제. 이번 달의 아직 안 지난 예정 거래도 함께 지운다. */
export async function deleteRule(ruleId: string, today: string): Promise<void> {
  const month = today.slice(0, 7)
  await db.transaction('rw', db.recurringRules, db.transactions, async () => {
    const monthTx = await db.transactions.where('date').startsWith(month).toArray()
    const stillPlanned = monthTx.filter((t) => t.recurringRuleId === ruleId && t.isPlanned && t.date > today)
    await db.transactions.bulkDelete(stillPlanned.map((t) => t.id))
    await db.recurringRules.delete(ruleId)
  })
}
