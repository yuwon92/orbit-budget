// 아이템 미리보기 인자. 꾸미기·상점·레벨 보상이 같은 그림을 써야 한다 —
// 상점에서 본 모습과 장착한 뒤 모습이 다르면 안 된다(스펙 §6).
import { ITEMS, type ItemCategory, type ItemId } from '@orbit/wish-core/items'

/**
 * 미리보기는 성계 단계로 고정한다. 링·동료·효과가 각각 고리·위성대·성계 단계부터
 * 나와서, 진행 중 단계로 그리면 장착해도 아무 변화가 없는 칸이 생긴다.
 */
export const PREVIEW_PROGRESS = 100
export const PREVIEW_SEED = 7

export type EquippedItems = Partial<Record<ItemCategory, ItemId>>

/** 장착 상태를 바탕으로 그 아이템의 칸만 갈아 끼운다 */
export function previewProps(items: EquippedItems, itemId: ItemId, size: number) {
  const category = ITEMS[itemId].category
  const pick = (target: ItemCategory) => (category === target ? itemId : items[target])
  return {
    progress: PREVIEW_PROGRESS,
    seed: PREVIEW_SEED,
    size,
    planetColorId: pick('planetColor'),
    planetPatternId: pick('planetPattern'),
    ringId: pick('ring'),
    backgroundId: pick('background'),
    companionId: pick('companion'),
    effectId: pick('effect'),
  }
}
