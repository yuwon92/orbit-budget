// 꾸미기 아이템 카탈로그. 스펙 orbit-wish-level-reward-spec.md §6. 전부 순수 데이터·순수 함수.
//
// 한국어 이름은 `apps/wish/src/lib/items.ts`, 그리기 값은 `apps/wish/src/cosmetics.ts`에
// 있다. id·희귀도·가격·획득처만 여기 둔다 — 가격은 구매 검증, 희귀도는 상자 추첨,
// 카테고리는 장착 판정에 쓰이고 검산 스크립트가 이 파일을 읽는다.
// `TITLE_IDS`(core) / `TITLES`(app)와 같은 갈래다.
//
// 두 곳의 키가 어긋나면 `Record<ItemId, …>` 타입이 빌드 단계에서 막는다.
//
// 획득처 규칙 — 레벨 보상표(`reward.ts`)와 상점 재고가 겹치지 않게 가른다.
//
// - `level`: 스타터 5종 + 확정 보상 아이템(Lv.5·7·10·11·15·17·20). 상점에 오르지 않는다.
//   레벨을 올려야만 얻는 것이 있어야 보상표가 무게를 갖는다
// - `shop`: 선택형 보상 풀(Lv.2·3·6·8·9·12·18)에 든 것 전부. 레벨에서 하나를 공짜로
//   고르거나 별가루로 산다. 상점 재고가 여기서 나온다
// - `box`·`rareBox`·`region`: 아직 없다. Phase 5가 상자 추첨표와 함께 전용 아이템을 넣는다

/** 동시 장착은 카테고리당 하나. 해제는 그 카테고리의 장착 줄을 지운다 */
export const CATEGORIES = [
  'planetColor',
  'planetPattern',
  'ring',
  'background',
  'companion',
  'effect',
] as const
export type ItemCategory = (typeof CATEGORIES)[number]

export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const
export type Rarity = (typeof RARITIES)[number]

/** 획득처. 상점 목록·보관함에서 「어디서 얻는가」로 그대로 보여 준다 */
export type ItemSource = 'shop' | 'box' | 'rareBox' | 'level' | 'region'

export interface ItemDef {
  category: ItemCategory
  rarity: Rarity
  source: ItemSource
  /** 별가루 가격. `source: 'shop'`인 것만 갖는다 */
  price?: number
}

/**
 * 가격 사다리. 스펙 §7은 고정 숫자가 아니라 「하나를 얻는 데 걸리는 기간」을 정했다.
 * 기준 사용자(하루 몫 매일 5 + 넘기기 주 2회 30/7 + 연속 7일 30/7)가 하루 약 13.6을
 * 모으므로 하루 14로 잡고 목표 기간을 곱한 값이다.
 *
 * common 4~7일(54~95) · rare 2~3주(190~285) · epic 3~5주(285~476). 각 구간의
 * 가운데를 잡았다. legendary는 값을 두지 않는다 — 레벨·지역 이정표 전용이라
 * 상점에 오르지 않는다.
 */
export const PRICES = { common: 80, rare: 240, epic: 400 } as const

const CATALOG = {
  // ── 행성 색상 ──
  'planet-color-solar': { category: 'planetColor', rarity: 'common', source: 'level' },
  'planet-color-mint': { category: 'planetColor', rarity: 'common', source: 'shop', price: PRICES.common },
  'planet-color-coral': { category: 'planetColor', rarity: 'common', source: 'shop', price: PRICES.common },
  'planet-color-lavender': { category: 'planetColor', rarity: 'common', source: 'shop', price: PRICES.common },
  'planet-color-aurora': { category: 'planetColor', rarity: 'legendary', source: 'level' },

  // ── 행성 무늬 ──
  'planet-pattern-crater': { category: 'planetPattern', rarity: 'common', source: 'level' },
  'planet-pattern-stripe': { category: 'planetPattern', rarity: 'common', source: 'shop', price: PRICES.common },
  'planet-pattern-crystal': { category: 'planetPattern', rarity: 'rare', source: 'shop', price: PRICES.rare },
  'planet-pattern-swirl': { category: 'planetPattern', rarity: 'rare', source: 'shop', price: PRICES.rare },

  // ── 궤도 링 ──
  'ring-single': { category: 'ring', rarity: 'common', source: 'level' },
  'ring-double': { category: 'ring', rarity: 'rare', source: 'level' },
  'ring-debris': { category: 'ring', rarity: 'rare', source: 'shop', price: PRICES.rare },

  // ── 배경 ──
  'background-starfield': { category: 'background', rarity: 'common', source: 'level' },
  'background-dust-cloud': { category: 'background', rarity: 'common', source: 'shop', price: PRICES.common },
  'background-constellation': { category: 'background', rarity: 'rare', source: 'shop', price: PRICES.rare },
  'background-twin-moons': { category: 'background', rarity: 'rare', source: 'shop', price: PRICES.rare },
  'background-nebula': { category: 'background', rarity: 'epic', source: 'shop', price: PRICES.epic },
  'background-deepspace': { category: 'background', rarity: 'epic', source: 'shop', price: PRICES.epic },
  'background-lunar': { category: 'background', rarity: 'rare', source: 'level' },

  // ── 위성·동료 ──
  'companion-pebble': { category: 'companion', rarity: 'common', source: 'shop', price: PRICES.common },
  'companion-star-cluster': { category: 'companion', rarity: 'common', source: 'shop', price: PRICES.common },
  'companion-probe': { category: 'companion', rarity: 'rare', source: 'shop', price: PRICES.rare },
  'companion-meteor': { category: 'companion', rarity: 'rare', source: 'shop', price: PRICES.rare },
  'companion-shuttle': { category: 'companion', rarity: 'rare', source: 'shop', price: PRICES.rare },
  'companion-moonlet': { category: 'companion', rarity: 'common', source: 'level' },
  'companion-comet': { category: 'companion', rarity: 'rare', source: 'level' },

  // ── 효과·흔적 ──
  'effect-sparkles': { category: 'effect', rarity: 'common', source: 'level' },
  'effect-twinkle': { category: 'effect', rarity: 'common', source: 'shop', price: PRICES.common },
  'effect-halo': { category: 'effect', rarity: 'rare', source: 'shop', price: PRICES.rare },
  'effect-glimmer': { category: 'effect', rarity: 'rare', source: 'shop', price: PRICES.rare },
  'effect-shooting-star': { category: 'effect', rarity: 'epic', source: 'shop', price: PRICES.epic },
  'effect-stardust': { category: 'effect', rarity: 'rare', source: 'level' },
  'effect-comet-trail': { category: 'effect', rarity: 'rare', source: 'level' },
} as const satisfies Record<string, ItemDef>

export type ItemId = keyof typeof CATALOG

/**
 * `as const`로 좁힌 정의를 `ItemDef`로 다시 넓혀 내보낸다. 좁은 채로 두면 값마다
 * 타입이 달라져 `price`가 없는 아이템에서 `ITEMS[id].price`가 컴파일되지 않는다.
 * id 목록은 좁힌 쪽에서 뽑으므로 오타는 여전히 빌드가 잡는다.
 */
export const ITEMS: Record<ItemId, ItemDef> = CATALOG

export const ITEM_IDS = Object.keys(CATALOG) as ItemId[]

/**
 * Lv.1 `관측자 스타터 세트`. 처음 앱을 열 때 보유·장착 상태로 들어간다.
 *
 * 위성·동료는 넣지 않는다 — 스펙 §5 Lv.1은 행성·배경·링이고, 동료 자리를 비워 둬야
 * 상점과 Lv.7 보상이 처음 채우는 자리가 된다. 무늬와 효과는 지금 그리기를 유지하려고
 * 넣는다. 무늬를 빼면 표면이 민무늬가 되고, 효과를 빼면 배경이 완주 별 자리를
 * 덮으면서 완주 표시가 통째로 사라진다.
 */
export const STARTER_ITEMS: ItemId[] = [
  'planet-color-solar',
  'planet-pattern-crater',
  'ring-single',
  'background-starfield',
  'effect-sparkles',
]

/** 그 카테고리의 아이템 전부. 상점·꾸미기 그리드가 이 순서로 보여 준다 */
export function itemsOfCategory(category: ItemCategory): ItemId[] {
  return ITEM_IDS.filter((id) => ITEMS[id].category === category)
}

/**
 * 카테고리의 기본 아이템. 장착 줄에 카탈로그에 없는 id가 남았을 때 대신 그린다.
 * 카테고리마다 반드시 하나 있어야 한다 — 없으면 대체할 것이 없어 화면이 빈다.
 */
export function defaultItemFor(category: ItemCategory): ItemId {
  return DEFAULTS[category]
}

const DEFAULTS: Record<ItemCategory, ItemId> = {
  planetColor: 'planet-color-solar',
  planetPattern: 'planet-pattern-crater',
  ring: 'ring-single',
  background: 'background-starfield',
  companion: 'companion-moonlet',
  effect: 'effect-sparkles',
}

/** 이 아이템이 들어갈 장착 자리. 카탈로그에 없는 id면 undefined */
export function equipTargetOf(itemId: string): ItemCategory | undefined {
  return ITEMS[itemId as ItemId]?.category
}

export const priceOf = (itemId: ItemId): number | undefined => ITEMS[itemId].price

/**
 * 저장된 장착 줄을 카테고리별 아이템으로 편다.
 *
 * 카탈로그에서 빠진 아이템은 `defaultItemFor`로 대신 그린다. **저장 줄은 지우지
 * 않는다** — 나중에 카탈로그를 되살리면 장착이 그대로 돌아오게.
 */
export function equippedMap(
  rows: readonly { category: string; itemId: string }[],
): Partial<Record<ItemCategory, ItemId>> {
  const map: Partial<Record<ItemCategory, ItemId>> = {}
  for (const row of rows) {
    const category = CATEGORIES.find((value) => value === row.category)
    if (!category) continue
    const fits = ITEMS[row.itemId as ItemId]?.category === category
    map[category] = fits ? (row.itemId as ItemId) : defaultItemFor(category)
  }
  return map
}
