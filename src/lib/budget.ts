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
 * 홈에서 이 카테고리 구슬을 한 번 눌렀을 때 기록할 금액. 퀵 슬롯 대상이 아니면 null.
 * 교통은 왕복 설정과 무관하게 편도 요금이다. 한 번 탈 때마다 한 번 누르는 게 기준이라
 * 왕복이면 두 번 누른다 (예산 계산에서 하루치를 왕복으로 잡는 것과는 다른 이야기).
 */
export function quickAddAmount(rule: BudgetRule | undefined): number | null {
  if (!rule) return null
  if (rule.kind === 'perUse') return rule.unitAmount
  if (rule.kind === 'commute') return rule.fare
  return null
}

/**
 * 이 카테고리가 퀵 슬롯 구슬에 뜨는지.
 * 설정을 한 번도 안 건드렸으면 단가가 있는 카테고리(횟수·교통)만 기본으로 뜬다.
 * 직접 넣은 카테고리는 단가가 없어서 구슬을 눌러도 금액은 직접 입력해야 한다.
 */
export function inQuickSlot(category: Category): boolean {
  return category.quickSlot ?? quickAddAmount(category.budgetRule) !== null
}

/** 그 날짜의 요일 (0=일 … 6=토) */
const weekdayOf = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

/**
 * 이 카테고리가 그 날 쓸 수 있는 몫. 횟수·교통이 아니면 null (자유에 섞인다).
 *
 * 요일을 지정했으면 그 날 실제로 나가는 돈이라 해당 요일이 아닌 날은 0이고,
 * 주 단위 한도면 요일을 모르니 7로 나눈 평균을 쓴다.
 * 교통의 하루치는 왕복을 반영한다 (구슬을 한 번 눌렀을 때의 편도와는 다르다).
 */
export function dailyAllowance(rule: BudgetRule, date: string): number | null {
  if (rule.kind !== 'perUse' && rule.kind !== 'commute') return null
  const unit = rule.kind === 'perUse' ? rule.unitAmount : rule.fare * (rule.roundTrip ? 2 : 1)
  const freq = rule.freq
  if (freq.mode === 'perWeek') return Math.floor((unit * freq.timesPerWeek) / 7)
  return freq.weekdays.includes(weekdayOf(date)) ? unit * freq.timesPerDay : 0
}

/**
 * 화면에 보여줄 예산과 그 기간. 한도가 주 단위면 예산도 주 단위다.
 * 카페가 한 번에 5,000원 주 2회면 이번 주 10,000원이고, 주가 바뀌면 다시 채워진다.
 * (자유 몫을 구할 때만 dailyAllowance로 하루치 환산을 쓴다)
 */
export function periodAllowance(
  rule: BudgetRule,
  date: string,
): { scope: 'week' | 'day'; amount: number } | null {
  if (rule.kind !== 'perUse' && rule.kind !== 'commute') return null
  const unit = rule.kind === 'perUse' ? rule.unitAmount : rule.fare * (rule.roundTrip ? 2 : 1)
  const freq = rule.freq
  if (freq.mode === 'perWeek') return { scope: 'week', amount: unit * freq.timesPerWeek }
  return {
    scope: 'day',
    amount: freq.weekdays.includes(weekdayOf(date)) ? unit * freq.timesPerDay : 0,
  }
}

/**
 * 그 날 기준 횟수 한도. 주 단위 한도면 주간 횟수를, 요일 지정이면 그 날 횟수를 센다.
 * active가 false면 오늘은 쓰기로 한 요일이 아니다.
 *
 * 교통에서 왕복이면 한도를 두 배로 센다. 하루 몫은 왕복 한 번이지만 실제로 타는 건
 * 편도 두 번이고, 퀵 슬롯 구슬도 편도마다 한 번씩 누르기 때문이다 (왕복 = 오늘 2/2회).
 */
export function usageLimit(
  rule: BudgetRule,
  date: string,
): { scope: 'week' | 'day'; limit: number; active: boolean } | null {
  if (rule.kind !== 'perUse' && rule.kind !== 'commute') return null
  const perTime = rule.kind === 'commute' && rule.roundTrip ? 2 : 1
  const freq = rule.freq
  if (freq.mode === 'perWeek') {
    return { scope: 'week', limit: freq.timesPerWeek * perTime, active: true }
  }
  return {
    scope: 'day',
    limit: freq.timesPerDay * perTime,
    active: freq.weekdays.includes(weekdayOf(date)),
  }
}

/** 기간(양끝 포함) 안에서 이 카테고리에 지출한 건수 */
export function countExpenses(
  transactions: Transaction[],
  categoryId: string,
  from: string,
  to: string,
): number {
  return transactions.filter(
    (t) => t.type === 'expense' && t.categoryId === categoryId && t.date >= from && t.date <= to,
  ).length
}

/** 홈 히어로 목록의 한 줄. categoryId가 null이면 '자유' */
export interface BreakdownRow {
  categoryId: string | null
  scope: 'week' | 'day'
  allowance: number
  spent: number
  remaining: number
  limit: number | null
  used: number
  active: boolean
}

/**
 * 홈 히어로 목록을 만든다. 줄마다 자기 기간을 쓴다 —
 * 주 단위 한도면 이번 주 예산에서 이번 주 지출을, 요일 지정이면 오늘 몫에서 오늘 지출을 뺀다.
 *
 * 자유는 하루짜리다. 오늘 예산에서 보이는 카테고리들의 '하루 환산' 몫을 빼둔 값이라
 * 주 단위 카테고리가 있어도 매일 일정하다. 숨긴 카테고리는 몫을 떼지 않으므로
 * 그 지출이 자유에서 빠진다.
 */
export function buildBreakdown(
  categories: Category[],
  todayTx: Transaction[],
  weekTx: Transaction[],
  todayBudget: number,
  today: string,
  weekStart: string,
  weekEnd: string,
): BreakdownRow[] {
  const rows: BreakdownRow[] = []
  const shown = new Set<string>()
  let dailyReserved = 0

  for (const category of categories) {
    if (category.hiddenOnHome || !category.budgetRule) continue
    const period = periodAllowance(category.budgetRule, today)
    const limit = usageLimit(category.budgetRule, today)
    if (!period || !limit) continue
    const weekly = period.scope === 'week'
    const source = weekly ? weekTx : todayTx
    const from = weekly ? weekStart : today
    const to = weekly ? weekEnd : today
    const spent = source
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.categoryId === category.id &&
          t.date >= from &&
          t.date <= to,
      )
      .reduce((sum, t) => sum + t.amount, 0)
    rows.push({
      categoryId: category.id,
      scope: period.scope,
      allowance: period.amount,
      spent,
      remaining: period.amount - spent,
      limit: limit.limit,
      used: countExpenses(source, category.id, from, to),
      active: limit.active,
    })
    dailyReserved += dailyAllowance(category.budgetRule, today) ?? 0
    shown.add(category.id)
  }

  const freeAllowance = todayBudget - dailyReserved
  const freeSpent = todayTx
    .filter((t) => t.type === 'expense' && (!t.categoryId || !shown.has(t.categoryId)))
    .reduce((sum, t) => sum + t.amount, 0)
  rows.push({
    categoryId: null,
    scope: 'day',
    allowance: freeAllowance,
    spent: freeSpent,
    remaining: freeAllowance - freeSpent,
    limit: null,
    used: 0,
    active: true,
  })
  return rows
}

/** 히어로 큰 숫자 = 화면에 뜬 줄들의 합 */
export function breakdownTotal(rows: BreakdownRow[]): number {
  return rows.reduce((sum, r) => sum + r.remaining, 0)
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
