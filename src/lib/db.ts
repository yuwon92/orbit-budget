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

db.on('populate', (tx) => {
  tx.table('categories').bulkAdd(seedCategories.map((c) => ({ ...c, id: crypto.randomUUID() })))
})
