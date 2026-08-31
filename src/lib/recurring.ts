import { budgetFromRule, occurrenceDate, recurringSumForCategory } from './budget'
import { db } from './db'

/**
 * 앱을 열 때 호출. 이번 달 반복 규칙을 확인해서 아직 생성되지 않은 예정 거래를 만든다.
 * 트랜잭션으로 감싸서 동시에 두 번 호출돼도 중복 생성되지 않는다.
 */
export async function materializeRecurring(today: string): Promise<void> {
  const month = today.slice(0, 7)
  await db.transaction('rw', db.recurringRules, db.transactions, async () => {
    const rules = await db.recurringRules.toArray()
    for (const rule of rules) {
      if (rule.lastGeneratedMonth && rule.lastGeneratedMonth >= month) continue
      const date = occurrenceDate(rule, month)
      if (date) {
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
 * 이미 발생한(날짜가 지난) 거래는 건드리지 않는다.
 */
export async function resyncRuleForMonth(ruleId: string, today: string): Promise<void> {
  const month = today.slice(0, 7)
  await db.transaction('rw', db.recurringRules, db.transactions, async () => {
    const monthTx = await db.transactions.where('date').startsWith(month).toArray()
    const generated = monthTx.filter((t) => t.recurringRuleId === ruleId)
    const stillPlanned = generated.filter((t) => t.isPlanned && t.date > today)
    await db.transactions.bulkDelete(stillPlanned.map((t) => t.id))
    // 이번 달 발생분이 남아있지 않을 때만 다시 생성 대상으로 되돌린다.
    if (generated.length === stillPlanned.length) {
      await db.recurringRules.update(ruleId, { lastGeneratedMonth: null })
    }
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
