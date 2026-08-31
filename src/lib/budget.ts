import { getDaysInMonth, parseISO } from 'date-fns'
import type { BudgetRule, Category, Frequency, RecurringRule, Transaction } from './types'

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

// --- 카테고리 예산 계산 도구 ---

/** 그 달의 일수를 7로 나눈 값. 정수가 아니다 (9월 = 30/7 = 4.285…) */
export function weeksInMonth(month: string): number {
  const [year, monthNum] = month.split('-').map(Number)
  return getDaysInMonth(new Date(year, monthNum - 1, 1)) / 7
}

/**
 * 그 달에 해당 요일들이 며칠 있는지 센다 (0=일 … 6=토).
 * 달마다 다르다: 2026년 9월은 1일이 화요일이라 화·수만 5번이고 나머지 요일은 4번이다.
 */
export function weekdayCountInMonth(weekdays: number[], month: string): number {
  if (weekdays.length === 0) return 0
  const [year, monthNum] = month.split('-').map(Number)
  const lastDay = getDaysInMonth(new Date(year, monthNum - 1, 1))
  const wanted = new Set(weekdays)
  let count = 0
  for (let day = 1; day <= lastDay; day++) {
    if (wanted.has(new Date(year, monthNum - 1, day).getDay())) count++
  }
  return count
}

/** 주기가 그 달에 만드는 총 횟수. perWeek는 근사라 소수가 나올 수 있다. */
export function monthlyOccurrences(freq: Frequency, month: string): number {
  return freq.mode === 'perWeek'
    ? freq.timesPerWeek * weeksInMonth(month)
    : freq.timesPerDay * weekdayCountInMonth(freq.weekdays, month)
}

/**
 * 이 카테고리에 걸린, 이번 달에 살아있는 반복 지출.
 * 발생일(occurrenceDate)이 아니라 규칙이 이 달에 걸쳐 있는지로 판단한다.
 * 이번 달 중간에 시작한 구독도 다음 달부터는 온전히 나가므로 예산에는 넣어야 한다.
 */
export function activeRecurringForCategory(
  rules: RecurringRule[],
  categoryId: string,
  month: string,
): RecurringRule[] {
  const [year, monthNum] = month.split('-').map(Number)
  const firstDay = `${month}-01`
  const lastDay = `${month}-${String(getDaysInMonth(new Date(year, monthNum - 1, 1))).padStart(2, '0')}`
  return rules.filter(
    (r) =>
      r.type === 'expense' &&
      r.categoryId === categoryId &&
      r.startDate <= lastDay &&
      (!r.endDate || r.endDate >= firstDay),
  )
}

/** 위 목록의 합계. 화면에 보이는 목록과 금액이 어긋나지 않도록 같은 함수를 쓴다. */
export function recurringSumForCategory(
  rules: RecurringRule[],
  categoryId: string,
  month: string,
): number {
  return activeRecurringForCategory(rules, categoryId, month).reduce((sum, r) => sum + r.amount, 0)
}

/**
 * 계산 방법 -> 이번 달 월 예산. 직접 입력이면 계산할 게 없으므로 null.
 *
 * 횟수를 먼저 반올림해서 금액이 항상 한 번 단가의 배수로 떨어지게 한다.
 * 한 번에 5,000원이면 40,000원·45,000원처럼 나오지, 42,857원 같은 어중간한 값이 나오지 않는다.
 * recurringSum은 DB를 봐야 하므로 합계를 밖에서 구해 넘긴다 (이 파일은 순수 함수만 둔다).
 */
export function budgetFromRule(rule: BudgetRule, month: string, recurringSum: number): number | null {
  switch (rule.kind) {
    case 'manual':
      return null
    case 'perUse':
      return rule.unitAmount * Math.round(monthlyOccurrences(rule.freq, month))
    case 'commute':
      // 교통은 하루치(편도 또는 왕복)가 한 번 단가다.
      return rule.fare * (rule.roundTrip ? 2 : 1) * Math.round(monthlyOccurrences(rule.freq, month))
    case 'recurringSum':
      return recurringSum
  }
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
