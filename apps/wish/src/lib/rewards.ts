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

export const summarizeLevel = (level: number): string => {
  const reward = LEVEL_REWARDS[level]
  return reward ? summarizeReward(reward) : ''
}
