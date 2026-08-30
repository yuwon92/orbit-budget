// 앱 가이드 §8 초기 데이터로 계산 로직을 검산한다.
// 실행: npm run verify
import assert from 'node:assert/strict'
import {
  availableAmount,
  calcTodayBudget,
  categoryProgress,
  freeBudget,
  occurredExpense,
  occurrenceDate,
  remainingDays,
  remainingToday,
  spentByCategory,
  spentOnDate,
  totalIncome,
  upcomingExpense,
} from '../src/lib/budget.ts'
import { buildCsv } from '../src/lib/csv.ts'
import type { Category, Transaction } from '../src/lib/types.ts'

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
