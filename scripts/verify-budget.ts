// 앱 가이드 §8 초기 데이터로 계산 로직을 검산한다.
// 실행: npm run verify
import assert from 'node:assert/strict'
import {
  activeRecurringForCategory,
  availableAmount,
  breakdownTotal,
  budgetFromRule,
  buildBreakdown,
  calcTodayBudget,
  categoryProgress,
  countExpenses,
  dailyAllowance,
  freeBudget,
  inQuickSlot,
  monthlyOccurrences,
  occurredExpense,
  occurrenceDate,
  periodAllowance,
  quickAddAmount,
  recurringSumForCategory,
  remainingDays,
  remainingToday,
  spentByCategory,
  spentOnDate,
  totalIncome,
  upcomingExpense,
  usageLimit,
  weekdayCountInMonth,
  weeksInMonth,
} from '../src/lib/budget.ts'
import { buildCsv } from '../src/lib/csv.ts'
import type { Category, RecurringRule, Transaction } from '../src/lib/types.ts'

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

const free = freeBudget(transactions, categories, month)
console.log(`자유 예산     = ${free.toLocaleString()} (기대: 556,490)`)
assert.equal(free, 556_490)

// --- 오늘 예산 흐름 (9/13 아침 기준) ---
const occurred = occurredExpense(transactions, today)
console.log(`발생 지출     = ${occurred.toLocaleString()} (9/13 이전: 50,000 + 9,900 + 500,000)`)
assert.equal(occurred, 559_900)

const available = availableAmount(transactions, today)
console.log(`가용액        = ${available.toLocaleString()}`)
assert.equal(available, 1_081_050)

const upcoming = upcomingExpense(transactions, today)
console.log(`예정 지출     = ${upcoming.toLocaleString()} (9/13 이후 구독료)`)
assert.equal(upcoming, 48_590)

const days = remainingDays(today)
console.log(`남은 일수     = ${days} (9/13~9/30)`)
assert.equal(days, 18)

const todayBudget = calcTodayBudget(transactions, today, 0)
console.log(`오늘 예산     = ${todayBudget.toLocaleString()} (= floor(1,032,460 / 18))`)
assert.equal(todayBudget, 57_358)

const todayBudgetWithReserve = calcTodayBudget(transactions, today, 50_000)
console.log(`오늘 예산(예비비 5만) = ${todayBudgetWithReserve.toLocaleString()}`)
assert.equal(todayBudgetWithReserve, 54_581)

const todaySpent = spentOnDate(transactions, today)
const remaining = remainingToday(todayBudget, todaySpent)
console.log(`오늘 지출     = ${todaySpent.toLocaleString()}, 남은 금액 = ${remaining.toLocaleString()} (음수 허용)`)
assert.equal(remaining, -42_642)

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
console.log('반복 거래 발생일 (31일 규칙 → 9/30, 2월 보정, 기간 검사) 통과')

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
// 목록과 합계가 같은 함수에서 나오는지
assert.deepEqual(
  activeRecurringForCategory(recRules, 'subs', '2026-09').map((r) => r.id),
  ['netflix', 'youtube', 'spotify'],
)
// 아직 시작 전인 달에는 빠진다
assert.equal(recurringSumForCategory(recRules, 'subs', '2026-08'), 41_800) // spotify 제외, cancelled 포함
console.log('예산 계산 도구 (요일 수 세기, 단가 배수 반올림, 구독 합계 기간 판정) 통과')

// --- 홈 빠른 기록 구슬의 단가 ---
assert.equal(quickAddAmount({ kind: 'perUse', unitAmount: 13_000, freq: perWeek10 }), 13_000)
// 교통은 왕복이 켜져 있어도 한 번 누르면 편도. 왕복이면 두 번 누른다
assert.equal(quickAddAmount({ ...commute, freq: weekdaysAll }), 1_550)
assert.equal(quickAddAmount({ kind: 'commute', fare: 1_550, roundTrip: false, freq: weekdaysAll }), 1_550)
assert.equal(quickAddAmount({ kind: 'manual' }), null)
assert.equal(quickAddAmount({ kind: 'recurringSum' }), null)
assert.equal(quickAddAmount(undefined), null) // 계산 방법이 없는 예전 카테고리
console.log('빠른 기록 단가 (교통은 편도, 직접 입력·구독은 제외) 통과')

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

// --- 홈 하루 몫 분해 ---
// 2026-09-07은 월요일, 09-08은 화요일
const MON = '2026-09-07'
const TUE = '2026-09-08'
const foodRule = { kind: 'perUse', unitAmount: 6_500, freq: perWeek10 } as const
const cafeRule = { kind: 'perUse', unitAmount: 5_000, freq: monWedFri } as const
const busRule = { ...commute, freq: weekdaysAll } as const

assert.equal(dailyAllowance(foodRule, MON), 9_285) // 6,500 x 10 / 7 = 9,285.7 -> 내림
assert.equal(dailyAllowance(cafeRule, MON), 5_000) // 월요일이라 그날 몫이 있다
assert.equal(dailyAllowance(cafeRule, TUE), 0) // 화요일은 쓰기로 한 요일이 아니다
assert.equal(dailyAllowance(busRule, MON), 3_100) // 편도 1,550 왕복 = 하루 3,100
assert.equal(dailyAllowance(busRule, '2026-09-05'), 0) // 토요일
assert.equal(dailyAllowance({ ...commute, freq: { mode: 'perWeek', timesPerWeek: 5 } }, MON), 2_214) // 3,100 x 5 / 7
assert.equal(dailyAllowance({ kind: 'manual' }, MON), null)
assert.equal(dailyAllowance({ kind: 'recurringSum' }, MON), null)

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

// 기간별 예산: 주 한도면 예산도 주 단위 (카페 5,000원 x 주 2회 = 이번 주 10,000원)
assert.deepEqual(periodAllowance({ kind: 'perUse', unitAmount: 5_000, freq: { mode: 'perWeek', timesPerWeek: 2 } }, MON), { scope: 'week', amount: 10_000 })
assert.deepEqual(periodAllowance(foodRule, MON), { scope: 'week', amount: 65_000 }) // 6,500 x 10
assert.deepEqual(periodAllowance(cafeRule, MON), { scope: 'day', amount: 5_000 })
assert.deepEqual(periodAllowance(cafeRule, TUE), { scope: 'day', amount: 0 })
assert.deepEqual(periodAllowance(busRule, MON), { scope: 'day', amount: 3_100 })
assert.equal(periodAllowance({ kind: 'manual' }, MON), null)

// 히어로 목록: 줄마다 자기 기간, 큰 숫자는 그 줄들의 합
const homeCat = (id: string, budgetRule: object, hiddenOnHome = false): Category => ({
  id, name: id, monthlyBudget: 0, color: '#8ebeff', isFixed: false, sortOrder: 0,
  budgetRule: budgetRule as Category['budgetRule'], hiddenOnHome,
})
const homeCats = [homeCat('food', foodRule), homeCat('cafe', cafeRule), homeCat('bus', busRule), homeCat('etc', { kind: 'manual' })]
const WEEK_FROM = '2026-09-06' // 일요일
const WEEK_TO = '2026-09-12'
const weekSpend = [
  tx(WEEK_FROM, 6_500, 'expense', 'food', ''), // 이번 주지만 오늘은 아님
  tx(MON, 6_500, 'expense', 'food', ''),
  tx(MON, 5_000, 'expense', 'cafe', ''),
  tx(MON, 30_000, 'expense', 'etc', ''), // 목록에 없는 카테고리 -> 자유에서 빠진다
]
const todaySpend = weekSpend.filter((t) => t.date === MON)
const dayBudget = 57_358
const rows = buildBreakdown(homeCats, todaySpend, weekSpend, dayBudget, MON, WEEK_FROM, WEEK_TO)

assert.deepEqual(rows.map((r) => r.categoryId), ['food', 'cafe', 'bus', null])
// 식비: 주 단위라 이번 주 65,000에서 이번 주 지출 13,000을 뺀다 (오늘치만 빼지 않는다)
assert.deepEqual(
  { scope: rows[0].scope, allowance: rows[0].allowance, spent: rows[0].spent, remaining: rows[0].remaining, used: rows[0].used },
  { scope: 'week', allowance: 65_000, spent: 13_000, remaining: 52_000, used: 2 },
)
// 카페: 요일 지정이라 오늘 몫 5,000에서 오늘 지출 5,000
assert.deepEqual({ allowance: rows[1].allowance, remaining: rows[1].remaining, used: rows[1].used }, { allowance: 5_000, remaining: 0, used: 1 })
// 자유: 오늘 예산에서 하루 환산 몫(9,285 + 5,000 + 3,100)을 뺀 뒤 목록 밖 지출 30,000을 뺀다
const freeRow = rows[3]
assert.equal(freeRow.allowance, dayBudget - (9_285 + 5_000 + 3_100))
assert.equal(freeRow.spent, 30_000)
assert.equal(breakdownTotal(rows), rows.reduce((s, r) => s + r.remaining, 0))

// 숨기면 그 줄이 빠지고, 떼어두지 않은 몫만큼 자유가 늘어난다
const hidden = buildBreakdown(
  [homeCat('food', foodRule), homeCat('cafe', cafeRule, true), homeCat('bus', busRule), homeCat('etc', { kind: 'manual' })],
  todaySpend, weekSpend, dayBudget, MON, WEEK_FROM, WEEK_TO,
)
assert.deepEqual(hidden.map((r) => r.categoryId), ['food', 'bus', null])
assert.equal(hidden[2].allowance, freeRow.allowance + 5_000) // 카페 하루 몫이 자유로
assert.equal(hidden[2].spent, 35_000) // 카페 지출도 자유에서 빠진다
console.log('하루 몫 분해 (기간별 예산, 주/일 한도, 건수, 자유 흡수) 통과')

// --- CSV 생성 ---
const csv = buildCsv(
  [
    { ...tx('2026-09-13', 12000, 'expense', 'food', '점심'), isPlanned: false },
    { ...tx('2026-09-01', 5000, 'expense', null, '콤마,와 "따옴표"') },
  ],
  categories,
)
const csvLines = csv.split('\n')
assert.equal(csvLines[0], 'date,type,category,amount,memo,is_planned')
assert.equal(csvLines[1], '2026-09-01,expense,,5000,"콤마,와 ""따옴표""",false') // 날짜순 정렬 + 이스케이프
assert.equal(csvLines[2], '2026-09-13,expense,식비,12000,점심,false')
console.log('CSV 생성 (컬럼 순서, 정렬, 이스케이프) 통과')

console.log('\n모든 검산 통과')
