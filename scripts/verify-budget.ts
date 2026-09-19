// 앱 가이드 §8 초기 데이터로 계산 로직을 검산한다.
// 실행: npm run verify
import assert from 'node:assert/strict'
import {
  activeRecurringForCategory,
  budgetFromRule,
  buildBreakdown,
  categoryProgress,
  countExpenses,
  inQuickSlot,
  monthClosingBalance,
  monthlyAmountForRule,
  monthlyOccurrences,
  monthlyFreeAmount,
  monthsBetween,
  rollCarryoverForward,
  occurrenceDate,
  occurrenceDates,
  quickAddAmount,
  quickSlotCategories,
  recurringSumForCategory,
  releasedLeftoverTotal,
  releasedLeftovers,
  reserveSpentAmount,
  spentByCategory,
  spentOnDate,
  totalIncome,
  usageLimit,
  weekdayCountInMonth,
  weeksInMonth,
} from '../packages/budget-core/src/budget.ts'
import {
  categorySpending,
  elapsedDays,
  fixedVsVariable,
  monthSummary,
  spendingChange,
  topExpenses,
  topMemos,
  usageCompliance,
} from '../packages/budget-core/src/analysis.ts'
import { buildCsv } from '../apps/orbit/src/lib/csv.ts'
import { buildBackup, parseBackup } from '../apps/orbit/src/lib/backupFormat.ts'
import type { Category, RecurringRule, Transaction } from '../packages/budget-core/src/types.ts'

const cat = (id: string, name: string, monthlyBudget: number, isFixed: boolean): Category => ({
  id, name, monthlyBudget, color: '#8ebeff', isFixed, sortOrder: 0,
})

const categories: Category[] = [
  cat('food', '식비', 258000, true),
  cat('cafe', '카페', 43000, true),
  cat('transport', '교통비', 19970, true),
  cat('subs', '구독', 58490, true),
  cat('beauty', '미용', 35000, true),
  cat('invest', '투자', 20000, true),
  cat('etc', '기타', 0, false),
]

let seq = 0
const tx = (date: string, amount: number, type: 'expense' | 'income', categoryId: string | null, memo: string): Transaction => ({
  id: `t${++seq}`, date, amount, type, categoryId, memo, isPlanned: false, createdAt: seq,
})

// 2026년 9월: 반복 거래가 만들어낸 거래 + 일회성 거래
const transactions: Transaction[] = [
  // 반복 거래
  tx('2026-09-01', 700000, 'income', null, '용돈'),
  tx('2026-09-08', 9900, 'expense', 'subs', '구독 A'),
  tx('2026-09-17', 2500, 'expense', 'subs', '구독 B'),
  tx('2026-09-21', 1100, 'expense', 'subs', '구독 C'),
  tx('2026-09-21', 13990, 'expense', 'subs', '구독 D'),
  tx('2026-09-30', 31000, 'expense', 'subs', '해외 구독'),
  // 일회성 거래
  tx('2026-09-01', 50000, 'expense', null, '계획 소비'),
  tx('2026-09-10', 821950, 'income', null, '알바비'),
  tx('2026-09-10', 500000, 'expense', null, '대여금 상환'),
  tx('2026-09-13', 100000, 'expense', null, '계획 소비'),
  tx('2026-09-25', 119000, 'income', null, '지원금'),
]

const month = '2026-09'
const today = '2026-09-13'

// --- 가이드 §8 검산 값 ---
const income = totalIncome(transactions, month)
console.log(`총수입        = ${income.toLocaleString()} (기대: 1,640,950)`)
assert.equal(income, 1_640_950)

// 월 자유 금액: 카테고리 예산은 전액 확보하고, 예산 밖·초과 거래는 실제/예정 모두 차감한다.
const monthlyFree = monthlyFreeAmount(transactions, categories, today, 0)
console.log(`월 자유 금액   = ${monthlyFree.toLocaleString()} (카테고리 예산 + 예산 밖 거래 차감)`)
assert.equal(monthlyFree, 556_490)
assert.equal(monthlyFreeAmount(transactions, categories, today, 50_000), 506_490)
// 설정 → 자유비용에서 예정 수입을 빼면 아직 안 들어온 수입만큼 줄어든다
const plannedPay: Transaction = {
  id: 'planned-pay', date: '2026-09-25', amount: 200_000, type: 'income', categoryId: null,
  memo: '용돈', isPlanned: true, createdAt: 0,
}
assert.equal(totalIncome([...transactions, plannedPay], month), income + 200_000)
assert.equal(totalIncome([...transactions, plannedPay], month, false), income)
assert.equal(monthlyFreeAmount([...transactions, plannedPay], categories, today, 0), monthlyFree + 200_000)
assert.equal(monthlyFreeAmount([...transactions, plannedPay], categories, today, 0, false), monthlyFree)
console.log('예정 수입 제외 설정 (수입만 걸러내고 지출은 그대로) 통과')

// 실제 설정 화면과 같은 9/1 사례. 이름이 아니라 모든 카테고리의 저장된 월 예산을 합산한다.
const screenCategories = [
  cat('food2', '식비', 360_000, true),
  cat('transport2', '교통비', 42_900, true),
  cat('subs2', '구독', 58_490, true),
  cat('cafe2', '카페', 45_000, true),
  cat('beauty2', '미용', 100_000, true),
  cat('stationery2', '문구', 0, false),
  cat('stocks2', '주식', 20_000, true),
  cat('other2', '기타', 0, false),
]
const screenTransactions = [
  tx('2026-09-01', 700_000, 'income', null, ''),
  tx('2026-09-10', 821_950, 'income', null, ''),
  tx('2026-09-08', 9_900, 'expense', 'subs2', ''),
  tx('2026-09-17', 2_500, 'expense', 'subs2', ''),
  tx('2026-09-21', 1_100, 'expense', 'subs2', ''),
  tx('2026-09-21', 13_990, 'expense', 'subs2', ''),
  tx('2026-09-30', 31_000, 'expense', 'subs2', ''),
  tx('2026-09-10', 500_000, 'expense', null, ''),
  tx('2026-09-13', 100_000, 'expense', null, ''),
]
assert.equal(monthlyFreeAmount(screenTransactions, screenCategories, '2026-09-01', 100_000), 195_560)

const todaySpent = spentOnDate(transactions, today)
console.log(`오늘 총지출   = ${todaySpent.toLocaleString()}`)
assert.equal(todaySpent, 100_000)

// --- 카테고리 진행률 ---
const spent = spentByCategory(transactions, month)
const subsProgress = categoryProgress(spent.get('subs') ?? 0, 58_490)
console.log(`구독 진행률   = ${subsProgress}% (월말 기준 100%)`)
assert.equal(spent.get('subs'), 58_490)
assert.equal(subsProgress, 100)
assert.equal(categoryProgress(1234, 0), 0) // 예산 미설정이면 0%

// --- 반복 거래 발생일 (월말 보정) ---
const rule31 = { dayOfMonth: 31, startDate: '2026-01-01', endDate: null }
assert.equal(occurrenceDate(rule31, '2026-09'), '2026-09-30') // 9월은 30일까지
assert.equal(occurrenceDate(rule31, '2026-02'), '2026-02-28') // 2월 보정
assert.equal(occurrenceDate(rule31, '2026-10'), '2026-10-31')
assert.equal(occurrenceDate({ dayOfMonth: 8, startDate: '2026-09-10', endDate: null }, '2026-09'), null) // 시작 전
assert.equal(occurrenceDate({ dayOfMonth: 21, startDate: '2026-01-01', endDate: '2026-09-15' }, '2026-09'), null) // 종료 후
console.log('반복 거래 발생일 (31일 규칙 -> 9/30, 2월 보정, 기간 검사) 통과')

// --- 주 단위 반복 거래 ---
// 2026년 9월은 1일이 화요일이라 화요일이 5번(1·8·15·22·29), 월요일은 4번이다.
const weeklyTue = { interval: 'weekly' as const, dayOfMonth: 1, weekdays: [2], startDate: '2026-01-01', endDate: null }
assert.deepEqual(occurrenceDates(weeklyTue, '2026-09'),
  ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29'])
// 시작·종료일 밖의 날짜는 빠진다
assert.deepEqual(occurrenceDates({ ...weeklyTue, startDate: '2026-09-10', endDate: '2026-09-23' }, '2026-09'),
  ['2026-09-15', '2026-09-22'])
// 요일을 여러 개 고르면 그 요일마다 한 건씩 (9월 월4 + 수5 + 금4 = 13건)
assert.equal(occurrenceDates({ ...weeklyTue, weekdays: [1, 3, 5] }, '2026-09').length, 13)
assert.deepEqual(occurrenceDates({ ...weeklyTue, weekdays: [1, 3, 5] }, '2026-09').slice(0, 4),
  ['2026-09-02', '2026-09-04', '2026-09-07', '2026-09-09'])
// 요일을 안 고른 규칙은 아무것도 만들지 않는다
assert.deepEqual(occurrenceDates({ ...weeklyTue, weekdays: [] }, '2026-09'), [])
// 월 단위는 예전 그대로 0~1건
assert.deepEqual(occurrenceDates(rule31, '2026-09'), ['2026-09-30'])
assert.deepEqual(occurrenceDates({ dayOfMonth: 8, startDate: '2026-09-10', endDate: null }, '2026-09'), [])
// 월 부담은 그 달의 요일 수만큼. 달마다 값이 달라진다
assert.equal(monthlyAmountForRule({ amount: 20_000, interval: 'weekly', weekdays: [2] }, '2026-09'), 100_000)
assert.equal(monthlyAmountForRule({ amount: 20_000, interval: 'weekly', weekdays: [2] }, '2026-10'), 80_000)
assert.equal(monthlyAmountForRule({ amount: 10_000, interval: 'weekly', weekdays: [1, 3, 5] }, '2026-09'), 130_000)
assert.equal(monthlyAmountForRule({ amount: 17_000, interval: 'monthly' }, '2026-09'), 17_000)
assert.equal(monthlyAmountForRule({ amount: 17_000 }, '2026-09'), 17_000) // 주기가 없는 예전 규칙
console.log('주 단위 반복 거래 (고른 요일마다 한 건, 월 부담은 그 달 요일 수만큼) 통과')

// --- 예산 계산 도구 ---
// 2026년 9월은 1일이 화요일이라 화·수만 5번, 나머지 요일은 4번이다.
assert.equal(weekdayCountInMonth([1, 3, 5], '2026-09'), 13) // 월4 + 수5 + 금4
assert.equal(weekdayCountInMonth([1, 2, 3, 4, 5], '2026-09'), 22) // 월~금
assert.equal(weekdayCountInMonth([], '2026-09'), 0)
assert.equal(weeksInMonth('2026-09'), 30 / 7)

const perWeek10 = { mode: 'perWeek', timesPerWeek: 10 } as const
const monWedFri = { mode: 'weekdays', weekdays: [1, 3, 5], timesPerDay: 1 } as const
const weekdaysAll = { mode: 'weekdays', weekdays: [1, 2, 3, 4, 5], timesPerDay: 1 } as const
assert.equal(monthlyOccurrences(perWeek10, '2026-09'), 10 * (30 / 7))
assert.equal(monthlyOccurrences(monWedFri, '2026-09'), 13) // 근사 12.85가 아니라 실제 13회

// 횟수형: 한 번에 6,500원. 횟수를 먼저 반올림해서 금액이 6,500원 배수로 떨어진다.
assert.equal(budgetFromRule({ kind: 'perUse', unitAmount: 6_500, freq: perWeek10 }, '2026-09', 0), 279_500) // 42.85회 → 43회
assert.equal(budgetFromRule({ kind: 'perUse', unitAmount: 6_500, freq: monWedFri }, '2026-09', 0), 84_500) // 13회
assert.equal(279_500 % 6_500, 0) // 어중간한 278,571원이 아니라 단가의 배수

// 교통형: 편도 1,550원 왕복 → 하루 3,100원
const commute = { kind: 'commute', fare: 1_550, roundTrip: true } as const
assert.equal(budgetFromRule({ ...commute, freq: { mode: 'perWeek', timesPerWeek: 5 } }, '2026-09', 0), 65_100) // 21.42일 → 21일
assert.equal(budgetFromRule({ ...commute, freq: weekdaysAll }, '2026-09', 0), 68_200) // 월~금 22일
assert.equal(68_200 % 3_100, 0)
// 달이 바뀌면 요일 수가 달라져서 같은 설정도 금액이 달라진다 (11월은 1일이 일요일 → 월~금 21일)
assert.equal(weekdayCountInMonth([1, 2, 3, 4, 5], '2026-11'), 21)
assert.equal(budgetFromRule({ ...commute, freq: weekdaysAll }, '2026-11', 0), 65_100)

assert.equal(budgetFromRule({ kind: 'manual' }, '2026-09', 0), null) // 직접 입력은 계산 대상 아님
assert.equal(budgetFromRule({ kind: 'recurringSum' }, '2026-09', 31_900), 31_900)

// 구독 합계: 이 카테고리에 걸린, 이번 달에 살아있는 지출 규칙만 더한다
const recRule = (
  id: string,
  amount: number,
  type: 'expense' | 'income',
  categoryId: string | null,
  startDate = '2026-01-01',
  endDate: string | null = null,
): RecurringRule => ({
  id, name: id, amount, type, categoryId, dayOfMonth: 10,
  startDate, endDate, lastGeneratedMonth: null,
})
const recRules = [
  recRule('netflix', 17_000, 'expense', 'subs'),
  recRule('youtube', 14_900, 'expense', 'subs'),
  recRule('spotify', 11_000, 'expense', 'subs', '2026-09-20'), // 이번 달 중간에 가입
  recRule('gym', 50_000, 'expense', 'etc'), // 다른 카테고리
  recRule('allowance', 300_000, 'income', 'subs'), // 수입
  recRule('cancelled', 9_900, 'expense', 'subs', '2026-01-01', '2026-08-31'), // 지난달에 해지
]
// 9/20에 가입한 구독은 이번 달 발생일(10일)이 이미 지나서 예정 거래는 안 생기지만,
// 다음 달부터 계속 나가는 돈이므로 예산에는 들어가야 한다.
assert.equal(occurrenceDate({ dayOfMonth: 10, startDate: '2026-09-20', endDate: null }, '2026-09'), null)
assert.equal(recurringSumForCategory(recRules, 'subs', '2026-09'), 42_900) // 17,000 + 14,900 + 11,000
assert.equal(recurringSumForCategory(recRules, 'etc', '2026-09'), 50_000)
assert.equal(recurringSumForCategory(recRules, 'food', '2026-09'), 0)
// 주 단위 규칙은 한 번 금액이 아니라 그 달 발생 횟수만큼 합계에 들어간다
const weeklyYoga: RecurringRule = {
  id: 'yoga', name: '요가', amount: 20_000, type: 'expense', categoryId: 'etc',
  interval: 'weekly', dayOfMonth: 1, weekdays: [2],
  startDate: '2026-01-01', endDate: null, lastGeneratedMonth: null,
}
assert.equal(recurringSumForCategory([...recRules, weeklyYoga], 'etc', '2026-09'), 150_000) // 50,000 + 20,000 x 5
assert.equal(recurringSumForCategory([...recRules, weeklyYoga], 'etc', '2026-10'), 130_000) // 10월은 화요일이 4번
// 목록과 합계가 같은 함수에서 나오는지
assert.deepEqual(
  activeRecurringForCategory(recRules, 'subs', '2026-09').map((r) => r.id),
  ['netflix', 'youtube', 'spotify'],
)
// 아직 시작 전인 달에는 빠진다
assert.equal(recurringSumForCategory(recRules, 'subs', '2026-08'), 41_800) // spotify 제외, cancelled 포함
console.log('예산 계산 도구 (요일 수 세기, 단가 배수 반올림, 구독 합계 기간 판정) 통과')

// --- 홈 퀵 슬롯 구슬의 단가 ---
assert.equal(quickAddAmount({ kind: 'perUse', unitAmount: 13_000, freq: perWeek10 }), 13_000)
// 교통은 왕복이 켜져 있어도 한 번 누르면 편도. 왕복이면 두 번 누른다
assert.equal(quickAddAmount({ ...commute, freq: weekdaysAll }), 1_550)
assert.equal(quickAddAmount({ kind: 'commute', fare: 1_550, roundTrip: false, freq: weekdaysAll }), 1_550)
assert.equal(quickAddAmount({ kind: 'manual' }), null)
assert.equal(quickAddAmount({ kind: 'recurringSum' }), null)
assert.equal(quickAddAmount(undefined), null) // 계산 방법이 없는 예전 카테고리
console.log('퀵 슬롯 단가 (교통은 편도, 직접 입력·구독은 제외) 통과')

// 퀵 슬롯: 안 건드렸으면 단가 있는 것만, 손대면 그 설정이 이긴다
const slotCat = (budgetRule: object, quickSlot?: boolean): Category => ({
  id: 'x', name: 'x', monthlyBudget: 0, color: '#8ebeff', isFixed: false, sortOrder: 0,
  budgetRule: budgetRule as Category['budgetRule'], quickSlot,
})
assert.equal(inQuickSlot(slotCat({ kind: 'perUse', unitAmount: 6_500, freq: perWeek10 })), true)
assert.equal(inQuickSlot(slotCat({ ...commute, freq: weekdaysAll })), true)
assert.equal(inQuickSlot(slotCat({ kind: 'manual' })), false) // 기본값은 안 뜸
assert.equal(inQuickSlot(slotCat({ kind: 'manual' }, true)), true) // 직접 넣으면 뜬다
assert.equal(inQuickSlot(slotCat({ kind: 'recurringSum' }, true)), true)
assert.equal(inQuickSlot(slotCat({ kind: 'perUse', unitAmount: 6_500, freq: perWeek10 }, false)), false) // 빼면 안 뜬다
console.log('퀵 슬롯 표시 여부 (기본값 + 직접 설정) 통과')

// 퀵 슬롯 순서: quickOrder를 정한 것부터, 안 정한 것은 카테고리 순서대로 뒤에
const orderCat = (id: string, sortOrder: number, quickOrder?: number): Category => ({
  id, name: id, monthlyBudget: 0, color: '#8ebeff', isFixed: false, sortOrder,
  quickSlot: true, quickOrder,
})
const ordered = quickSlotCategories([
  orderCat('c', 2),
  orderCat('a', 0, 1),
  orderCat('d', 3, 0),
  orderCat('b', 1),
  { ...orderCat('e', 4), quickSlot: false }, // 뺀 카테고리는 빠진다
])
assert.deepEqual(ordered.map((c) => c.id), ['d', 'a', 'b', 'c'])
console.log('퀵 슬롯 순서 (지정 순서 우선, 미지정은 카테고리 순서로 뒤에) 통과')

// --- 홈 하루 몫 분해 ---
// 2026-09-07은 월요일, 09-08은 화요일, 09-09는 수요일
const MON = '2026-09-07'
const TUE = '2026-09-08'
const WED = '2026-09-09'
const foodRule = { kind: 'perUse', unitAmount: 6_500, freq: perWeek10 } as const
const cafeRule = { kind: 'perUse', unitAmount: 5_000, freq: monWedFri } as const
const busRule = { ...commute, freq: weekdaysAll } as const

assert.deepEqual(usageLimit(foodRule, MON), { scope: 'week', limit: 10, active: true })
assert.deepEqual(usageLimit(cafeRule, MON), { scope: 'day', limit: 1, active: true })
assert.deepEqual(usageLimit(cafeRule, TUE), { scope: 'day', limit: 1, active: false })
// 왕복은 편도 두 번이라 한도도 두 번. 구슬을 두 번 눌러야 하루치가 채워진다
assert.deepEqual(usageLimit(busRule, MON), { scope: 'day', limit: 2, active: true })
assert.deepEqual(usageLimit({ ...commute, freq: { mode: 'perWeek', timesPerWeek: 5 } }, MON), { scope: 'week', limit: 10, active: true })
assert.deepEqual(usageLimit({ kind: 'commute', fare: 1_550, roundTrip: false, freq: weekdaysAll }, MON), { scope: 'day', limit: 1, active: true })
assert.equal(usageLimit({ kind: 'manual' }, MON), null)

// 건수 세기: 기간 양끝 포함, 수입·다른 카테고리 제외
const countTx: Transaction[] = [
  tx('2026-09-06', 6_000, 'expense', 'food', ''),
  tx('2026-09-07', 6_500, 'expense', 'food', ''),
  tx('2026-09-12', 7_000, 'expense', 'food', ''),
  tx('2026-09-13', 8_000, 'expense', 'food', ''), // 주 범위 밖
  tx('2026-09-08', 5_000, 'expense', 'cafe', ''), // 다른 카테고리
  tx('2026-09-09', 100_000, 'income', 'food', ''), // 수입
]
assert.equal(countExpenses(countTx, 'food', '2026-09-06', '2026-09-12'), 3)
assert.equal(countExpenses(countTx, 'food', MON, MON), 1)
assert.equal(countExpenses(countTx, 'cafe', '2026-09-06', '2026-09-12'), 1)

// 히어로 목록: 카테고리별 현재 일/주 기간 잔액만 보여준다.
const homeCat = (id: string, monthlyBudget: number, budgetRule: object, hiddenOnHome = false): Category => ({
  id, name: id, monthlyBudget, color: '#8ebeff', isFixed: false, sortOrder: 0,
  budgetRule: budgetRule as Category['budgetRule'], hiddenOnHome,
})

// --- 남은 자유비용: 기간 종료 이월 / 즉시 초과 차감 / 예정 거래 ---
const dailyFood = homeCat('daily-food', 40_000, {
  kind: 'perUse', unitAmount: 10_000, freq: { mode: 'weekdays', weekdays: [2, 3], timesPerDay: 2 },
})
const dailyIncome = tx('2026-09-01', 100_000, 'income', null, '')
const spent15 = tx('2026-09-01', 15_000, 'expense', 'daily-food', '')
assert.equal(monthlyFreeAmount([dailyIncome, spent15], [dailyFood], '2026-09-01', 0), 60_000) // 진행 중 잔액은 미이월
assert.equal(monthlyFreeAmount([dailyIncome, spent15], [dailyFood], '2026-09-02', 0), 65_000) // 다음 날 5천원 이월

const spent25 = tx('2026-09-01', 25_000, 'expense', 'daily-food', '')
assert.equal(monthlyFreeAmount([dailyIncome, spent25], [dailyFood], '2026-09-01', 0), 55_000) // 초과 5천원 즉시 차감

const weeklyCafe = homeCat('weekly-cafe', 45_000, {
  kind: 'perUse', unitAmount: 5_000, freq: { mode: 'perWeek', timesPerWeek: 2 },
})
const spent9 = tx('2026-09-01', 9_000, 'expense', 'weekly-cafe', '')
assert.equal(monthlyFreeAmount([dailyIncome, spent9], [weeklyCafe], '2026-09-06', 0), 55_000) // 일요일까지 유지
assert.equal(monthlyFreeAmount([dailyIncome, spent9], [weeklyCafe], '2026-09-07', 0), 56_000) // 다음 주 월요일에 1천원 이월
assert.equal(buildBreakdown([weeklyCafe], [], '2026-09-28')[0].allowance, 5_000) // 9회=10k×4주+5k

const plannedOutside = { ...tx('2026-09-20', 10_000, 'expense', null, ''), isPlanned: true }
assert.equal(monthlyFreeAmount([dailyIncome, plannedOutside], [], '2026-09-01', 0), 90_000)
const plannedCategory = homeCat('planned', 20_000, { kind: 'manual' })
const coveredPlan = { ...tx('2026-09-20', 15_000, 'expense', 'planned', ''), isPlanned: true }
assert.equal(monthlyFreeAmount([dailyIncome, coveredPlan], [plannedCategory], '2026-09-01', 0), 80_000)

// 예산을 100k→50k로 줄이면 이미 쓴 80k 중 30k가 초과가 되어 실제 자유 증가분은 20k다.
const income200 = tx('2026-09-01', 200_000, 'income', null, '')
const spent80 = tx('2026-09-01', 80_000, 'expense', 'editable', '')
assert.equal(monthlyFreeAmount([income200, spent80], [homeCat('editable', 100_000, { kind: 'manual' })], '2026-09-01', 0), 100_000)
assert.equal(monthlyFreeAmount([income200, spent80], [homeCat('editable', 50_000, { kind: 'manual' })], '2026-09-01', 0), 120_000)

// 달 안에서 풀린 잔액은 달을 넘지 않는다. 다음 달로 넘어가는 돈은 `carriedInto`로만 들어온다.
const octoberIncome = tx('2026-10-01', 100_000, 'income', null, '')
assert.equal(monthlyFreeAmount([dailyIncome, spent15, octoberIncome], [dailyFood], '2026-10-01', 0), 60_000)

const homeCats = [
  homeCat('food', 279_500, foodRule),
  homeCat('cafe', 84_500, cafeRule),
  homeCat('bus', 68_200, busRule),
  homeCat('etc', 30_000, { kind: 'manual' }),
]
// 주는 월요일에 시작한다 — 09-07(월)은 09-09(수)와 같은 주다
const weekSpend = [
  tx(MON, 6_500, 'expense', 'food', ''), // 이번 주지만 오늘은 아님
  tx(WED, 6_500, 'expense', 'food', ''),
  tx(WED, 5_000, 'expense', 'cafe', ''),
  tx(WED, 30_000, 'expense', 'etc', ''), // 월 단위 카테고리는 히어로 행에 표시하지 않는다
]
const rows = buildBreakdown(homeCats, weekSpend, WED)

assert.deepEqual(rows.map((r) => r.categoryId), ['food', 'cafe', 'bus'])
// 식비: 주 단위라 이번 주 65,000에서 이번 주 지출 13,000을 뺀다 (오늘치만 빼지 않는다)
assert.deepEqual(
  { scope: rows[0].scope, allowance: rows[0].allowance, spent: rows[0].spent, remaining: rows[0].remaining, used: rows[0].used },
  { scope: 'week', allowance: 65_000, spent: 13_000, remaining: 52_000, used: 2 },
)
// 카페: 요일 지정이라 오늘 몫 5,000에서 오늘 지출 5,000
assert.deepEqual({ allowance: rows[1].allowance, remaining: rows[1].remaining, used: rows[1].used }, { allowance: 5_000, remaining: 0, used: 1 })

// 홈에서 숨기기는 표시 설정일 뿐 순수 계산 결과를 바꾸지 않는다.
const hidden = buildBreakdown(
  [
    homeCat('food', 279_500, foodRule),
    homeCat('cafe', 84_500, cafeRule, true),
    homeCat('bus', 68_200, busRule),
    homeCat('etc', 30_000, { kind: 'manual' }),
  ],
  weekSpend,
  WED,
)
assert.deepEqual(hidden, rows)
console.log('홈 예산 행 (기간별 예산, 주/일 한도, 건수) 통과')

// --- CSV 생성 ---
const csv = buildCsv(
  [
    { ...tx('2026-09-13', 12000, 'expense', 'food', '점심'), isPlanned: false },
    { ...tx('2026-09-01', 5000, 'expense', null, '콤마,와 "따옴표"') },
  ],
  categories,
)
const csvLines = csv.split('\n')
assert.equal(csvLines[0], 'date,type,category,amount,memo,is_planned,excluded_from_free_amount,from_reserve')
assert.equal(csvLines[1], '2026-09-01,expense,,5000,"콤마,와 ""따옴표""",false,false,false') // 날짜순 정렬 + 이스케이프
assert.equal(csvLines[2], '2026-09-13,expense,식비,12000,점심,false,false,false')
assert.equal(buildCsv([{ ...tx('2026-09-14', 3000, 'expense', null, ''), fromReserve: true }], categories).split('\n')[1], '2026-09-14,expense,,3000,,false,false,true')
console.log('CSV 생성 (컬럼 순서, 정렬, 이스케이프, 예비비) 통과')

// --- 끝난 기간이 자유비용에 돌려주는 잔액 (위시 '남은 예산 저금하기'가 가져가는 값) ---
// 2026-09: 1일이 화요일 → 주 기간은 1~6, 7~13, 14~20, 21~27, 28~30.
// 식비는 월·수·금 하루 20,000원(10,000 x 2회), 카페는 주 2회 x 5,000 = 주 10,000원.
const dayFood = homeCat('food2', 260_000, {
  kind: 'perUse', unitAmount: 10_000, freq: { mode: 'weekdays', weekdays: [1, 3, 5], timesPerDay: 2 },
})
const weekCafe = homeCat('cafe2', 45_000, {
  kind: 'perUse', unitAmount: 5_000, freq: { mode: 'perWeek', timesPerWeek: 2 },
})
const leftoverCats = [dayFood, weekCafe]
const dayIncome = tx('2026-09-01', 300_000, 'income', null, '')

// 요일 카테고리는 그 날이 끝나면서 남은 몫을 돌려준다 (20,000 중 18,000 사용 → 2,000)
const foodSpent = [dayIncome, tx(MON, 18_000, 'expense', 'food2', '')]
assert.deepEqual(
  releasedLeftovers(leftoverCats, foodSpent, MON).map((row) => [row.categoryId, row.scope, row.leftover]),
  [['food2', 'day', 2_000]],
)
// 사용일이 아닌 화요일에는 끝나는 기간이 없다
assert.deepEqual(releasedLeftovers(leftoverCats, foodSpent, TUE), [])

// 주 카테고리는 주가 끝나는 일요일에만 돌려준다 (9/13 일요일)
const cafeSpent = [dayIncome, tx('2026-09-09', 7_000, 'expense', 'cafe2', '')]
assert.deepEqual(releasedLeftovers([weekCafe], cafeSpent, '2026-09-12'), []) // 토요일엔 아직 안 끝남
assert.deepEqual(
  releasedLeftovers([weekCafe], cafeSpent, '2026-09-13').map((row) => [row.scope, row.from, row.to, row.leftover]),
  [['week', '2026-09-07', '2026-09-13', 3_000]],
)
// 예산을 넘긴 기간은 돌려줄 것이 없다. 초과분은 쓴 날 이미 자유비용에서 빠졌다
assert.deepEqual(releasedLeftovers([weekCafe], [dayIncome, tx('2026-09-09', 12_000, 'expense', 'cafe2', '')], '2026-09-13'), [])

// 같은 날 끝나는 기간이 여럿이면 전부 합친다. 9/30은 수요일이자 잘린 마지막 주의 끝
assert.deepEqual(
  releasedLeftovers(leftoverCats, [dayIncome], '2026-09-30').map((row) => [row.categoryId, row.scope, row.leftover]),
  [['food2', 'day', 20_000], ['cafe2', 'week', 5_000]],
)
assert.equal(releasedLeftoverTotal(leftoverCats, [dayIncome], '2026-09-30'), 25_000)

// 이 값이 곧 다음 날 자유비용에 더해지는 금액이다 — 두 계산이 갈라지면 안 된다
for (const [date, next] of [['2026-09-07', '2026-09-08'], ['2026-09-13', '2026-09-14'], ['2026-09-20', '2026-09-21']]) {
  const ledger = [dayIncome, tx(MON, 18_000, 'expense', 'food2', ''), tx('2026-09-09', 7_000, 'expense', 'cafe2', '')]
  assert.equal(
    monthlyFreeAmount(ledger, leftoverCats, next, 0) - monthlyFreeAmount(ledger, leftoverCats, date, 0),
    releasedLeftoverTotal(leftoverCats, ledger, date),
    `${date} → ${next} 환급액 불일치`,
  )
}
console.log('끝난 기간의 잔액 환급 (요일은 그 날, 주는 일요일, 초과는 0) 통과')

// --- 위시 저금 연동 ---
// 위시에 저금한 돈은 예비비와 같은 성격으로 이번 달 자유비용에서 한 번 빠진다.
assert.equal(monthlyFreeAmount(transactions, categories, today, 0, true, 40_000), 516_490)
// 예비비와 나란히 빠진다
assert.equal(monthlyFreeAmount(transactions, categories, today, 50_000, true, 40_000), 466_490)
// 취소로 회수한 금액이 더 크면 음수가 되어 이번 달 자유비용에 더해진다
assert.equal(monthlyFreeAmount(transactions, categories, today, 0, true, -30_000), 586_490)
// 인자를 생략하면 예전과 같다. 위시를 한 번도 안 쓴 사용자의 숫자가 변하지 않아야 한다
assert.equal(monthlyFreeAmount(transactions, categories, today, 0, true), 556_490)
// 예정 수입 제외 설정과도 겹쳐서 적용된다
assert.equal(
  monthlyFreeAmount(transactions, categories, today, 0, false, 40_000),
  monthlyFreeAmount(transactions, categories, today, 0, false) - 40_000,
)
console.log('위시 저금 차감 통과')

// 위시 구매 거래는 목록·통계에는 남지만 자유비용에서는 이미 저금한 돈을 다시 빼지 않는다.
const wishPurchase = {
  ...tx(today, 40_000, 'expense', null, 'Wish · 헤드폰'),
  excludedFromFreeAmount: true,
}
assert.equal(monthlyFreeAmount([...transactions, wishPurchase], categories, today, 0, true, 40_000), 516_490)
// 카테고리를 지정해도 자유비용 계산에서는 제외한다. spentByCategory 통계에는 포함된다.
const categorizedWishPurchase = { ...wishPurchase, categoryId: 'food' }
assert.equal(monthlyFreeAmount([...transactions, categorizedWishPurchase], categories, today, 0, true, 40_000), 516_490)
assert.equal(
  spentByCategory([...transactions, categorizedWishPurchase], month).get('food'),
  (spentByCategory(transactions, month).get('food') ?? 0) + wishPurchase.amount,
)
console.log('위시 구매 거래 자유비용 이중 차감 방지 통과')

// --- 달 마감 잔액과 다음 달 이월 ---
{
  const carryCats = [homeCat('c-food', 200_000, { kind: 'manual' })]
  const aug = [
    tx('2026-08-01', 500_000, 'income', null, ''),
    tx('2026-08-10', 120_000, 'expense', 'c-food', ''), // 예산 안에서 사용
    tx('2026-08-20', 80_000, 'expense', null, ''), // 예산 밖
  ]
  // 마감은 카테고리 예산을 붙잡지 않는다 — 500,000에서 실제로 나간 200,000만 뺀다
  assert.equal(monthClosingBalance(aug, '2026-08'), 300_000)
  // 진행 중 자유비용은 예산 200,000을 확보한 뒤 예산 밖 80,000을 뺀 값
  assert.equal(monthlyFreeAmount(aug, carryCats, '2026-08-31', 0), 220_000)
  // 둘의 차이가 곧 안 쓴 카테고리 예산(200,000 − 120,000)이다
  assert.equal(monthClosingBalance(aug, '2026-08') - monthlyFreeAmount(aug, carryCats, '2026-08-31', 0), 80_000)
  // 예비비를 떼어 둔 달도 마감에서는 함께 풀린다 (안 쓴 예비비도 넘어간다)
  assert.equal(monthlyFreeAmount(aug, carryCats, '2026-08-31', 50_000), 170_000)
  assert.equal(monthClosingBalance(aug, '2026-08'), 300_000)

  // 9월은 8월 마감액을 이월로 받는다
  const sep = [...aug, tx('2026-09-01', 100_000, 'income', null, '')]
  const carried = monthClosingBalance(aug, '2026-08')
  assert.equal(carried, 300_000)
  assert.equal(
    monthlyFreeAmount(sep, carryCats, '2026-09-05', 0, true, 0, carried),
    monthlyFreeAmount(sep, carryCats, '2026-09-05', 0) + 300_000,
  )

  // 초과 지출한 달은 마이너스로 넘어간다
  const overspent = [
    tx('2026-08-01', 100_000, 'income', null, ''),
    tx('2026-08-15', 150_000, 'expense', null, ''),
  ]
  assert.equal(monthClosingBalance(overspent, '2026-08'), -50_000)

  // 한 칸씩 굴린다. 받은 이월을 그대로 얹어 넘기므로 지난달 한 달치만 읽으면 된다 —
  // 7월에 남긴 100,000이 8월 기록에 없어도 9월까지 살아 있다
  const july = [tx('2026-07-01', 100_000, 'income', null, '')]
  const chain = [...july, tx('2026-08-10', 30_000, 'expense', null, '')]
  const julyClosing = monthClosingBalance(chain, '2026-07')
  assert.equal(julyClosing, 100_000)
  assert.equal(monthClosingBalance(chain, '2026-08', true, 0, julyClosing), 70_000)
  // 기록이 없는 달은 받은 금액을 그대로 흘려보낸다
  assert.equal(monthClosingBalance([], '2026-08', true, 0, 70_000), 70_000)
  // 시작 달은 이월을 받지 않는다
  assert.equal(monthClosingBalance(july, '2026-07', true, 0, 0), 100_000)

  // 위시에 묶인 돈은 넘어가지 않는다. 구매 거래는 저금 때 이미 빠져 두 번 빠지지 않는다
  assert.equal(monthClosingBalance(aug, '2026-08', true, 50_000), 250_000)
  const augWithPurchase = [
    ...aug,
    { ...tx('2026-08-25', 50_000, 'expense', null, 'Wish · 헤드폰'), excludedFromFreeAmount: true },
  ]
  assert.equal(monthClosingBalance(augWithPurchase, '2026-08', true, 50_000), 250_000)

  // 예정 수입 제외 설정은 마감에도 같은 기준으로 걸린다
  const plannedAug = [...aug, { ...tx('2026-08-28', 90_000, 'income', null, ''), isPlanned: true }]
  assert.equal(monthClosingBalance(plannedAug, '2026-08'), 390_000)
  assert.equal(monthClosingBalance(plannedAug, '2026-08', false), 300_000)

  // 인자를 생략하면 예전과 같다. 이월이 없는 사용자의 숫자가 변하지 않아야 한다
  assert.equal(monthlyFreeAmount(transactions, categories, today, 0, true, 0, 0), 556_490)
  console.log('달 마감 잔액과 다음 달 이월 (안 쓴 예산·예비비 포함, 마이너스·빈 달 이어 붙이기) 통과')

  // --- 이월 원장 굴리기 (rollCarryover가 DB에 굳히는 값) ---
  assert.deepEqual(monthsBetween('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01']) // 해를 넘는다
  assert.deepEqual(monthsBetween('2026-09', '2026-09'), [])
  assert.deepEqual(monthsBetween('2026-10', '2026-09'), []) // 거꾸로면 빈 배열 (무한 루프 금지)

  // 7월 +100,000 → 8월 −30,000 → 9월은 기록 없음. 앱을 몇 달 안 열었을 때의 메우기
  const rollLedger = [...july, tx('2026-08-10', 30_000, 'expense', null, '')]
  assert.deepEqual(
    rollCarryoverForward(rollLedger, '2026-07', '2026-10', 0),
    [
      { month: '2026-08', carriedIn: 100_000 },
      { month: '2026-09', carriedIn: 70_000 },
      { month: '2026-10', carriedIn: 70_000 }, // 기록 없는 달은 그대로 흘러간다
    ],
  )
  // 평소 경로: 굳어 있는 지난달에서 한 칸만 굴려도 같은 값이 나온다
  assert.deepEqual(
    rollCarryoverForward(rollLedger, '2026-09', '2026-10', 70_000),
    [{ month: '2026-10', carriedIn: 70_000 }],
  )
  // 위시에 묶인 돈은 그 달 마감에서 빠진다
  assert.deepEqual(
    rollCarryoverForward(rollLedger, '2026-08', '2026-09', 100_000, new Map([['2026-08', 20_000]])),
    [{ month: '2026-09', carriedIn: 50_000 }],
  )
  // 굴릴 것이 없으면 빈 목록 — 시작 달이나 같은 달을 두 번 열었을 때
  assert.deepEqual(rollCarryoverForward(rollLedger, '2026-10', '2026-10', 70_000), [])
  console.log('이월 원장 굴리기 (해 넘김, 빈 달 메우기, 한 칸 굴리기, 위시 차감) 통과')
}

// --- 예비비에서 꺼내 쓴 지출 ---
{
  const income = tx('2026-09-01', 100_000, 'income', null, '')
  const fromReserve = (amount: number, extra: Partial<Transaction> = {}): Transaction =>
    ({ ...tx('2026-09-10', amount, 'expense', null, '예비비'), fromReserve: true, ...extra })

  // 예비비 30,000을 떼어 둔 달. 쓰기 전 자유비용은 70,000
  assert.equal(monthlyFreeAmount([income], [], '2026-09-15', 30_000), 70_000)
  // 예비비 안에서 쓰면 자유비용은 그대로, 예비비만 줄어든다
  assert.equal(monthlyFreeAmount([income, fromReserve(20_000)], [], '2026-09-15', 30_000), 70_000)
  assert.equal(reserveSpentAmount([income, fromReserve(20_000)], '2026-09'), 20_000)
  // 예비비를 넘기면 넘긴 20,000만 자유비용에서 빠진다
  assert.equal(monthlyFreeAmount([income, fromReserve(50_000)], [], '2026-09-15', 30_000), 50_000)
  // 같은 돈을 예비비 표시 없이 쓰면 자유비용에서 전액 빠진다 — 표시의 차이
  assert.equal(monthlyFreeAmount([income, tx('2026-09-10', 20_000, 'expense', null, '')], [], '2026-09-15', 30_000), 50_000)
  // 예비비가 0인 달은 전액이 초과라 표시 없는 지출과 같다
  assert.equal(monthlyFreeAmount([income, fromReserve(10_000)], [], '2026-09-15', 0), 90_000)
  // 예정 지출도 즉시 예비비를 쓴다
  assert.equal(reserveSpentAmount([income, fromReserve(10_000, { isPlanned: true, date: '2026-09-25' })], '2026-09'), 10_000)
  // 다른 달 예비비 지출은 이번 달에 안 들어온다
  assert.equal(reserveSpentAmount([fromReserve(10_000, { date: '2026-10-01' })], '2026-09'), 0)

  // 카테고리가 붙어 있어도 카테고리 예산·초과 계산에 넣지 않는다 (두 번 빠지면 안 된다)
  const manualCat = homeCat('r-etc', 10_000, { kind: 'manual' })
  assert.equal(
    monthlyFreeAmount([income, fromReserve(20_000, { categoryId: 'r-etc' })], [manualCat], '2026-09-15', 30_000),
    60_000, // 100,000 − 카테고리 10,000 − 예비비 30,000. 예비비 지출 20,000은 예비비 안
  )

  // 이월과 맞물린다: 마감은 실제로 나간 돈만 빼므로 안 쓴 예비비 10,000이 자유비용 70,000과 함께 넘어간다
  assert.equal(monthClosingBalance([income, fromReserve(20_000)], '2026-09'), 80_000)
  console.log('예비비 지출 (예비비 안·초과·예정·카테고리 무시·이월 정합) 통과')
}

// ── 전체 백업 ─────────────────────────────────────────
{
  const schema = {
    budget: { version: 3, keys: { categories: 'id', transactions: 'id', recurringRules: 'id', monthSettings: 'yearMonth' } },
    wish: { version: 2, keys: { wishes: 'id', dustLedger: 'id', levelClaims: 'level' } },
  }
  const good = buildBackup(
    { version: 3, tables: { categories: [{ id: 'c1', name: '식비' }], monthSettings: [{ yearMonth: '2026-09', reserveAmount: 0 }] } },
    { version: 2, tables: { wishes: [{ id: 'w1' }], levelClaims: [{ level: 1 }] } },
    { plannedIncome: 'exclude' },
    1_700_000_000_000,
  )
  const reason = (value: unknown) => {
    const result = parseBackup(typeof value === 'string' ? value : JSON.stringify(value), schema)
    return result.ok ? null : result.reason
  }

  // 내보낸 그대로 다시 읽힌다
  const round = parseBackup(JSON.stringify(good), schema)
  assert.ok(round.ok)
  if (round.ok) assert.deepEqual(round.backup, good)
  // 옛 버전은 받는다 — 그때 없던 표는 빈 표로 복원된다
  assert.equal(reason({ ...good, wish: { version: 1, tables: {} } }), null)

  assert.equal(reason('백업 아님'), '백업 파일 아님')
  assert.equal(reason({ ...good, app: 'other' }), '백업 파일 아님')
  // 새 버전 앱의 백업은 지금 코드가 모르는 필드를 해석할 수 없다
  assert.match(reason({ ...good, format: 2 }) ?? '', /새 버전/)
  assert.match(reason({ ...good, budget: { version: 4, tables: {} } }) ?? '', /새 버전/)
  assert.match(reason({ ...good, budget: { version: 3, tables: { accounts: [] } } }) ?? '', /모르는 표/)
  // 기본키가 없거나 겹치는 행은 Dexie가 넣지 못해 복원 도중 멈춘다 — 쓰기 전에 거른다
  assert.match(reason({ ...good, budget: { version: 3, tables: { categories: [{ name: 'x' }] } } }) ?? '', /손상/)
  assert.match(reason({ ...good, budget: { version: 3, tables: { categories: [{ id: 'a' }, { id: 'a' }] } } }) ?? '', /중복/)
  // 설정은 아는 값만 받는다
  const odd = parseBackup(JSON.stringify({ ...good, settings: { plannedIncome: 'maybe' } }), schema)
  assert.ok(odd.ok && odd.backup.settings.plannedIncome === undefined)
  console.log('전체 백업 통과')
}

// ── 월 분석 ─────────────────────────────────────────
{
  const aCats: Category[] = [
    // 9월 카페 예산은 계산식에서: 5,000 × round(2 × 30/7) = 45,000
    { ...cat('cafe', '카페', 45_000, false), budgetRule: { kind: 'perUse', unitAmount: 5_000, freq: { mode: 'perWeek', timesPerWeek: 2 } } },
    { ...cat('subs', '구독', 30_000, true), budgetRule: { kind: 'manual' } },
    cat('food', '식비', 0, false),
  ]
  const at = (date: string, amount: number, categoryId: string | null, memo = '', extra: Partial<Transaction> = {}): Transaction =>
    ({ ...tx(date, amount, 'expense', categoryId, memo), ...extra })
  const sept: Transaction[] = [
    tx('2026-09-01', 1_000_000, 'income', null, '월급'),
    { ...tx('2026-09-25', 200_000, 'income', null, '용돈'), isPlanned: true },
    at('2026-09-01', 4_000, 'cafe', '스타벅스'), // 9/1~9/6 주: 몫 10,000
    at('2026-09-03', 5_000, 'cafe', '스타벅스'),
    at('2026-09-08', 15_000, 'cafe', '스타벅스'), // 9/7~9/13 주: 몫 10,000 → 5,000 초과
    at('2026-09-02', 9_900, 'subs', '넷플릭스', { recurringRuleId: 'r1' }),
    at('2026-09-05', 30_000, 'food', '마트'),
    at('2026-09-06', 12_000, 'gone', '지운 카테고리'), // 없는 카테고리 → 미분류
    at('2026-09-07', 8_000, 'food', '', { fromReserve: true }), // 예비비
    at('2026-09-09', 50_000, 'food', '위시 구매', { excludedFromFreeAmount: true }),
    at('2026-09-20', 7_000, 'food', '마트', { isPlanned: true }), // 예정은 지출에서 제외
  ]
  const aToday = '2026-09-13'

  assert.equal(elapsedDays('2026-08', aToday), 31)
  assert.equal(elapsedDays('2026-09', aToday), 13)
  assert.equal(elapsedDays('2026-10', aToday), 0)

  const summary = monthSummary(sept, '2026-09', aToday)
  assert.equal(summary.spent, 4_000 + 5_000 + 15_000 + 9_900 + 30_000 + 12_000 + 8_000 + 50_000)
  assert.equal(summary.income, 1_000_000)
  assert.equal(summary.plannedIncome, 200_000)
  assert.equal(summary.plannedSpent, 7_000)
  // 지출 있는 날: 1·2·3·5·6·7·8·9 → 13일 중 5일 무지출
  assert.equal(summary.noSpendDays, 5)

  const rows = categorySpending(sept, aCats, '2026-09')
  const byKey = new Map(rows.map((row) => [row.key, row]))
  assert.equal(byKey.get('food')?.spent, 80_000) // 위시 구매 포함, 예비비·예정 제외
  assert.equal(byKey.get('reserve')?.spent, 8_000)
  assert.equal(byKey.get('none')?.spent, 12_000)
  assert.equal(byKey.get('cafe')?.budget, 45_000)
  assert.equal(byKey.get('cafe')?.budgetIsCurrent, false)
  assert.equal(byKey.get('subs')?.budgetIsCurrent, true)
  assert.equal(byKey.get('food')?.budget, null)
  assert.equal(rows[0].key, 'food') // 많이 쓴 순서
  // 2월은 28일 → 카페 계산식 예산이 5,000 × round(8) = 40,000
  assert.equal(categorySpending([at('2026-02-03', 1_000, 'cafe')], aCats, '2026-02')[0].budget, 40_000)

  const change = spendingChange(rows, categorySpending([at('2026-08-10', 20_000, 'food')], aCats, '2026-08'))
  assert.equal(change.get('food'), 60_000)
  assert.equal(change.get('cafe'), 24_000)

  // 오늘 9/13은 둘째 주 진행 중 → 끝난 주는 9/1~9/6 하나
  const compliance = usageCompliance(aCats, sept, '2026-09', aToday)
  assert.equal(compliance.length, 1)
  const { periods, kept, over, leftover, overAmount } = compliance[0]
  assert.deepEqual({ periods, kept, over, leftover, overAmount }, { periods: 1, kept: 1, over: 0, leftover: 1_000, overAmount: 0 })
  // 다음 주로 넘어가면 둘째 주가 초과로 잡힌다
  const later = usageCompliance(aCats, sept, '2026-09', '2026-09-14')[0]
  assert.equal(later.over, 1)
  assert.equal(later.overAmount, 5_000)
  // 미사용액은 자유비용 환급(releasedLeftovers)과 같은 값
  assert.equal(later.leftover, releasedLeftoverTotal(aCats, sept, '2026-09-06'))
  // 예산 0인 계산식 카테고리는 지킬 한도가 없어 빠진다
  assert.equal(usageCompliance([{ ...aCats[0], monthlyBudget: 0 }], sept, '2026-09', '2026-09-14').length, 0)

  assert.deepEqual(topExpenses(sept, '2026-09', 2).map((t) => t.amount), [50_000, 30_000])
  // 마트는 실제 1건 + 예정 1건이라 「자주」에 못 든다
  assert.deepEqual(topMemos(sept, '2026-09'), [{ memo: '스타벅스', count: 3, total: 24_000 }])

  const split = fixedVsVariable(sept, aCats, '2026-09')
  assert.equal(split.fixed, 9_900)
  assert.equal(split.fixed + split.variable, summary.spent)
  console.log('월 분석 통과')
}

console.log('\n모든 검산 통과')
