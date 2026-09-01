import Dexie, { type EntityTable } from 'dexie'
import { quickSlotCategories } from './budget'
import type { Category, MonthSettings, RecurringRule, Transaction } from './types'

// UI 가이드 §20 카테고리 팔레트
export const CATEGORY_PALETTE = [
  '#79a7f2', // Food · sky blue
  '#e5b66f', // Cafe · amber
  '#62c7c2', // Transport · teal
  '#a98be8', // Subscription · violet
  '#d995bc', // Beauty · rose
  '#8fbc91', // Investment · sage
  '#9aa3b4', // Other · slate
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

// v3: 서로 비슷했던 파랑·보라 계열을 색상각이 분명한 새 팔레트로 한 번만 교체한다.
// 사용자가 팔레트 밖의 사용자 지정 색을 쓰고 있다면 그대로 보존한다.
const categoryColorMigration: Record<string, string> = {
  '#8ebeff': '#79a7f2',
  '#b7a7f8': '#e5b66f',
  '#83dad8': '#62c7c2',
  '#c4a8e7': '#a98be8',
  '#e6b8dc': '#d995bc',
  '#95b7e9': '#8fbc91',
  '#a8aebb': '#9aa3b4',
}

db.version(3).stores({}).upgrade((tx) =>
  tx.table<Category>('categories').toCollection().modify((category) => {
    const migratedColor = categoryColorMigration[category.color.toLowerCase()]
    if (migratedColor) category.color = migratedColor
  }),
)

// 기본 카테고리. 예산 금액은 사용자가 직접 정하도록 0(미설정)으로 둔다.
const seedCategories: Omit<Category, 'id'>[] = [
  { name: '식비', monthlyBudget: 0, color: '#79a7f2', isFixed: false, sortOrder: 0 },
  { name: '교통비', monthlyBudget: 0, color: '#62c7c2', isFixed: false, sortOrder: 1 },
  { name: '구독', monthlyBudget: 0, color: '#a98be8', isFixed: true, sortOrder: 2 },
  { name: '카페', monthlyBudget: 0, color: '#e5b66f', isFixed: false, sortOrder: 3 },
]

db.on('populate', (tx) => {
  tx.table('categories').bulkAdd(seedCategories.map((c) => ({ ...c, id: crypto.randomUUID() })))
})

/**
 * 퀵 슬롯에 넣거나 뺀다. 새로 넣은 카테고리는 항상 줄 맨 뒤에 붙는다.
 * 넣을 때 나머지 슬롯의 순서도 0..n-1로 다시 매긴다. 순서를 한 번도 안 바꾼 슬롯은
 * quickOrder가 없어서, 새 슬롯에만 번호를 주면 그 하나가 맨 앞으로 튀기 때문이다.
 */
export async function setQuickSlot(categories: Category[], category: Category, on: boolean) {
  await db.transaction('rw', db.categories, async () => {
    if (!on) {
      await db.categories.update(category.id, { quickSlot: false })
      return
    }
    const others = quickSlotCategories(categories).filter((c) => c.id !== category.id)
    await Promise.all(others.map((c, i) => db.categories.update(c.id, { quickOrder: i })))
    await db.categories.update(category.id, { quickSlot: true, quickOrder: others.length })
  })
}

/** 퀵 슬롯 구슬을 한 칸 앞(-1)이나 뒤(+1)로 옮긴다. 줄 끝에서는 아무것도 하지 않는다. */
export async function moveQuickSlot(categories: Category[], categoryId: string, delta: number) {
  const slots = quickSlotCategories(categories)
  const from = slots.findIndex((c) => c.id === categoryId)
  const to = from + delta
  if (from < 0 || to < 0 || to >= slots.length) return
  const next = [...slots]
  next[from] = slots[to]
  next[to] = slots[from]
  await db.transaction('rw', db.categories, () =>
    Promise.all(next.map((c, i) => db.categories.update(c.id, { quickOrder: i }))),
  )
}

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
