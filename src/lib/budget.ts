import { getDaysInMonth, parseISO } from 'date-fns'
import type { Category, RecurringRule, Transaction } from './types'

// 앱의 핵심 계산 로직. 전부 순수 함수로 유지한다 (DB, UI 접근 금지).
// 금액은 전부 정수(원)로 계산하고, 나눗셈은 Math.floor로 내림한다.

const inMonth = (t: Transaction, month: string) => t.date.startsWith(month)

/** 이번 달 총수입. 날짜와 금액이 확정된 예정 수입도 포함한다. */
export function totalIncome(transactions: Transaction[], month: string): number {
  return transactions
    .filter((t) => inMonth(t, month) && t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
}

/**
 * 이미 발생한 지출: 오늘 이전 날짜(오늘 제외)의 지출 합계.
 * 오늘 예산은 아침에 정해지는 기준선이므로 오늘 당일의 지출은 여기 넣지 않는다.
 * (당일 지출은 '남은 금액'에서 차감된다)
 */
export function occurredExpense(transactions: Transaction[], today: string): number {
  const month = today.slice(0, 7)
  return transactions
    .filter((t) => inMonth(t, month) && t.type === 'expense' && t.date < today)
    .reduce((sum, t) => sum + t.amount, 0)
}

/** 남은 기간의 예정 지출: 오늘 이후 날짜에 잡힌 지출 (구독료, 계획 소비, 상환 등) */
export function upcomingExpense(transactions: Transaction[], today: string): number {
  const month = today.slice(0, 7)
  return transactions
    .filter((t) => inMonth(t, month) && t.type === 'expense' && t.date > today)
    .reduce((sum, t) => sum + t.amount, 0)
}

/** 이번 달 가용액 = 총수입 - 이미 발생한 지출 */
export function availableAmount(transactions: Transaction[], today: string): number {
  return totalIncome(transactions, today.slice(0, 7)) - occurredExpense(transactions, today)
}

/** 오늘 포함, 이번 달 마지막 날까지 남은 일수 */
export function remainingDays(today: string): number {
  const date = parseISO(today)
  return getDaysInMonth(date) - date.getDate() + 1
}

/**
 * 오늘 예산 = (가용액 - 남은 기간의 예정 지출 - 예비비) / 남은 일수 (내림)
 * 하루에 한 번, 날짜가 바뀔 때만 계산해서 저장해두고 그날 안에는 다시 계산하지 않는다.
 */
export function calcTodayBudget(
  transactions: Transaction[],
  today: string,
  reserveAmount: number,
): number {
  const base = availableAmount(transactions, today) - upcomingExpense(transactions, today) - reserveAmount
  return Math.floor(base / remainingDays(today))
}

/** 특정 날짜의 지출 합계 */
export function spentOnDate(transactions: Transaction[], date: string): number {
  return transactions
    .filter((t) => t.date === date && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
}

/** 남은 금액 = 오늘 예산 - 오늘 이미 쓴 금액. 음수가 될 수 있다. */
export function remainingToday(todayBudget: number, todaySpent: number): number {
  return todayBudget - todaySpent
}

/** 이번 달 카테고리별 지출 합계 (categoryId -> 금액) */
export function spentByCategory(transactions: Transaction[], month: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (inMonth(t, month) && t.type === 'expense' && t.categoryId) {
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
    }
  }
  return map
}

/** 항목별 진행률(%). 예산 미설정(0)이면 0을 돌려준다. */
export function categoryProgress(spent: number, monthlyBudget: number): number {
  if (monthlyBudget <= 0) return 0
  return Math.round((spent / monthlyBudget) * 100)
}

/**
 * 반복 규칙이 해당 월에 발생하는 날짜.
 * dayOfMonth가 그 달의 마지막 날보다 크면 마지막 날로 보정한다 (예: 31일 규칙 → 9월 30일).
 * 시작일 이전이거나 종료일 이후면 null.
 */
export function occurrenceDate(
  rule: Pick<RecurringRule, 'dayOfMonth' | 'startDate' | 'endDate'>,
  month: string,
): string | null {
  const [year, monthNum] = month.split('-').map(Number)
  const lastDay = getDaysInMonth(new Date(year, monthNum - 1, 1))
  const day = Math.min(rule.dayOfMonth, lastDay)
  const date = `${month}-${String(day).padStart(2, '0')}`
  if (date < rule.startDate) return null
  if (rule.endDate && date > rule.endDate) return null
  return date
}

/**
 * 자유 예산 (앱 가이드 §8 검산 기준)
 * = 총수입 - 고정비 카테고리의 월 예산 합 - 고정비 카테고리 밖의 지출(미분류 포함)
 * 고정비 카테고리 안의 실제 지출은 예산으로 이미 떼어두었으므로 이중으로 빼지 않는다.
 */
export function freeBudget(
  transactions: Transaction[],
  categories: Category[],
  month: string,
): number {
  const fixedIds = new Set(categories.filter((c) => c.isFixed).map((c) => c.id))
  const fixedBudgets = categories
    .filter((c) => c.isFixed)
    .reduce((sum, c) => sum + c.monthlyBudget, 0)
  const nonFixedExpense = transactions
    .filter((t) => inMonth(t, month) && t.type === 'expense' && (!t.categoryId || !fixedIds.has(t.categoryId)))
    .reduce((sum, t) => sum + t.amount, 0)
  return totalIncome(transactions, month) - fixedBudgets - nonFixedExpense
}
