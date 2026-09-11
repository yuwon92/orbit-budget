// 코스믹 박스 추첨. 스펙 orbit-wish-level-reward-spec.md §8. 전부 순수 함수.
//
// 무엇을 계산하는가 — 상자 한 장이 무엇을 줄지. 등급 확률 → 미보유 우선 → 그래도
// 남는 것이 없으면 중복 + 별가루 전환. 저장은 `wish-bridge`의 `openBox`가 하고
// 여기서는 결과만 만든다.
//
// ⚠ 난수를 인자로 받는다. 안에서 `Math.random`을 부르면 같은 상자를 다시 굴렸을 때
// 결과가 달라진다 — 저장 트랜잭션이 재시도되면 화면이 본 아이템과 저장된 아이템이
// 갈라진다. 그래서 `openBox`는 `rng(seedFromId(boxId))`를 넣어 준다: 같은 상자는
// 몇 번을 굴려도 같은 결과다.
//
// 풀에는 `source: 'shop'`인 것만 넣는다(§8 「레벨·지역 전용은 일반 상자에 넣지
// 않는다」). 상자 전용 아이템은 아직 카탈로그에 없다 — 생기면 `boxPool`의 획득처
// 조건과 `BOX_ODDS`의 legendary 칸을 함께 연다.

import { ITEMS, ITEM_IDS, PRICES, RARITIES, type ItemId, type Rarity } from './items.ts'
import type { BoxType } from './reward.ts'
import type { DustRow } from './dust.ts'

/**
 * 등급별 등장 확률. 합은 1이고 검산이 지킨다.
 *
 * legendary는 전 상자가 0이다 — 전설은 레벨·지역 이정표 전용이라 상자 풀에 넣을
 * 아이템이 없다(§6). 확률만 열어 두면 뽑을 것이 없는 칸이 생겨 아래 등급으로
 * 조용히 미끄러진다. 전용 전설 아이템이 생기는 날 프리미엄 박스부터 연다.
 */
export const BOX_ODDS: Record<BoxType, Record<Rarity, number>> = {
  normal: { common: 0.72, rare: 0.24, epic: 0.04, legendary: 0 },
  rare: { common: 0, rare: 0.8, epic: 0.2, legendary: 0 },
  premium: { common: 0, rare: 0.45, epic: 0.55, legendary: 0 },
}

/**
 * 상자 가격. 스펙 §7의 목표 기간 「일반 코스믹 박스 = 미션 3~5일」을 기준 사용자
 * 하루 13.6 별가루로 곱한 값이다(41~68 → 60).
 *
 * 상자는 미보유부터 주므로 한 장이 상점 아이템 하나로 바뀐다(상점가 기댓값 약 131).
 * 가격으로 막으려면 §7 기간을 두 배로 늘려야 해서, 값은 두고 주간 한도로 속도를
 * 묶었다(`BOX_WEEKLY_LIMIT`).
 *
 * 희귀 확정·프리미엄은 값이 없다 — 레벨 이정표 전용이라 상점에 오르지 않는다.
 * 값을 두면 Lv.14·20 보상이 「사면 그만인 것」이 된다.
 */
export const BOX_PRICE: Partial<Record<BoxType, number>> = { normal: 60 }

/**
 * 코스믹 박스 주간 구매 한도. 한도가 없으면 모아 둔 별가루를 한꺼번에 상자로 바꿔
 * 상점 재고를 며칠 만에 비운다(60 × 21장 = 1,260, 직접 사면 5,120). 레벨 보상으로
 * 받은 상자는 세지 않는다 — 한도는 상점 구매에만 걸린다.
 */
export const BOX_WEEKLY_LIMIT = 3

/** 그 시각이 속한 주의 월요일 0시(기기 시간대). 한도는 월요일마다 새로 찬다 */
export function weekStartOf(time: number): number {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date.getTime()
}

/** 이번 주에 상점에서 산 상자 수. 열었든 안 열었든 산 것은 센다 */
export const boxesBoughtThisWeek = (
  boxes: readonly { boxId: string; acquiredAt: number }[],
  now: number,
): number => {
  const start = weekStartOf(now)
  return boxes.filter((box) => box.boxId.startsWith('shop:') && box.acquiredAt >= start).length
}

/**
 * 중복이 나왔을 때 대신 주는 별가루. §7 가격의 1/4이고 검산이 그 비율을 지킨다.
 *
 * legendary는 상점 가격이 없어 비율을 잡을 수 없다. 지금은 상자 풀에 전설이 없어
 * 도달하지 않는 칸이라 rare·epic 사이 간격을 이어 둔 값이다.
 */
export const DUPLICATE_DUST: Record<Rarity, number> = {
  common: PRICES.common / 4,
  rare: PRICES.rare / 4,
  epic: PRICES.epic / 4,
  legendary: 200,
}

/**
 * 천장. 마지막 Rare 이상 이후 이만큼 굴렸으면 다음 상자는 Rare 이상만 나온다.
 * 일반 상자에만 걸린다 — 희귀 확정·프리미엄은 확률표에 common이 없다.
 */
export const PITY_LIMIT = 9

/** 개봉 기록 이름표. 상자 한 장은 한 번만 열리므로 boxId에 묶는다 */
export const boxOpenId = (boxId: string): string => `open:${boxId}`

/** 중복 전환 별가루 이름표. §10의 `duplicate:{boxOpenId}` */
export const duplicateDustId = (openId: string): string => `duplicate:${openId}`

/** 상자 구매 별가루 이름표. 아이템 구매(`purchase:buy:…`)와 갈래를 나눈다 */
export const boxPurchaseId = (boxId: string): string => `purchase:box:${boxId}`

export const boxPriceOf = (type: BoxType): number | undefined => BOX_PRICE[type]

/** 그 상자에서 나올 수 있는 등급. 확률이 0인 칸은 뽑을 수 없다 */
export const boxRarities = (type: BoxType): Rarity[] =>
  RARITIES.filter((rarity) => BOX_ODDS[type][rarity] > 0)

/**
 * 그 상자의 아이템 풀. 확률표에서 등급을 뽑으므로 둘이 어긋날 수 없다.
 * 레벨·지역 전용은 들어가지 않는다(§8).
 */
export function boxPool(type: BoxType): ItemId[] {
  const allowed = boxRarities(type)
  return ITEM_IDS.filter(
    (itemId) => ITEMS[itemId].source === 'shop' && allowed.includes(ITEMS[itemId].rarity),
  )
}

/**
 * 마지막 Rare 이상 개봉 이후 몇 번을 열었는가. 천장 판정에 넣는다.
 * 개봉 순서대로 들어와야 한다 — 부르는 쪽이 `openedAt`으로 정렬한다.
 */
export function pityCount(opens: readonly { itemId: string }[]): number {
  let count = 0
  for (let index = opens.length - 1; index >= 0; index -= 1) {
    const rarity = ITEMS[opens[index].itemId as ItemId]?.rarity
    if (rarity && rarity !== 'common') return count
    count += 1
  }
  return count
}

export interface BoxResult {
  itemId: ItemId
  duplicate: boolean
  /** 중복일 때만 양수. 아닐 때는 0 */
  duplicateDust: number
}

/**
 * 상자 한 장의 결과.
 *
 * 등급을 먼저 뽑고 그 등급의 **미보유** 아이템에서 고른다. 뽑힌 등급에 미보유가
 * 없으면 다른 등급으로 옮겨 간다 — 풀에 미보유가 하나라도 남아 있으면 중복은
 * 나오지 않는다(§8 「미보유 아이템을 우선 지급한다」).
 *
 * 옮겨 가는 순서는 **가장 가까운 등급**이고 같은 거리면 낮은 쪽이다. 일반을 다
 * 모으면 희귀로, 희귀까지 다 모으면 영웅으로 한 칸씩 올라간다. 곧장 영웅으로
 * 뛰면 상자가 확률표보다 훨씬 후해져 상점에서 살 이유가 사라진다.
 *
 * 전부 보유했으면 그때만 중복이고, 그 등급 기준 별가루로 전환한다.
 */
export function rollBox(
  type: BoxType,
  owned: ReadonlySet<string>,
  pity: number,
  random: () => number,
): BoxResult {
  const pool = boxPool(type)
  if (!pool.length) throw new Error(`상자 풀이 비었다: ${type}`)

  const rolled = pickRarity(type, pity, random())
  // 뽑힌 등급을 먼저 보고, 없으면 가까운 등급부터 — 같은 거리면 낮은 쪽
  const step = (rarity: Rarity) => RARITIES.indexOf(rarity) - RARITIES.indexOf(rolled)
  const order = [
    rolled,
    ...boxRarities(type)
      .filter((rarity) => rarity !== rolled)
      .sort((a, b) => Math.abs(step(a)) - Math.abs(step(b)) || step(a) - step(b)),
  ]

  for (const rarity of order) {
    const fresh = pool.filter((itemId) => ITEMS[itemId].rarity === rarity && !owned.has(itemId))
    if (fresh.length) return { itemId: pickOne(fresh, random()), duplicate: false, duplicateDust: 0 }
  }
  for (const rarity of order) {
    const all = pool.filter((itemId) => ITEMS[itemId].rarity === rarity)
    if (all.length) {
      return { itemId: pickOne(all, random()), duplicate: true, duplicateDust: DUPLICATE_DUST[rarity] }
    }
  }
  throw new Error(`뽑을 아이템이 없다: ${type}`)
}

/** 중복 전환 별가루 줄. 개봉 기록과 같은 트랜잭션에 들어간다 */
export function duplicateDustRow(openId: string, amount: number, now: number): DustRow {
  const id = duplicateDustId(openId)
  return { id, type: 'earn', amount, sourceType: 'duplicate', sourceId: id, createdAt: now }
}

/** 상자 구매 차감 줄. 상자는 소모품이라 같은 종류를 여러 장 살 수 있고, 이름표는 상자 id로 갈린다 */
export function boxPurchaseRow(boxId: string, type: BoxType, now: number): DustRow {
  const id = boxPurchaseId(boxId)
  return { id, type: 'spend', amount: boxPriceOf(type) ?? 0, sourceType: 'box', sourceId: id, createdAt: now }
}

/**
 * 등급 추첨. 천장에 걸리면 common을 빼고 남은 칸의 비율을 그대로 늘려 쓴다.
 * 부동소수 잔차로 마지막 칸을 넘길 수 있어 확률이 있는 마지막 등급으로 떨어뜨린다.
 */
function pickRarity(type: BoxType, pity: number, roll: number): Rarity {
  const odds = BOX_ODDS[type]
  const forced = pity >= PITY_LIMIT
  const rest = RARITIES.filter((rarity) => (forced ? rarity !== 'common' : true) && odds[rarity] > 0)
  const total = rest.reduce((sum, rarity) => sum + odds[rarity], 0)
  let acc = 0
  for (const rarity of rest) {
    acc += odds[rarity] / total
    if (roll < acc) return rarity
  }
  return rest[rest.length - 1]
}

/** 목록에서 하나. 0~1 난수를 칸 번호로 옮긴다 */
function pickOne(items: ItemId[], roll: number): ItemId {
  return items[Math.min(items.length - 1, Math.floor(roll * items.length))]
}
