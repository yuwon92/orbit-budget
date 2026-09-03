import { getDaysInMonth } from 'date-fns'
import type { BudgetRule, Category, Frequency, RecurringRule, Transaction } from './types'

// 앱의 핵심 계산 로직. 전부 순수 함수로 유지한다 (DB, UI 접근 금지).
// 금액은 전부 정수(원)로 계산하고, 나눗셈은 Math.floor로 내림한다.

const inMonth = (t: Transaction, month: string) => t.date.startsWith(month)

/** 발생일 계산에 필요한 규칙 조각. 저장 전 폼 값으로도 계산할 수 있게 최소한만 받는다. */
type OccurrenceRule = Pick<RecurringRule, 'interval' | 'dayOfMonth' | 'weekdays' | 'startDate' | 'endDate'>

/** 그 날짜의 요일 (0=일 … 6=토) */
const weekdayOf = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

/** 이번 달 총수입. 날짜와 금액이 확정된 예정 수입도 포함한다. */
export function totalIncome(transactions: Transaction[], month: string): number {
  return transactions
    .filter((t) => inMonth(t, month) && t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
}

interface BudgetPeriod {
  scope: 'week' | 'day'
  from: string
  to: string
  allowance: number
}

const dateInMonth = (month: string, day: number) => `${month}-${String(day).padStart(2, '0')}`

/**
 * 횟수·교통 카테고리의 월 예산을 실제 일/달력 주 기간에 배분한다.
 * 달을 걸치는 주는 월 경계에서 자르고, 앞 기간부터 채워 월 예산 총액을 절대 넘지 않는다.
 */
function categoryBudgetPeriods(category: Category, month: string): BudgetPeriod[] {
  const rule = category.budgetRule
  if (!rule || (rule.kind !== 'perUse' && rule.kind !== 'commute')) return []

  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = getDaysInMonth(new Date(year, monthNumber - 1, 1))
  const unit = rule.kind === 'perUse' ? rule.unitAmount : rule.fare * (rule.roundTrip ? 2 : 1)
  let remainingBudget = Math.max(category.monthlyBudget, 0)
  const periods: BudgetPeriod[] = []

  if (rule.freq.mode === 'weekdays') {
    for (let day = 1; day <= lastDay; day++) {
      const date = dateInMonth(month, day)
      if (!rule.freq.weekdays.includes(weekdayOf(date))) continue
      const allowance = Math.min(unit * rule.freq.timesPerDay, remainingBudget)
      periods.push({ scope: 'day', from: date, to: date, allowance })
      remainingBudget -= allowance
    }
    return periods
  }

  for (let day = 1; day <= lastDay;) {
    const from = dateInMonth(month, day)
    const daysUntilSaturday = 6 - weekdayOf(from)
    const endDay = Math.min(day + daysUntilSaturday, lastDay)
    const allowance = Math.min(unit * rule.freq.timesPerWeek, remainingBudget)
    periods.push({ scope: 'week', from, to: dateInMonth(month, endDay), allowance })
    remainingBudget -= allowance
    day = endDay + 1
  }
  return periods
}

function currentBudgetPeriod(category: Category, today: string): BudgetPeriod | null {
  const periods = categoryBudgetPeriods(category, today.slice(0, 7))
  const current = periods.find((period) => period.from <= today && period.to >= today)
  if (current) return current

  const rule = category.budgetRule
  if (!rule || (rule.kind !== 'perUse' && rule.kind !== 'commute')) return null
  // 요일 지정 카테고리에서 오늘이 사용 예정일이 아니면 0원짜리 오늘 행을 보여준다.
  return rule.freq.mode === 'weekdays'
    ? { scope: 'day', from: today, to: today, allowance: 0 }
    : null
}

/**
 * 현재 남은 자유비용.
 *
 * 월수입에서 모든 카테고리 월 예산과 예비비를 먼저 확보한다. 예산 밖 지출과 기간별
 * 초과분은 실제·예정 여부와 관계없이 즉시 차감한다. 끝난 일/주 기간의 미사용액만
 * 자유비용에 돌려주며, 진행 중이거나 미래인 기간의 잔액은 계속 카테고리에 남겨둔다.
 */
export function monthlyFreeAmount(
  transactions: Transaction[],
  categories: Category[],
  today: string,
  reserveAmount: number,
): number {
  const month = today.slice(0, 7)
  const totalBudget = categories.reduce((sum, category) => sum + Math.max(category.monthlyBudget, 0), 0)
  const expenses = transactions.filter((transaction) => inMonth(transaction, month) && transaction.type === 'expense')
  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  let adjustment = 0

  // 카테고리가 없거나 예산이 없는 거래는 실제·예정 모두 자유비용에서 전액 나간다.
  adjustment -= expenses
    .filter((transaction) => !transaction.categoryId || !categoriesById.has(transaction.categoryId))
    .reduce((sum, transaction) => sum + transaction.amount, 0)

  for (const category of categories) {
    const categoryExpenses = expenses.filter((transaction) => transaction.categoryId === category.id)
    const periods = categoryBudgetPeriods(category, month)

    if (periods.length === 0) {
      // 직접 입력·구독 합계는 월 전체가 한 기간이다. 초과분만 즉시 자유비용에서 차감한다.
      const spentOrPlanned = categoryExpenses.reduce((sum, transaction) => sum + transaction.amount, 0)
      adjustment -= Math.max(spentOrPlanned - Math.max(category.monthlyBudget, 0), 0)
      continue
    }

    for (const period of periods) {
      const spentOrPlanned = categoryExpenses
        .filter((transaction) => transaction.date >= period.from && transaction.date <= period.to)
        .reduce((sum, transaction) => sum + transaction.amount, 0)
      const difference = period.allowance - spentOrPlanned
      if (difference < 0 || period.to < today) adjustment += difference
    }

    // 요일이 아닌 날 등 어떤 예산 기간에도 속하지 않는 거래는 전액 자유비용 부담이다.
    adjustment -= categoryExpenses
      .filter((transaction) => !periods.some((period) => transaction.date >= period.from && transaction.date <= period.to))
      .reduce((sum, transaction) => sum + transaction.amount, 0)
  }

  return totalIncome(transactions, month) - totalBudget - reserveAmount + adjustment
}

/** 특정 날짜의 지출 합계 */
export function spentOnDate(transactions: Transaction[], date: string): number {
  return transactions
    .filter((t) => t.date === date && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
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
 * 반복 규칙이 해당 월에 발생하는 날짜 전부. 월 단위는 0~1건, 주 단위는 고른 요일 수에 따라 4~5건씩.
 * 주 단위는 그 달에서 지정 요일인 날을 모두 세고, 시작·종료일 밖은 뺀다.
 */
export function occurrenceDates(rule: OccurrenceRule, month: string): string[] {
  if (rule.interval !== 'weekly') {
    const date = occurrenceDate(rule, month)
    return date ? [date] : []
  }
  const wanted = new Set(rule.weekdays ?? [])
  if (wanted.size === 0) return []
  const [year, monthNum] = month.split('-').map(Number)
  const lastDay = getDaysInMonth(new Date(year, monthNum - 1, 1))
  const dates: string[] = []
  for (let day = 1; day <= lastDay; day++) {
    if (!wanted.has(new Date(year, monthNum - 1, day).getDay())) continue
    const date = `${month}-${String(day).padStart(2, '0')}`
    if (date < rule.startDate) continue
    if (rule.endDate && date > rule.endDate) continue
    dates.push(date)
  }
  return dates
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

/**
 * 그 규칙이 이 달에 쓰는 총액. 월 단위는 금액 그대로, 주 단위는 고른 요일이 그 달에 몇 번인지 곱한다.
 * 달마다 4주인지 5주인지가 달라서 주 단위 구독의 월 부담도 달마다 달라진다.
 * 시작·종료일로 잘린 달이어도 온전한 한 달치로 잡는다 (activeRecurringForCategory와 같은 기준).
 */
export function monthlyAmountForRule(rule: Pick<RecurringRule, 'amount' | 'interval' | 'weekdays'>, month: string): number {
  if (rule.interval !== 'weekly') return rule.amount
  return rule.amount * weekdayCountInMonth(rule.weekdays ?? [], month)
}

/** 위 목록의 합계. 화면에 보이는 목록과 금액이 어긋나지 않도록 같은 함수를 쓴다. */
export function recurringSumForCategory(
  rules: RecurringRule[],
  categoryId: string,
  month: string,
): number {
  return activeRecurringForCategory(rules, categoryId, month).reduce(
    (sum, r) => sum + monthlyAmountForRule(r, month),
    0,
  )
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

/**
 * 퀵 슬롯 구슬을 사용자가 정한 순서대로 준다.
 * 순서를 한 번도 안 바꾼 카테고리는 카테고리 목록 순서를 따라 뒤에 붙는다.
 */
export function quickSlotCategories(categories: Category[]): Category[] {
  const rank = (c: Category) => c.quickOrder ?? Number.MAX_SAFE_INTEGER
  return categories.filter(inQuickSlot).sort((a, b) => rank(a) - rank(b) || a.sortOrder - b.sortOrder)
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
 * 월 경계에서 주를 자르고 월 예산을 앞 기간부터 배분하므로, 모든 기간 몫의 합은
 * 카테고리 월 예산을 넘지 않는다. 예정 거래도 해당 기간의 사용 예정액으로 반영한다.
 * hiddenOnHome은 표시만 숨기며 계산에는 영향을 주지 않는다.
 */
export function buildBreakdown(
  categories: Category[],
  transactions: Transaction[],
  today: string,
): BreakdownRow[] {
  const rows: BreakdownRow[] = []

  for (const category of categories) {
    if (!category.budgetRule) continue
    const period = currentBudgetPeriod(category, today)
    const limit = usageLimit(category.budgetRule, today)
    if (!period || !limit) continue
    const periodExpenses = transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.categoryId === category.id &&
          t.date >= period.from &&
          t.date <= period.to,
      )
    const spent = periodExpenses.reduce((sum, t) => sum + t.amount, 0)
    const used = periodExpenses.filter((t) => t.date <= today).length
    rows.push({
      categoryId: category.id,
      scope: period.scope,
      allowance: period.allowance,
      spent,
      remaining: period.allowance - spent,
      limit: limit.limit,
      used,
      active: limit.active,
    })
  }
  return rows
}
