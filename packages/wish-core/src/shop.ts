// 상점. 잔액 검증과 구매가 만들 원장 줄만 만든다. 전부 순수 함수.
//
// 여기서 만든 줄을 실제로 저장하는 것은 `wish-bridge`의 `buyItem`이고, 그쪽은
// 화면이 들고 있던 잔액을 믿지 않고 원장을 다시 합산해 이 함수들을 한 번 더 부른다.

import { ITEMS, ITEM_IDS, type ItemId } from './items.ts'
import type { DustRow } from './dust.ts'

export interface ShopEntry {
  itemId: ItemId
  price: number
  owned: boolean
}

/**
 * 상점 목록. `source: 'shop'`인 것만 오른다 — 상자·레벨·지역 전용은 상점에 없다.
 * 카탈로그 전체는 꾸미기 화면이 획득처와 함께 보여 준다(스펙 §6).
 *
 * 보유한 것도 목록에서 빼지 않고 `owned`로만 표시한다(§7 「보유 중」). 순서는 항상
 * 카탈로그 순서다 — 보유한 것을 뒤로 밀면 구매 직후 격자가 재배치되며 튄다.
 */
export function shopItems(owned: readonly string[]): ShopEntry[] {
  const has = new Set(owned)
  return ITEM_IDS
    .filter((itemId) => ITEMS[itemId].source === 'shop')
    .map((itemId) => ({ itemId, price: ITEMS[itemId].price ?? 0, owned: has.has(itemId) }))
}

/** 상점에 오르지 않는 아이템은 undefined */
export function priceOf(itemId: string): number | undefined {
  const def = ITEMS[itemId as ItemId]
  return def?.source === 'shop' ? def.price : undefined
}

export type BuyRefusal = 'owned' | 'notForSale' | 'poor'
export type BuyCheck = { ok: true; price: number } | { ok: false; reason: BuyRefusal }

/**
 * 구매 가능 판정.
 *
 * `notForSale`이 `owned`보다 먼저다 — 상자·레벨 전용 아이템을 이미 갖고 있을 때
 * 「보유 중」이라고 답하면 팔지 않는 물건이 상점에 있는 것처럼 읽힌다.
 */
export function canBuy(balance: number, itemId: string, owned: readonly string[]): BuyCheck {
  const price = priceOf(itemId)
  if (price === undefined || price <= 0) return { ok: false, reason: 'notForSale' }
  if (owned.includes(itemId)) return { ok: false, reason: 'owned' }
  if (balance < price) return { ok: false, reason: 'poor' }
  return { ok: true, price }
}

/**
 * 구매가 만들 별가루 줄. 이름표가 `purchase:buy:${itemId}`로 고정이라 두 번 눌러도
 * 두 번째는 이미 있는 줄로 걸린다. `ownedItems`의 기본키가 `itemId`라 아이템 쪽도
 * 마찬가지로 걸린다 — 재구매 불가(§7)와 자연히 맞아떨어진다.
 */
export function purchaseRows(itemId: string, now: number): { dust: DustRow } {
  const id = `purchase:buy:${itemId}`
  return {
    dust: {
      id,
      type: 'spend',
      amount: priceOf(itemId) ?? 0,
      sourceType: 'purchase',
      sourceId: id,
      createdAt: now,
    },
  }
}
