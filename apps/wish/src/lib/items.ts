// 아이템 한국어 이름. id·카테고리·희귀도·가격은 @orbit/wish-core/items에 있고
// 여기에는 그 결과에 붙는 이름만 둔다. labels.ts의 TITLES와 같은 갈래다.
// 두 곳의 키가 어긋나면 Record<ItemId, …>가 빌드 단계에서 막는다.
import type { ItemCategory, ItemId, ItemSource, Rarity } from '@orbit/wish-core/items'

export const ITEM_LABELS: Record<ItemId, { name: string; detail: string }> = {
  'planet-color-solar': { name: '기본 태양색', detail: '노랑 4단' },
  'planet-color-mint': { name: '민트', detail: '청록 4단' },
  'planet-color-coral': { name: '코랄', detail: '주홍 4단' },
  'planet-color-lavender': { name: '라벤더', detail: '보라 4단' },
  'planet-color-aurora': { name: '오로라', detail: '색상까지 도는 4단' },

  'planet-pattern-crater': { name: '크레이터', detail: '씨앗별 표면 자국' },
  'planet-pattern-stripe': { name: '줄무늬', detail: '위도 방향 띠' },
  'planet-pattern-crystal': { name: '결정', detail: '각진 마름모 면' },

  'ring-single': { name: '기본 링', detail: '단일 고리' },
  'ring-double': { name: '별빛 궤도 링', detail: '안팎 두 겹' },
  'ring-debris': { name: '파편 링', detail: '끊긴 점선 조각' },

  'background-starfield': { name: '기본 별밭', detail: '십자별 · 네모별' },
  'background-constellation': { name: '별자리', detail: '연결선 두 갈래' },
  'background-nebula': { name: '성운', detail: '푸른 띠 · 흩어진 별' },

  'companion-moonlet': { name: '꼬마 위성', detail: '흙색 6×6 원판' },
  'companion-star-cluster': { name: '작은 별 무리', detail: '행성 색을 따르는 별 셋' },
  'companion-probe': { name: '탐사 안테나', detail: '접시 · 태양 날개' },
  'companion-meteor': { name: '유성 조각', detail: '돌덩이 · 불꼬리' },

  'effect-sparkles': { name: '반짝이는 별', detail: '완주 뒤 십자 반짝임' },
  'effect-comet-trail': { name: '혜성의 궤적', detail: '완주 뒤 긴 꼬리' },
}

export const CATEGORY_LABELS: Record<ItemCategory, { name: string; detail: string }> = {
  planetColor: { name: '행성 색', detail: '몸통 · 고리 4단 색' },
  planetPattern: { name: '무늬', detail: '표면 자국' },
  ring: { name: '궤도 링', detail: '고리 단계부터' },
  background: { name: '배경', detail: '위아래 모서리' },
  companion: { name: '동료', detail: '위성대 단계부터' },
  effect: { name: '효과', detail: '완주 뒤에만' },
}

export const RARITY_LABELS: Record<Rarity, string> = {
  common: '일반',
  rare: '희귀',
  epic: '영웅',
  legendary: '전설',
}

/** 희귀도 색 점. 글자에 배경색을 깔지 않는다(AGENTS.md 스타일 규칙) */
export const RARITY_DOTS: Record<Rarity, string> = {
  common: '#9AA3AF',
  rare: '#4F9BE8',
  epic: '#9674D4',
  legendary: '#E0973A',
}

export const SOURCE_LABELS: Record<ItemSource, string> = {
  shop: '상점',
  box: '코스믹 박스',
  rareBox: '희귀 확정 상자',
  level: '레벨 보상',
  region: '지역 전용',
}
