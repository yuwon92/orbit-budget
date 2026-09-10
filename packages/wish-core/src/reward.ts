// 레벨 보상. 스펙 orbit-wish-level-reward-spec.md §5 표를 그대로 옮긴 상수와
// 「무엇이 아직 미수령인가」 판정. 전부 순수 함수.
//
// 별가루 수량은 §5 값 그대로다. XP와 달리 별가루는 저장 원장이라, 나중에 이 표의
// 수량을 고쳐도 **이미 수령한 레벨의 지급액은 그대로 남는다**(`dust.ts` 첫 주석).
//
// 슬롯은 여기서 정하지 않는다 — `slotCount(level, completed)`(`xp.ts`)가 계속 유일한
// 판정자다. `LevelReward.slot`은 보상 목록에 글자로 보여 주는 용도일 뿐이다. 슬롯을
// 수령 기록으로 옮기면 「이미 열린 슬롯 유지」(§11)가 깨진다.

import { STARTER_ITEMS, type ItemId } from './items.ts'

export interface LevelReward {
  level: number
  /** 확정 지급 별가루. 이름표는 `level:${level}` */
  dust: number
  /** 확정 지급 아이템 */
  fixed?: ItemId[]
  /** 사용자가 하나를 고른다. 고르는 순간 수령 처리(§5) */
  choice?: { of: ItemId[] }
  /** 상자·티켓. 지급 시점과 개봉 시점을 나눈다(§5). 개봉은 Phase 5 */
  boxes?: { type: BoxType; count: number }[]
  /** 표시용. 실제 판정은 slotCount가 한다 */
  slot?: number
  /** 표시용. 지역은 아직 저장 개념이 없다 */
  region?: string
}

export type BoxType = 'normal' | 'rare' | 'premium'

/**
 * Lv.1~20 보상표. §5의 「보상 유형과 배치 원칙」을 그대로 지킨다.
 *
 * 확정 아이템과 선택형 풀은 서로 겹치지 않는다 — 같은 아이템이 두 레벨에 걸리면
 * 두 번째 지급이 「이미 보유」로 조용히 사라지고 사용자는 보상을 못 받은 것으로 읽는다.
 * 확정 쪽은 `source: 'level'`, 선택형 풀은 `source: 'shop'`으로 카탈로그에서도 갈라 뒀다.
 */
export const LEVEL_REWARDS: Record<number, LevelReward> = {
  1: { level: 1, dust: 100, fixed: [...STARTER_ITEMS] },
  2: {
    level: 2,
    dust: 100,
    slot: 2,
    choice: { of: ['background-dust-cloud', 'companion-pebble', 'effect-twinkle'] },
  },
  3: {
    level: 3,
    dust: 120,
    choice: { of: ['planet-color-mint', 'planet-color-coral', 'planet-color-lavender'] },
  },
  4: { level: 4, dust: 150, slot: 3, boxes: [{ type: 'normal', count: 1 }] },
  5: { level: 5, dust: 180, fixed: ['ring-double'] },
  6: {
    level: 6,
    dust: 200,
    choice: { of: ['background-constellation', 'background-nebula', 'background-deepspace'] },
  },
  7: { level: 7, dust: 220, fixed: ['companion-moonlet'] },
  8: {
    level: 8,
    dust: 250,
    choice: { of: ['planet-pattern-stripe', 'planet-pattern-crystal', 'planet-pattern-swirl'] },
    boxes: [{ type: 'normal', count: 1 }],
  },
  9: {
    level: 9,
    dust: 280,
    choice: { of: ['companion-star-cluster', 'companion-probe', 'companion-meteor'] },
  },
  10: { level: 10, dust: 350, fixed: ['background-lunar'], region: '달빛 전초기지' },
  11: { level: 11, dust: 300, fixed: ['effect-stardust'] },
  12: {
    level: 12,
    dust: 320,
    choice: { of: ['effect-halo', 'effect-glimmer', 'effect-shooting-star'] },
    boxes: [{ type: 'normal', count: 1 }],
  },
  13: { level: 13, dust: 500 },
  14: { level: 14, dust: 380, boxes: [{ type: 'rare', count: 1 }] },
  15: { level: 15, dust: 450, fixed: ['companion-comet'] },
  16: { level: 16, dust: 420, boxes: [{ type: 'normal', count: 2 }] },
  17: { level: 17, dust: 450, fixed: ['effect-comet-trail'] },
  18: {
    level: 18,
    dust: 500,
    choice: { of: ['background-twin-moons', 'ring-debris', 'companion-shuttle'] },
  },
  19: { level: 19, dust: 800 },
  20: {
    level: 20,
    dust: 800,
    fixed: ['planet-color-aurora'],
    boxes: [{ type: 'premium', count: 1 }],
    region: '성운 정거장',
  },
}

export const MAX_REWARD_LEVEL = 20

/** 지급 이름표. 결정적이어야 한다 — 같은 레벨이면 언제 만들어도 같은 값 */
export const levelDustId = (level: number): string => `level:${level}`

/**
 * 아직 수령 기록이 없는 레벨. 현재 레벨을 넘지 않는다.
 *
 * 이미 레벨이 오른 채로 보상 기능을 만나는 기존 사용자를 위한 계산이다. 지난
 * 레벨의 보상을 자동으로 지급하지 않는다 — 레벨 보상에는 고르는 것이 섞여 있어서
 * 대신 골라 주면 안 된다. 미수령분은 관측소 보상 카드에 쌓아 두고 직접 받게 한다.
 */
export function unclaimedLevels(level: number, claimed: number[]): number[] {
  const done = new Set(claimed)
  return Array.from({ length: Math.max(0, Math.min(level, MAX_REWARD_LEVEL)) }, (_, index) => index + 1)
    .filter((value) => !done.has(value))
}

/** 이 레벨의 보상이 고르는 것을 요구하는가. 요구하면 선택 없이 수령할 수 없다 */
export const needsChoice = (level: number): boolean => Boolean(LEVEL_REWARDS[level]?.choice)

/**
 * 다음에 올 보상. 미리보기 카드에 쓴다(§9).
 * 최고 레벨에 닿으면 undefined — 화면은 그때 「보상 전부 수령」으로 바꾼다.
 */
export function nextMajorReward(level: number): LevelReward | undefined {
  for (let next = level + 1; next <= MAX_REWARD_LEVEL; next += 1) {
    const reward = LEVEL_REWARDS[next]
    if (reward && (reward.fixed?.length || reward.choice || reward.boxes?.length || reward.region)) return reward
  }
  return undefined
}

/**
 * 선택형 보상에서 고른 값이 유효한가. 저장 창구가 이걸 통과한 것만 지급한다 —
 * 화면을 우회해 아무 아이템이나 들어오는 것을 막는다.
 */
export function isValidChoice(level: number, itemId: string | undefined): boolean {
  const reward = LEVEL_REWARDS[level]
  if (!reward?.choice) return itemId === undefined
  return itemId !== undefined && reward.choice.of.includes(itemId as ItemId)
}

/** 그 레벨이 실제로 지급할 아이템. 선택형은 고른 것 하나만 */
export function itemsOfLevel(level: number, chosen?: string): ItemId[] {
  const reward = LEVEL_REWARDS[level]
  if (!reward) return []
  const fixed = reward.fixed ?? []
  if (!reward.choice || chosen === undefined) return [...fixed]
  return [...fixed, chosen as ItemId]
}
