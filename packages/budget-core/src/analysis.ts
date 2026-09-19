import { getDaysInMonth } from 'date-fns'
import { budgetFromRule, categoryBudgetPeriods, recurringSumForCategory } from './budget.ts'
import type { Category, RecurringRule, Transaction } from './types'

// 달력 밑 월 분석에 쓰는 집계. budget.ts와 같이 순수 함수만 둔다 (DB, UI 접근 금지).
//
// 분석의 「지출」은 실제로 나간 돈이다. 예정 지출은 아직 안 나갔으니 따로 센다.
// 위시 구매·예비비 지출은 자유비용 계산에서는 빠지지만 여기서는 쓴 돈이라 넣는다.

const inMonth = (t: Transaction, month: string) => t.date.startsWith(month)

/** 그 달에 실제로 나간 지출 */
const actualExpenses = (transactions: Transaction[], month: string) =>
  transactions.filter((t) => inMonth(t, month) && t.type === 'expense' && !t.isPlanned)

const sum = (transactions: Transaction[]) => transactions.reduce((total, t) => total + t.amount, 0)

/**
 * 그 달에서 지금까지 지난 날 수. 지난 달은 말일까지, 이번 달은 오늘까지, 앞으로 올 달은 0.
 * 무지출일처럼 「며칠 중에」를 세는 분석이 아직 안 온 날을 넣지 않게 한다.
 */
export function elapsedDays(month: string, today: string): number {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = getDaysInMonth(new Date(year, monthNumber - 1, 1))
  const thisMonth = today.slice(0, 7)
  if (month < thisMonth) return lastDay
  if (month > thisMonth) return 0
  return Number(today.slice(8, 10))
}

export interface MonthSummary {
  spent: number
  income: number
  /** 아직 안 나간 예정 지출 */
  plannedSpent: number
  /** 아직 안 들어온 예정 수입 */
  plannedIncome: number
  /** 지나간 날 중 실제 지출이 한 건도 없는 날 */
  noSpendDays: number
  /** 무지출일을 센 날 수 */
  elapsedDays: number
}

export function monthSummary(transactions: Transaction[], month: string, today: string): MonthSummary {
  const monthTx = transactions.filter((t) => inMonth(t, month))
  const expenses = actualExpenses(transactions, month)
  const days = elapsedDays(month, today)
  const spentDays = new Set(expenses.map((t) => t.date))
  let noSpendDays = 0
  for (let day = 1; day <= days; day++) {
    if (!spentDays.has(`${month}-${String(day).padStart(2, '0')}`)) noSpendDays++
  }
  return {
    spent: sum(expenses),
    income: sum(monthTx.filter((t) => t.type === 'income' && !t.isPlanned)),
    plannedSpent: sum(monthTx.filter((t) => t.type === 'expense' && t.isPlanned)),
    plannedIncome: sum(monthTx.filter((t) => t.type === 'income' && t.isPlanned)),
    noSpendDays,
    elapsedDays: days,
  }
}

/** 카테고리 줄의 id. 카테고리 외에 예비비 지출과 미분류(지운 카테고리 포함)가 따로 한 줄씩이다 */
export type BreakdownKey = string | 'reserve' | 'none'

export interface CategorySpending {
  key: BreakdownKey
  /** 실제 카테고리면 그 카테고리. 예비비·미분류는 null */
  category: Category | null
  spent: number
  /** 그 달 전체 지출에서 차지하는 비율(%). 반올림이라 합이 100이 아닐 수 있다 */
  share: number
  /** 그 달 예산. 예산 미설정이거나 예비비·미분류면 null */
  budget: number | null
  /**
   * 직접 입력 예산이라 그 달 값이 아니라 지금 값인지.
   * 예산 이력은 저장하지 않는다 — 계산식 카테고리만 그 달 기준으로 다시 계산할 수 있다.
   */
  budgetIsCurrent: boolean
}

/** 그 달 카테고리 예산. 계산식이면 그 달 요일 수·반복 거래로 다시 계산한다 */
function budgetForMonth(category: Category, month: string, rules: RecurringRule[]): { budget: number | null; isCurrent: boolean } {
  const rule = category.budgetRule
  const computed = rule
    ? budgetFromRule(rule, month, recurringSumForCategory(rules, category.id, month))
    : null
  const budget = computed ?? category.monthlyBudget
  return { budget: budget > 0 ? budget : null, isCurrent: computed === null }
}

/**
 * 카테고리별 실제 지출. 쓴 돈이 있는 줄만, 많이 쓴 순서로 준다.
 * 예비비에서 쓴 지출은 카테고리와 무관하게 예비비 줄로, 없는 카테고리는 미분류로 모은다.
 */
export function categorySpending(
  transactions: Transaction[],
  categories: Category[],
  month: string,
  rules: RecurringRule[] = [],
): CategorySpending[] {
  const expenses = actualExpenses(transactions, month)
  const total = sum(expenses)
  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const spentByKey = new Map<BreakdownKey, number>()
  for (const t of expenses) {
    const key: BreakdownKey = t.fromReserve
      ? 'reserve'
      : t.categoryId && categoriesById.has(t.categoryId) ? t.categoryId : 'none'
    spentByKey.set(key, (spentByKey.get(key) ?? 0) + t.amount)
  }
  return [...spentByKey.entries()]
    .map(([key, spent]) => {
      const category = categoriesById.get(key) ?? null
      const { budget, isCurrent } = category ? budgetForMonth(category, month, rules) : { budget: null, isCurrent: false }
      return {
        key,
        category,
        spent,
        share: total > 0 ? Math.round((spent / total) * 100) : 0,
        budget,
        budgetIsCurrent: budget !== null && isCurrent,
      }
    })
    .sort((a, b) => b.spent - a.spent)
}

/** 지난달 대비 줄마다 늘어난 금액(음수면 줄어듦). 지난달에 없던 줄은 지난달 0원으로 본다 */
export function spendingChange(current: CategorySpending[], previous: CategorySpending[]): Map<BreakdownKey, number> {
  const before = new Map(previous.map((row) => [row.key, row.spent]))
  return new Map(current.map((row) => [row.key, row.spent - (before.get(row.key) ?? 0)]))
}

export interface UsageCompliance {
  category: Category
  scope: 'week' | 'day'
  /** 끝난 기간 수. 진행 중인 기간은 아직 결과가 없어 넣지 않는다 */
  periods: number
  /** 그중 몫 안에서 쓴 기간 */
  kept: number
  /** 몫을 넘긴 기간 */
  over: number
  /** 끝난 기간의 미사용액 합계 — 자유비용으로 돌아간 돈 (releasedLeftovers와 같은 값) */
  leftover: number
  /** 끝난 기간에서 몫을 넘긴 금액 합계 */
  overAmount: number
}

/**
 * 횟수·교통 카테고리가 일/주 몫을 얼마나 지켰는지.
 * 기간과 몫은 자유비용 계산과 같은 `categoryBudgetPeriods`를 쓴다.
 * 끝난 기간만 센다 — 오늘이 속한 기간은 아직 끝나지 않았다.
 */
export function usageCompliance(
  categories: Category[],
  transactions: Transaction[],
  month: string,
  today: string,
): UsageCompliance[] {
  const rows: UsageCompliance[] = []
  for (const category of categories) {
    // 예산이 0이면 모든 기간 몫이 0원이라 쓰기만 하면 초과로 잡힌다 — 지킬 한도가 없는 셈이다
    if (category.monthlyBudget <= 0) continue
    const periods = categoryBudgetPeriods(category, month).filter((period) => period.to < today)
    if (periods.length === 0) continue
    // 몫 차감 기준은 releasedLeftovers와 같다 — 위시 구매만 뺀다
    const expenses = transactions.filter(
      (t) => t.type === 'expense' && !t.excludedFromFreeAmount && t.categoryId === category.id,
    )
    const row: UsageCompliance = { category, scope: periods[0].scope, periods: periods.length, kept: 0, over: 0, leftover: 0, overAmount: 0 }
    for (const period of periods) {
      const spent = sum(expenses.filter((t) => t.date >= period.from && t.date <= period.to))
      const difference = period.allowance - spent
      if (difference >= 0) {
        row.kept++
        row.leftover += difference
      } else {
        row.over++
        row.overAmount -= difference
      }
    }
    rows.push(row)
  }
  return rows
}

/** 금액이 큰 실제 지출. 같은 금액이면 먼저 쓴 것부터 */
export function topExpenses(transactions: Transaction[], month: string, limit = 5): Transaction[] {
  return [...actualExpenses(transactions, month)]
    .sort((a, b) => b.amount - a.amount || a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .slice(0, limit)
}

export interface MemoSpending {
  memo: string
  count: number
  total: number
}

/**
 * 자주 쓴 메모(가게·항목). 앞뒤 공백을 빼고 같은 글자면 한 곳으로 본다.
 * 두 번 이상 나온 메모만 준다 — 한 번은 「자주」가 아니다. 횟수 많은 순, 같으면 금액 큰 순
 */
export function topMemos(transactions: Transaction[], month: string, limit = 5): MemoSpending[] {
  const byMemo = new Map<string, MemoSpending>()
  for (const t of actualExpenses(transactions, month)) {
    const memo = t.memo.trim()
    if (!memo) continue
    const row = byMemo.get(memo) ?? { memo, count: 0, total: 0 }
    row.count++
    row.total += t.amount
    byMemo.set(memo, row)
  }
  return [...byMemo.values()]
    .filter((row) => row.count >= 2)
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, limit)
}

/** 고정비는 고정비로 표시한 카테고리의 지출이거나 반복 거래가 만든 지출. 나머지는 변동비 */
export function fixedVsVariable(
  transactions: Transaction[],
  categories: Category[],
  month: string,
): { fixed: number; variable: number } {
  const fixedIds = new Set(categories.filter((category) => category.isFixed).map((category) => category.id))
  let fixed = 0
  let variable = 0
  for (const t of actualExpenses(transactions, month)) {
    if (t.recurringRuleId || (t.categoryId && fixedIds.has(t.categoryId))) fixed += t.amount
    else variable += t.amount
  }
  return { fixed, variable }
}
