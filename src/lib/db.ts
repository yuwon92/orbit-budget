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

// v2: 스키마 변경 없음. 예전에는 여기서 반복 거래를 시드했으나 지금은 넣지 않는다.
// 이미 v2로 올라간 DB가 열리려면 이 선언 자체는 남아 있어야 한다.
db.version(2).stores({})

// 기본 카테고리. 예산 금액은 사용자가 직접 정하도록 0(미설정)으로 둔다.
const seedCategories: Omit<Category, 'id'>[] = [
  { name: '식비', monthlyBudget: 0, color: '#8ebeff', isFixed: false, sortOrder: 0 },
  { name: '교통비', monthlyBudget: 0, color: '#83dad8', isFixed: false, sortOrder: 1 },
  { name: '구독', monthlyBudget: 0, color: '#c4a8e7', isFixed: true, sortOrder: 2 },
  { name: '카페', monthlyBudget: 0, color: '#b7a7f8', isFixed: false, sortOrder: 3 },
]

db.on('populate', (tx) => {
  tx.table('categories').bulkAdd(seedCategories.map((c) => ({ ...c, id: crypto.randomUUID() })))
})

/**
 * 브라우저가 저장소를 임의로 비우지 않도록 요청한다.
 * 승인 여부는 브라우저가 결정하며(설치 여부, 사용 빈도 등), 거부돼도 앱 동작에는 영향이 없다.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}
