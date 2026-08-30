import Dexie, { type EntityTable } from 'dexie'
import type { Category, MonthSettings, RecurringRule, Transaction } from './types'

// UI 가이드 §20 카테고리 팔레트
export const CATEGORY_PALETTE = [
  '#8ebeff', // Food
  '#b7a7f8', // Cafe
  '#83dad8', // Transport
  '#c4a8e7', // Subscription
  '#e6b8dc', // Beauty
  '#95b7e9', // Investment
  '#a8aebb', // Other
]

export const db = new Dexie('orbital-budget') as Dexie & {
  categories: EntityTable<Category, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  recurringRules: EntityTable<RecurringRule, 'id'>
  monthSettings: EntityTable<MonthSettings, 'yearMonth'>
}

db.version(1).stores({
  categories: 'id',
  transactions: 'id, date, categoryId',
  recurringRules: 'id',
  monthSettings: 'yearMonth',
})

// v2: 스키마 변경 없음. 기존 DB에 반복 거래 시드를 한 번만 넣기 위한 업그레이드.
db.version(2).stores({}).upgrade(async (tx) => {
  const count = await tx.table('recurringRules').count()
  if (count > 0) return
  const categories = await tx.table('categories').toArray()
  const subsId = categories.find((c) => c.name === '구독')?.id ?? null
  await tx.table('recurringRules').bulkAdd(seedRecurringRules(subsId))
})

// 앱 가이드 §8 초기 카테고리. DB가 처음 만들어질 때 한 번만 들어간다.
const seedCategories: Omit<Category, 'id'>[] = [
  { name: '식비', monthlyBudget: 258000, color: '#8ebeff', isFixed: true, sortOrder: 0 },
  { name: '카페', monthlyBudget: 43000, color: '#b7a7f8', isFixed: true, sortOrder: 1 },
  { name: '교통비', monthlyBudget: 19970, color: '#83dad8', isFixed: true, sortOrder: 2 },
  { name: '구독', monthlyBudget: 58490, color: '#c4a8e7', isFixed: true, sortOrder: 3 },
  { name: '미용', monthlyBudget: 35000, color: '#e6b8dc', isFixed: true, sortOrder: 4 },
  { name: '투자', monthlyBudget: 20000, color: '#95b7e9', isFixed: true, sortOrder: 5 },
  { name: '기타', monthlyBudget: 0, color: '#a8aebb', isFixed: false, sortOrder: 6 },
]

// 앱 가이드 §8 반복 거래. 2026년 9월부터 시작한다.
function seedRecurringRules(subscriptionCategoryId: string | null): RecurringRule[] {
  const rule = (
    name: string,
    amount: number,
    type: 'expense' | 'income',
    categoryId: string | null,
    dayOfMonth: number,
  ): RecurringRule => ({
    id: crypto.randomUUID(),
    name,
    amount,
    type,
    categoryId,
    dayOfMonth,
    startDate: '2026-09-01',
    endDate: null,
    lastGeneratedMonth: null,
  })
  return [
    rule('용돈', 700000, 'income', null, 1),
    rule('구독 A', 9900, 'expense', subscriptionCategoryId, 8),
    rule('구독 B', 2500, 'expense', subscriptionCategoryId, 17),
    rule('구독 C', 1100, 'expense', subscriptionCategoryId, 21),
    rule('구독 D', 13990, 'expense', subscriptionCategoryId, 21),
    rule('해외 구독', 31000, 'expense', subscriptionCategoryId, 30),
  ]
}

db.on('populate', (tx) => {
  const categories = seedCategories.map((c) => ({ ...c, id: crypto.randomUUID() }))
  tx.table('categories').bulkAdd(categories)
  const subsId = categories.find((c) => c.name === '구독')?.id ?? null
  tx.table('recurringRules').bulkAdd(seedRecurringRules(subsId))
})
