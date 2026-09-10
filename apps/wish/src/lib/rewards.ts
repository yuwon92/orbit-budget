// 레벨 보상 한국어 카피. 수량·아이템 id는 @orbit/wish-core/reward에 있고
// 여기에는 그 결과를 읽는 문구만 둔다. labels.ts·items.ts와 같은 갈래다.
import { LEVEL_REWARDS, type BoxType, type LevelReward } from '@orbit/wish-core/reward'
import { ITEM_LABELS } from './items'
import type { ItemId } from '@orbit/wish-core/items'

export const BOX_LABELS: Record<BoxType, string> = {
  normal: '코스믹 박스',
  rare: '희귀 확정 상자',
  premium: '프리미엄 박스',
}

/** 상자 한 줄 설명과 아이콘. 개봉 화면의 카드가 읽는다 */
export const BOX_DETAILS: Record<BoxType, { icon: string; detail: string }> = {
  normal: { icon: '📦', detail: '일반 중심 · 낮은 영웅 확률' },
  rare: { icon: '🎁', detail: '희귀 이상 확정' },
  premium: { icon: '💎', detail: '영웅 중심 · 최상위 상자' },
}

/** 좋은 상자부터. 여러 장이 섞여 있을 때 먼저 열 것이 위로 온다 */
export const BOX_ORDER: BoxType[] = ['premium', 'rare', 'normal']

/** 레벨마다 붙는 이름. §5의 「유형」 칸을 사람이 읽는 말로 옮긴 것 */
export const LEVEL_REWARD_TITLES: Record<number, string> = {
  1: '관측자 스타터 세트',
  2: '궤도 슬롯과 첫 꾸미기',
  3: '행성 색 개방',
  4: '궤도 슬롯과 첫 상자',
  5: '별빛 궤도 링',
  6: '성계 배경 개방',
  7: '첫 동료',
  8: '행성 무늬 개방',
  9: '동료 확장',
  10: '달빛 전초기지',
  11: '별가루 효과',
  12: '별빛 효과 개방',
  13: '별가루 보너스',
  14: '희귀 확정 상자',
  15: '희귀 동료',
  16: '상자 두 장',
  17: '희귀 효과',
  18: '희귀 직접 선택',
  19: '별가루 대량 보너스',
  20: '성운 정거장',
}

export const titleOfLevel = (level: number): string => LEVEL_REWARD_TITLES[level] ?? `Lv.${level} 보상`

const nameOf = (itemId: ItemId) => ITEM_LABELS[itemId]?.name ?? itemId

/**
 * 보상 한 줄 요약. 명사형으로 `·`로 잇는다.
 * 선택형은 「3종 중 선택」으로만 적는다 — 목록은 수령 화면이 보여 준다.
 */
export function summarizeReward(reward: LevelReward): string {
  const parts = [`별가루 ${reward.dust.toLocaleString('ko-KR')}`]
  if (reward.slot) parts.push(`위시 슬롯 ${reward.slot}`)
  if (reward.fixed?.length) parts.push(reward.fixed.map(nameOf).join(' · '))
  if (reward.choice) parts.push(`${reward.choice.of.length}종 중 선택`)
  for (const slot of reward.boxes ?? []) {
    parts.push(slot.count > 1 ? `${BOX_LABELS[slot.type]} ${slot.count}장` : BOX_LABELS[slot.type])
  }
  if (reward.region) parts.push(`신규 지역 ${reward.region}`)
  return parts.join(' · ')
}

/**
 * 그 아이템을 주는 레벨. 확정 지급과 선택형 풀을 함께 본다.
 *
 * 꾸미기에서 미보유 아이템을 눌렀을 때 「어디서 얻는가」를 답하는 데 쓴다. 카탈로그의
 * `source`는 갈래만 알려 주지 몇 레벨인지는 모른다 — 보상표를 거꾸로 읽는 곳이 여기다.
 * 같은 아이템이 두 레벨에 걸리지 않는 것은 검산이 지킨다(`verify-wish.ts`).
 */
const LEVEL_OF_ITEM = new Map<string, number>()
for (const reward of Object.values(LEVEL_REWARDS)) {
  for (const itemId of reward.fixed ?? []) LEVEL_OF_ITEM.set(itemId, reward.level)
  for (const itemId of reward.choice?.of ?? []) LEVEL_OF_ITEM.set(itemId, reward.level)
}

export const levelOfItem = (itemId: ItemId): number | undefined => LEVEL_OF_ITEM.get(itemId)

/** 그 레벨에서 고르는 보상인가. 「3종 중 하나로 선택」과 확정 지급을 가른다 */
export const isChoiceItem = (itemId: ItemId): boolean => {
  const level = LEVEL_OF_ITEM.get(itemId)
  return level !== undefined && Boolean(LEVEL_REWARDS[level]?.choice?.of.includes(itemId))
}

export const summarizeLevel = (level: number): string => {
  const reward = LEVEL_REWARDS[level]
  return reward ? summarizeReward(reward) : ''
}
