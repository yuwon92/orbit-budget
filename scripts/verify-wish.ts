// Wish 순수 계산 검산. 스펙 orbit-wish-spec.md 기준.
// 실행: npm run verify (verify-budget.ts 다음에 이어서 돈다)
// Dexie를 쓰는 코드는 여기서 import하지 않는다. node가 .ts를 직접 실행한다.
import assert from 'node:assert/strict'
import {
  canPurchase,
  dailyShare,
  dayStatus,
  daysBetween,
  keptDays,
  lifetimeDeposit,
  monthlyDeposit,
  needsExtension,
  progress,
  projectedDate,
  remainingDays,
  rng,
  stageOf,
  totalDailyShare,
  vaultTotal,
} from '../packages/wish-core/src/wish.ts'
import {
  LEVEL_STEPS,
  LEVEL_TITLES,
  XP,
  bonusXp,
  claimIdOf,
  claimedXp,
  earnedTitles,
  levelFromXp,
  missionUnits,
  observerStats,
  pendingUnits,
  slotCount,
  streak,
  sumXp,
  totalXp,
} from '../packages/wish-core/src/xp.ts'
import {
  DUST,
  bonusDustGrants,
  missionDustGrants,
  missionDustRows,
  stardustBalance,
} from '../packages/wish-core/src/dust.ts'
import {
  CATEGORIES,
  ITEMS,
  ITEM_IDS,
  PRICES,
  MANDATORY_CATEGORIES,
  RARITIES,
  STARTER_ITEMS,
  defaultItemFor,
  equipTargetOf,
  equippedMap,
  isMandatory,
  itemsOfCategory,
} from '../packages/wish-core/src/items.ts'
import { canBuy, priceOf, purchaseRows, shopItems } from '../packages/wish-core/src/shop.ts'
import {
  BOX_ODDS,
  BOX_PRICE,
  DUPLICATE_DUST,
  PITY_LIMIT,
  boxOpenId,
  boxPool,
  boxPurchaseRow,
  boxRarities,
  duplicateDustId,
  duplicateDustRow,
  pityCount,
  rollBox,
} from '../packages/wish-core/src/box.ts'
import {
  LEVEL_REWARDS,
  MAX_REWARD_LEVEL,
  isValidChoice,
  itemsOfLevel,
  levelDustId,
  needsChoice,
  nextMajorReward,
  unclaimedLevels,
} from '../packages/wish-core/src/reward.ts'
import type { Claim, Wish, WishEvent, WishStatus } from '../packages/wish-core/src/types.ts'

const wish = (over: Partial<Wish> = {}): Wish => ({
  id: 'w1',
  name: '헤드폰',
  targetAmount: 300_000,
  savedAmount: 0,
  startDate: '2026-09-01',
  targetDate: '2026-09-30',
  status: 'active' as WishStatus,
  seed: 41,
  createdAt: 0,
  ...over,
})

let eventSeq = 0
const ev = (over: Partial<WishEvent> & { type: WishEvent['type']; date: string }): WishEvent => ({
  id: `e${(eventSeq += 1)}`,
  wishId: 'w1',
  createdAt: eventSeq,
  ...over,
})

const deposit = (date: string, amount: number, over: Partial<WishEvent> = {}) =>
  ev({ type: 'deposit', date, amount, ...over })

const claim = (date: string, missionId: string): Claim => ({
  id: claimIdOf(date, missionId),
  date,
  missionId,
  createdAt: 0,
})

// ── 날짜와 하루 몫 ────────────────────────────────────
{
  assert.equal(daysBetween('2026-09-01', '2026-09-13'), 12)
  assert.equal(daysBetween('2026-09-13', '2026-09-01'), -12)

  // 오늘 포함해서 센다. 목표일 당일이면 1일
  assert.equal(remainingDays(wish(), '2026-09-13'), 18)
  assert.equal(remainingDays(wish(), '2026-09-30'), 1)
  // 목표일이 지나도 0으로 나누지 않는다
  assert.equal(remainingDays(wish(), '2026-10-05'), 1)
  assert.equal(remainingDays(wish({ targetDate: null }), '2026-09-13'), null)

  // 300,000 / 30일 = 10,000
  assert.equal(dailyShare(wish(), [], '2026-09-01'), 10_000)
  // 내림. 100,000 / 30 = 3,333.33
  assert.equal(dailyShare(wish({ targetAmount: 100_000 }), [], '2026-09-01'), 3_333)

  // 오늘 넣은 돈은 하루 몫 계산에서 빼고 본다.
  // 그러지 않으면 5,000을 넣은 뒤 남은 몫이 줄어 부분 납입이 전액으로 둔갑한다
  const events = [deposit('2026-09-01', 5_000)]
  assert.equal(dailyShare(wish({ savedAmount: 5_000 }), events, '2026-09-01'), 10_000)

  // 못 채운 날이 쌓이면 목표일은 그대로 두고 하루 몫이 올라간다
  assert.equal(dailyShare(wish(), [], '2026-09-11'), 15_000)

  // 대기·완주·기간 미선택은 하루 몫이 없다
  assert.equal(dailyShare(wish({ status: 'waiting' }), [], '2026-09-01'), 0)
  assert.equal(dailyShare(wish({ status: 'ready' }), [], '2026-09-01'), 0)
  assert.equal(dailyShare(wish({ targetDate: null }), [], '2026-09-01'), 0)

  assert.equal(
    totalDailyShare([wish(), wish({ id: 'w2', targetAmount: 60_000, targetDate: '2026-09-10' })], [], '2026-09-01'),
    10_000 + 6_000,
  )
  console.log('하루 몫·남은 일수 통과')
}

// ── 하루 판정 네 갈래 ──────────────────────────────────
{
  const base = wish()
  assert.equal(dayStatus(base, [], '2026-09-01'), 'none')

  const skip = [ev({ type: 'skip', date: '2026-09-01' })]
  assert.equal(dayStatus(base, skip, '2026-09-01'), 'skip')

  const partial = [deposit('2026-09-01', 4_000)]
  assert.equal(dayStatus(wish({ savedAmount: 4_000 }), partial, '2026-09-01'), 'partial')

  const full = [deposit('2026-09-01', 10_000)]
  assert.equal(dayStatus(wish({ savedAmount: 10_000 }), full, '2026-09-01'), 'full')

  // 하루 몫을 넘겨 넣어도 전액
  const over = [deposit('2026-09-01', 30_000)]
  assert.equal(dayStatus(wish({ savedAmount: 30_000 }), over, '2026-09-01'), 'full')

  // 건너뜀을 눌렀어도 결국 넣었으면 납입으로 본다
  const both = [ev({ type: 'skip', date: '2026-09-01' }), deposit('2026-09-01', 10_000)]
  assert.equal(dayStatus(wish({ savedAmount: 10_000 }), both, '2026-09-01'), 'full')
  console.log('하루 판정 통과')
}

// ── 저금 집계 ─────────────────────────────────────────
{
  const events = [
    deposit('2026-08-28', 20_000),
    deposit('2026-09-02', 30_000),
    deposit('2026-09-02', 5_000),
    ev({ type: 'withdraw', date: '2026-09-20', amount: 10_000 }),
  ]

  // 지난달 저금은 이번 달 자유비용을 움직이지 않는다
  assert.equal(monthlyDeposit(events, '2026-08'), 20_000)
  assert.equal(monthlyDeposit(events, '2026-09'), 25_000)
  assert.equal(monthlyDeposit(events, '2026-10'), 0)
  assert.equal(monthlyDeposit([], '2026-09'), 0)

  // 취소 회수가 더 크면 음수. 이번 달 자유비용에 더해진다
  const cancel = [deposit('2026-09-02', 30_000), ev({ type: 'withdraw', date: '2026-09-20', amount: 90_000 })]
  assert.equal(monthlyDeposit(cancel, '2026-09'), -60_000)

  // 위시 간 이전은 출발 withdraw와 도착 deposit이 상쇄된다. 새 저금·지킨 날로 세지 않는다.
  const transfer = [
    ev({ wishId: 'w1', type: 'withdraw', date: '2026-09-20', amount: 30_000 }),
    deposit('2026-09-20', 30_000, { wishId: 'w2', source: 'transfer' }),
  ]
  assert.equal(monthlyDeposit(transfer, '2026-09'), 0)
  assert.equal(keptDays(transfer, 'w2'), 0)
  assert.equal(lifetimeDeposit(transfer), 0)
  assert.equal(dayStatus(wish({ id: 'w2', savedAmount: 30_000 }), transfer, '2026-09-20'), 'none')
  assert.equal(missionUnits([wish({ id: 'w2', savedAmount: 30_000 })], transfer).length, 0)

  // 08-28, 09-02 두 날. 같은 날 두 번 넣은 것은 하루로 센다
  assert.equal(keptDays(events, 'w1'), 2)
  assert.equal(lifetimeDeposit(events), 55_000)

  // 저금통은 진행 중인 위시만. 구매·취소하면 빠져나간다
  const wishes = [
    wish({ savedAmount: 100_000 }),
    wish({ id: 'w2', savedAmount: 50_000, status: 'waiting' }),
    wish({ id: 'w3', savedAmount: 80_000, status: 'done' }),
    wish({ id: 'w4', savedAmount: 20_000, status: 'cancelled' }),
  ]
  assert.equal(vaultTotal(wishes), 150_000)
  console.log('저금 집계 통과')
}

// ── 진행률·행성 단계·구매 잠금 ──────────────────────────
{
  assert.equal(progress(wish({ savedAmount: 150_000 })), 50)
  assert.equal(progress(wish({ savedAmount: 400_000 })), 100)
  assert.equal(progress(wish({ targetAmount: 0 })), 0)

  assert.equal(stageOf(0), 'seed')
  assert.equal(stageOf(14), 'seed')
  assert.equal(stageOf(15), 'moon')
  assert.equal(stageOf(35), 'planet')
  assert.equal(stageOf(60), 'ring')
  assert.equal(stageOf(80), 'satellites')
  assert.equal(stageOf(100), 'system')

  // 등록 3일이 지나야 구매 버튼이 열린다
  assert.equal(canPurchase(wish(), '2026-09-01'), false)
  assert.equal(canPurchase(wish(), '2026-09-03'), false)
  assert.equal(canPurchase(wish(), '2026-09-04'), true)

  // 하루 몫이 최초 계획의 1.5배를 넘으면 연기를 권한다
  assert.equal(needsExtension(wish(), [], '2026-09-01'), false)
  assert.equal(needsExtension(wish(), [], '2026-09-10'), false) // 300,000/21 = 14,285 → 1.43배
  assert.equal(needsExtension(wish(), [], '2026-09-12'), true) // 300,000/19 = 15,789 → 1.58배

  // 기간 미선택 위시의 예상 달성일
  const paced = wish({ targetDate: null, savedAmount: 100_000 })
  // 10일 동안 10만원 → 하루 1만원 속도. 남은 20만원이면 20일 뒤
  assert.equal(projectedDate(paced, [], '2026-09-10'), '2026-09-30')
  assert.equal(projectedDate(wish({ targetDate: null }), [], '2026-09-10'), null)
  console.log('진행률·행성 단계·구매 잠금 통과')
}

// ── 레벨 곡선 ─────────────────────────────────────────
{
  assert.equal(LEVEL_STEPS.length, 20)
  assert.equal(LEVEL_TITLES.length, 20)
  // Lv.1~8 문턱은 이미 지급된 보상의 기준이라 고정이다
  assert.deepEqual(LEVEL_STEPS.slice(0, 8), [0, 100, 300, 700, 1400, 2500, 4000, 6000])
  // 기준 사용자 하루 22.86 XP × 730일 ≈ 16,688 → Lv.20 = 16,800
  assert.equal(LEVEL_STEPS[19], 16_800)
  LEVEL_STEPS.forEach((step, index, all) => { if (index) assert.ok(step > all[index - 1]) })
  // 문턱 값 자체는 그 레벨의 시작, 1 모자라면 이전 레벨
  LEVEL_STEPS.forEach((step, index) => {
    assert.equal(levelFromXp(step).level, index + 1)
    if (step) assert.equal(levelFromXp(step - 1).level, index)
  })
  assert.equal(levelFromXp(16_800).max, true)
  assert.equal(levelFromXp(999_999).level, 20)
  console.log('레벨 곡선 통과')
}

// ── 레벨과 슬롯 ───────────────────────────────────────
{
  assert.equal(levelFromXp(0).level, 1)
  assert.equal(levelFromXp(99).level, 1)
  assert.equal(levelFromXp(100).level, 2)
  assert.equal(levelFromXp(299).level, 2)
  assert.equal(levelFromXp(300).level, 3)
  assert.equal(levelFromXp(5_999).level, 7)
  assert.equal(levelFromXp(6_000).level, 8)
  assert.equal(levelFromXp(99_999).max, true)

  const lv2 = levelFromXp(150)
  assert.equal(lv2.into, 50)
  assert.equal(lv2.need, 200)
  assert.equal(lv2.ratio, 0.25)

  // 슬롯은 레벨 또는 완주 횟수 중 먼저 도달한 쪽으로 열린다
  assert.equal(slotCount(1, 0), 1)
  assert.equal(slotCount(2, 0), 2)
  assert.equal(slotCount(1, 1), 2)
  assert.equal(slotCount(4, 0), 3)
  assert.equal(slotCount(1, 3), 3)
  assert.equal(slotCount(8, 9), 3)
  console.log('레벨·슬롯 통과')
}

// ── 미션 수령 ─────────────────────────────────────────
{
  const wishes = [wish({ savedAmount: 14_000 })]
  const events = [
    deposit('2026-09-01', 10_000),
    deposit('2026-09-02', 4_000),
    ev({ type: 'wait', date: '2026-09-03' }),
  ]
  const units = missionUnits(wishes, events)

  // 전액 10 + 부분 5 + 기다리기 20
  assert.equal(sumXp(units), XP.share + XP.partial + XP.wait)
  assert.equal(units.filter((unit) => unit.date === '2026-09-01')[0].xp, XP.share)
  assert.equal(units.filter((unit) => unit.date === '2026-09-02')[0].xp, XP.partial)

  // 수령 전에는 전부 미수령, 레벨에 반영된 XP는 0
  assert.equal(sumXp(pendingUnits(units, [])), 35)
  assert.equal(claimedXp(units, []), 0)

  // 개별 수령하면 그 건만 빠진다
  const one = [claim('2026-09-01', 'share-w1')]
  assert.equal(claimedXp(units, one), XP.share)
  assert.equal(sumXp(pendingUnits(units, one)), 25)

  // 어제 안 받은 것도 사라지지 않는다
  assert.equal(pendingUnits(units, one).some((unit) => unit.date === '2026-09-02'), true)

  // 같은 미션을 두 번 수령해도 한 번만 센다
  const twice = [claim('2026-09-01', 'share-w1'), claim('2026-09-01', 'share-w1')]
  assert.equal(claimedXp(units, twice), XP.share)

  // 남은 예산 넘기기는 하루 몫과 별개다. 넘겼다고 그 날 하루 몫이 채워지지 않는다
  const carryEvents = [deposit('2026-09-04', 30_000, { source: 'carryover' })]
  const carry = missionUnits([wish({ savedAmount: 30_000 })], carryEvents)
  assert.deepEqual(carry.map((unit) => unit.missionId), ['carryover'])
  assert.equal(sumXp(carry), XP.carryover)

  // 같은 날 직접 저금까지 하면 두 건이 따로 잡힌다
  const bothEvents = [
    deposit('2026-09-04', 30_000, { source: 'carryover' }),
    deposit('2026-09-04', 10_000),
  ]
  const both = missionUnits([wish({ savedAmount: 40_000 })], bothEvents)
  assert.deepEqual(both.map((unit) => unit.missionId).sort(), ['carryover', 'share-w1'])

  // 이전받은 돈은 어느 쪽도 아니다
  const transferred = missionUnits(
    [wish({ savedAmount: 30_000 })],
    [deposit('2026-09-04', 30_000, { source: 'transfer' })],
  )
  assert.deepEqual(transferred, [])
  console.log('미션 수령 통과')
}

// ── 보너스와 총 XP ────────────────────────────────────
{
  const wishes = [wish({ status: 'done' }), wish({ id: 'w2' })]
  // 첫 위시 50 + 완주 100
  assert.equal(bonusXp(wishes, []), XP.firstWish + XP.complete)
  assert.equal(bonusXp([], []), 0)

  // 연속 7일마다 보너스 30
  const week = Array.from({ length: 7 }, (_, index) => deposit(`2026-09-0${index + 1}`, 10_000))
  assert.equal(bonusXp([wish()], week), XP.firstWish + XP.streak7)

  // 취소해도 XP를 회수하지 않는다
  const cancelled = [wish({ status: 'cancelled' })]
  const claims = [claim('2026-09-01', 'share-w1')]
  const events = [deposit('2026-09-01', 10_000)]
  assert.equal(totalXp(cancelled, events, claims), XP.share + XP.firstWish)
  console.log('보너스·총 XP 통과')
}

// ── 별가루 원장 ───────────────────────────────────────
{
  // 배점표가 XP 키를 전부 덮는다. 한쪽만 늘면 그 행동의 별가루가 조용히 빠진다
  assert.deepEqual(Object.keys(DUST).sort(), Object.keys(XP).sort())

  assert.equal(stardustBalance([]), 0)
  const base = { type: 'earn' as const, amount: 10, sourceType: 'bonus' as const, createdAt: 0 }
  // 같은 이름표가 두 줄 들어와도 한 번만 센다
  assert.equal(stardustBalance([{ ...base, id: 'x', sourceId: 'x' }, { ...base, id: 'x', sourceId: 'x' }]), 10)
  assert.equal(stardustBalance([
    { ...base, id: 'x', sourceId: 'x' },
    { ...base, id: 'y', sourceId: 'y', type: 'spend', amount: 4 },
  ]), 6)

  const wishes = [wish({ savedAmount: 14_000 })]
  const events = [
    deposit('2026-09-01', 10_000),
    deposit('2026-09-02', 4_000),
    ev({ type: 'wait', date: '2026-09-03' }),
  ]
  const units = missionUnits(wishes, events)
  const claims = units.map((unit) => claim(unit.date, unit.missionId))

  // 이름표에 now를 섞지 않는다. 언제 만들어도 같아야 저장의 건너뛰기가 먹는다
  assert.deepEqual(
    missionDustGrants(units, claims, 0).map((row) => row.id),
    missionDustGrants(units, claims, 1_700_000_000_000).map((row) => row.id),
  )
  assert.equal(missionDustGrants(units, claims, 0)[0].id, 'mission:2026-09-01:share-w1')
  // 수령하지 않은 미션에는 별가루가 없다
  assert.equal(missionDustGrants(units, [], 0).length, 0)

  const fullDay = units.filter((unit) => unit.date === '2026-09-01')
  const partialDay = units.filter((unit) => unit.date === '2026-09-02')
  assert.equal(missionDustRows(partialDay, 0).length, 1)
  assert.equal(stardustBalance(missionDustRows(partialDay, 0)), DUST.partial)
  assert.equal(stardustBalance(missionDustRows(fullDay, 0)), DUST.share)
  assert.ok(missionDustRows(fullDay, 0).some((row) => row.id.endsWith(':topup')))
  // 부분으로 받아 둔 날을 그 날 전액으로 채워도 기본 줄 이름표가 같아 합계가 5다
  const laterFull = missionDustRows([{ ...partialDay[0], xp: XP.share }], 0)
  assert.equal(stardustBalance([...missionDustRows(partialDay, 0), ...laterFull]), DUST.share)

  // 기다리기·넘기기는 부분 개념이 없어 줄 하나
  const waitDay = units.filter((unit) => unit.kind === 'wait')
  assert.equal(missionDustRows(waitDay, 0).length, 1)
  assert.equal(stardustBalance(missionDustRows(waitDay, 0)), DUST.wait)
  const carried = missionUnits(wishes, [deposit('2026-09-05', 5_000, { source: 'carryover' })])
  assert.equal(missionDustRows(carried, 0).length, 1)
  assert.equal(stardustBalance(missionDustRows(carried, 0)), DUST.carryover)

  // 보너스 — 첫 위시 하나, 완주마다 하나, 7일 묶음마다 하나
  const twoWeeks = Array.from({ length: 14 }, (_, index) =>
    deposit(`2026-09-${String(index + 1).padStart(2, '0')}`, 10_000))
  const bonus = bonusDustGrants([wish({ status: 'done' })], twoWeeks, 0)
  assert.equal(bonus.filter((row) => row.id === 'firstwish:me').length, 1)
  assert.equal(bonus.filter((row) => row.id === 'complete:w1').length, 1)
  const streakRows = bonus.filter((row) => row.sourceId.startsWith('streak7:'))
  assert.equal(streakRows.length, 2)
  // 이름표는 묶음의 마지막 날짜다
  assert.deepEqual(streakRows.map((row) => row.id), ['streak7:2026-09-07', 'streak7:2026-09-14'])
  // 이름표 충돌이 없어야 저장 단계에서 지급이 겹치지 않는다
  assert.equal(new Set(bonus.map((row) => row.id)).size, bonus.length)
  assert.equal(bonusDustGrants([], [], 0).length, 0)
  // 13일까지는 묶음 하나. 앱을 다시 열어도 이름표가 그대로라 다시 지급되지 않는다
  assert.equal(bonusDustGrants([wish()], twoWeeks.slice(0, 13), 0)
    .filter((row) => row.id.startsWith('streak7:')).length, 1)
  console.log('별가루 원장 통과')
}

// ── 아이템 카탈로그 ───────────────────────────────────
{
  assert.equal(new Set(ITEM_IDS).size, ITEM_IDS.length)
  ITEM_IDS.forEach((id) => assert.ok(ITEMS[id], `카탈로그 누락 ${id}`))

  // 카테고리마다 대체 아이템이 있다. 없으면 장착 아이템이 사라졌을 때 그릴 것이 없다
  CATEGORIES.forEach((category) => {
    const fallback = defaultItemFor(category)
    assert.ok(fallback, `기본 아이템 없음 ${category}`)
    assert.equal(ITEMS[fallback].category, category)
    assert.ok(itemsOfCategory(category).length > 0, `빈 카테고리 ${category}`)
  })

  // 전 희귀도가 하나씩은 있다(스펙 §6). 한 단계가 비면 상자 추첨표가 그 칸에서 막힌다
  assert.equal(new Set(ITEM_IDS.map((id) => ITEMS[id].rarity)).size, RARITIES.length)

  // 상점에 오르는 것만 가격을 갖는다. 가격 없는 상점 아이템은 구매 검증에서 0원이 된다
  ITEM_IDS.forEach((id) => {
    const def = ITEMS[id]
    if (def.source === 'shop') assert.ok(def.price && def.price > 0, `가격 없는 상점 아이템 ${id}`)
    else assert.equal(def.price, undefined, `상점 아닌데 가격이 있는 ${id}`)
  })

  assert.equal(equipTargetOf('planet-color-coral'), 'planetColor')
  assert.equal(equipTargetOf('없는-아이템'), undefined)

  // 스타터 세트는 카테고리가 겹치지 않는다. 겹치면 장착이 서로를 덮어쓴다
  const starterCategories = STARTER_ITEMS.map((id) => ITEMS[id].category)
  assert.equal(new Set(starterCategories).size, STARTER_ITEMS.length)
  // 배경을 장착하면 기존 완주 별이 배경 자리에 묻힌다. 완주 표시가 통째로 사라지지
  // 않게 스타터에 기본 효과가 함께 들어가야 한다
  assert.ok(starterCategories.includes('background'))
  assert.ok(starterCategories.includes('effect'))

  // 필수 자리는 스타터 세트가 전부 채운다. 하나라도 빠지면 처음 연 사람의 행성에서
  // 그 층이 통째로 없는 채로 시작하고, 해제도 못 하니 채울 방법이 없다
  MANDATORY_CATEGORIES.forEach((category) => {
    assert.ok(starterCategories.includes(category), `필수 자리에 스타터 없음 ${category}`)
    assert.equal(ITEMS[defaultItemFor(category)].source, 'level', `필수 자리 기본값이 상점 물건 ${category}`)
  })

  // 필수 자리의 기본값만 담은 바닥. equippedMap은 언제나 여기서부터 시작한다
  const floor = Object.fromEntries(MANDATORY_CATEGORIES.map((c) => [c, defaultItemFor(c)]))

  // 장착 상태 펴기 — 카탈로그에 없는 id는 기본값으로 대신 그린다. 줄은 지우지 않는다
  assert.deepEqual(
    equippedMap([{ category: 'ring', itemId: 'ring-double' }]),
    { ...floor, ring: 'ring-double' },
  )
  assert.deepEqual(
    equippedMap([{ category: 'ring', itemId: 'ring-사라짐' }]),
    { ...floor, ring: defaultItemFor('ring') },
  )
  // 카테고리가 어긋난 줄도 그 카테고리의 기본값으로 떨어진다
  assert.deepEqual(
    equippedMap([{ category: 'ring', itemId: 'planet-color-coral' }]),
    { ...floor, ring: defaultItemFor('ring') },
  )
  assert.deepEqual(equippedMap([{ category: '없는칸', itemId: 'ring-single' }]), floor)
  assert.deepEqual(equippedMap([]), floor)

  // 해제할 수 있는 자리는 바닥에 끼어들지 않는다. 배경·동료·효과는 빈 채로 성립한다
  CATEGORIES.filter((c) => !isMandatory(c)).forEach((category) => {
    assert.equal(equippedMap([])[category], undefined, `해제 가능한데 기본값이 붙는 ${category}`)
  })
  console.log('아이템 카탈로그 통과')
}

// ── 상점 ─────────────────────────────────────────────
{
  const entries = shopItems([])
  assert.ok(entries.length > 0)
  // 상점에 오르는 것은 전부 shop 획득처다. 상자·레벨 전용이 섞이면 살 수 없는 값이 뜬다
  entries.forEach((entry) => {
    assert.equal(ITEMS[entry.itemId].source, 'shop')
    assert.ok(entry.price > 0, `가격 없는 상품 ${entry.itemId}`)
  })
  // 순서는 카탈로그 순서다. 보유한 것을 뒤로 밀면 구매 직후 격자가 튄다
  assert.deepEqual(
    shopItems(['ring-debris']).map((entry) => entry.itemId),
    entries.map((entry) => entry.itemId),
  )
  assert.equal(shopItems(['ring-debris']).find((e) => e.itemId === 'ring-debris')?.owned, true)

  assert.equal(priceOf('ring-debris'), ITEMS['ring-debris'].price)
  // 레벨 전용·없는 아이템은 가격이 없다. 별빛 궤도 링은 Lv.5 확정 보상이라 상점에 없다
  assert.equal(priceOf('planet-color-aurora'), undefined)
  assert.equal(priceOf('ring-double'), undefined)
  assert.equal(priceOf('없는-아이템'), undefined)

  const rare = ITEMS['ring-debris'].price!
  assert.equal(canBuy(rare, 'ring-debris', []).ok, true)
  assert.equal(canBuy(rare - 1, 'ring-debris', []).ok, false)
  assert.equal(canBuy(rare - 1, 'ring-debris', []).ok === false
    && canBuy(rare - 1, 'ring-debris', []).reason, 'poor')
  const ownedCheck = canBuy(9999, 'ring-debris', ['ring-debris'])
  assert.equal(ownedCheck.ok === false && ownedCheck.reason, 'owned')
  // 팔지 않는 물건은 보유 여부보다 먼저 걸린다 — 「보유 중」이라고 답하면 상점에
  // 있는 물건처럼 읽힌다
  const levelOnly = canBuy(9999, 'planet-color-aurora', ['planet-color-aurora'])
  assert.equal(levelOnly.ok === false && levelOnly.reason, 'notForSale')
  const missing = canBuy(9999, '없는-아이템', [])
  assert.equal(missing.ok === false && missing.reason, 'notForSale')

  const rows = purchaseRows('background-nebula', 0)
  assert.equal(rows.dust.type, 'spend')
  assert.equal(rows.dust.id, 'purchase:buy:background-nebula')
  assert.equal(rows.dust.sourceType, 'purchase')
  assert.equal(rows.dust.amount, ITEMS['background-nebula'].price)
  // 이름표에 now를 섞지 않는다. 두 번 눌러도 두 번째가 이미 있는 줄로 걸려야 한다
  assert.equal(purchaseRows('background-nebula', 1_700_000_000_000).dust.id, rows.dust.id)
  // 잔액은 원장 합계다. 차감 줄이 들어오면 그만큼 줄어든다
  const earned = { id: 'e', type: 'earn' as const, amount: 1_000, sourceType: 'bonus' as const, sourceId: 'e', createdAt: 0 }
  assert.equal(stardustBalance([earned, rows.dust]), 1_000 - ITEMS['background-nebula'].price!)
  console.log('상점 통과')
}

// ── 레벨 보상표 ───────────────────────────────────────
{
  const levels = Array.from({ length: MAX_REWARD_LEVEL }, (_, index) => index + 1)

  // §13 완료 기준 — Lv.1~20 전부 무언가를 준다
  levels.forEach((level) => {
    const reward = LEVEL_REWARDS[level]
    assert.ok(reward, `Lv.${level} 보상 없음`)
    assert.equal(reward.level, level, `Lv.${level} level 필드 불일치`)
    assert.ok(
      reward.dust > 0 || reward.fixed?.length || reward.choice || reward.boxes?.length,
      `Lv.${level} 빈 보상`,
    )
  })
  assert.equal(LEVEL_REWARDS[MAX_REWARD_LEVEL + 1], undefined)

  // 선택형은 고를 것이 둘 이상이어야 한다. 하나면 고르는 의미가 없다
  Object.values(LEVEL_REWARDS).forEach((reward) => {
    if (reward.choice) assert.ok(reward.choice.of.length >= 2, `Lv.${reward.level} 선택지 부족`)
  })

  // 보상표의 모든 아이템이 카탈로그에 있다. 오타 하나면 그 레벨 수령이 빈손이 된다
  const rewardItems = Object.values(LEVEL_REWARDS)
    .flatMap((reward) => [...(reward.fixed ?? []), ...(reward.choice?.of ?? [])])
  rewardItems.forEach((id) => assert.ok(ITEMS[id], `카탈로그에 없는 보상 ${id}`))

  // 같은 아이템이 두 레벨에 걸리면 두 번째 지급이 「이미 보유」로 조용히 사라진다
  assert.equal(new Set(rewardItems).size, rewardItems.length, '보상 아이템 중복')

  // 확정 보상은 레벨 전용, 선택형 풀은 상점 재고. 카탈로그의 획득처와 맞아야 한다
  Object.values(LEVEL_REWARDS).forEach((reward) => {
    for (const id of reward.fixed ?? []) {
      assert.equal(ITEMS[id].source, 'level', `확정 보상인데 레벨 전용이 아닌 ${id}`)
    }
    for (const id of reward.choice?.of ?? []) {
      assert.equal(ITEMS[id].source, 'shop', `선택형 풀인데 상점에 없는 ${id}`)
    }
  })

  // 스타터 세트는 Lv.1 확정 보상과 같아야 한다. 갈라지면 첫 지급이 두 갈래가 된다
  assert.deepEqual([...(LEVEL_REWARDS[1].fixed ?? [])].sort(), [...STARTER_ITEMS].sort())

  assert.equal(levelDustId(14), 'level:14')
  // 이름표에 시각을 섞지 않는다. 두 번 수령해도 같은 줄로 걸려야 한다
  assert.equal(levelDustId(14), levelDustId(14))

  assert.equal(needsChoice(3), true)
  assert.equal(needsChoice(5), false)
  // 선택형은 풀에 있는 것만 받는다. 화면을 우회한 값을 저장 창구가 막는 근거
  assert.equal(isValidChoice(3, 'planet-color-mint'), true)
  assert.equal(isValidChoice(3, 'planet-color-aurora'), false)
  assert.equal(isValidChoice(3, undefined), false)
  // 선택형이 아닌 레벨에 값을 주면 거른다
  assert.equal(isValidChoice(5, undefined), true)
  assert.equal(isValidChoice(5, 'ring-debris'), false)

  assert.deepEqual(itemsOfLevel(5), ['ring-double'])
  assert.deepEqual(itemsOfLevel(3, 'planet-color-coral'), ['planet-color-coral'])
  // 고르지 않은 선택형은 확정분만 나간다 — 저장 창구가 needsChoice로 먼저 막는다
  assert.deepEqual(itemsOfLevel(3), [])
  assert.deepEqual(itemsOfLevel(13), [])
  assert.deepEqual(itemsOfLevel(99), [])

  assert.equal(nextMajorReward(4)?.level, 5)
  // 재화만 주는 레벨(13·19)은 다음 보상 미리보기에서 건너뛴다
  assert.equal(nextMajorReward(12)?.level, 14)
  assert.equal(nextMajorReward(18)?.level, 20)
  assert.equal(nextMajorReward(20), undefined)
  console.log('레벨 보상표 통과')
}

// ── 레벨 보상 소급 ────────────────────────────────────
{
  // 이미 레벨이 오른 채로 보상 기능을 만나면 지난 레벨이 전부 미수령으로 쌓인다
  assert.deepEqual(unclaimedLevels(5, []), [1, 2, 3, 4, 5])
  assert.deepEqual(unclaimedLevels(5, [1, 2, 3]), [4, 5])
  assert.deepEqual(unclaimedLevels(1, [1]), [])
  // 아직 오르지 않은 레벨은 미수령이 아니다
  assert.ok(unclaimedLevels(3, []).every((level) => level <= 3))
  // 보상표가 끝난 뒤로는 미수령이 늘지 않는다. Lv.20이 마지막 보상이다
  assert.deepEqual(unclaimedLevels(25, []), Array.from({ length: MAX_REWARD_LEVEL }, (_, i) => i + 1))
  assert.deepEqual(unclaimedLevels(25, Array.from({ length: MAX_REWARD_LEVEL }, (_, i) => i + 1)), [])
  assert.deepEqual(unclaimedLevels(0, []), [])
  // 순서를 건너뛰고 받은 기록이 있어도 남은 것만 낸다
  assert.deepEqual(unclaimedLevels(4, [2, 4]), [1, 3])
  console.log('레벨 보상 소급 통과')
}

// ── 연속 기록 ─────────────────────────────────────────
{
  const events = [
    deposit('2026-09-01', 1_000),
    deposit('2026-09-02', 1_000),
    deposit('2026-09-03', 1_000),
    deposit('2026-09-07', 1_000),
    deposit('2026-09-08', 1_000),
  ]
  assert.deepEqual(streak(events, '2026-09-08'), { current: 2, best: 3 })
  // 끊겨도 0으로 되돌리지 않고 쉰 날마다 1씩만 줄인다
  assert.equal(streak(events, '2026-09-09').current, 1)
  assert.equal(streak(events, '2026-09-10').current, 0)
  assert.deepEqual(streak([], '2026-09-10'), { current: 0, best: 0 })
  console.log('연속 기록 통과')
}

// ── 통계와 칭호 ───────────────────────────────────────
{
  const wishes = [
    wish({ status: 'done' }),
    wish({ id: 'w2', status: 'cancelled' }),
  ]
  const events = [
    deposit('2026-09-01', 10_000),
    deposit('2026-09-02', 12_400, { source: 'carryover' }),
    ev({ type: 'wait', date: '2026-09-03' }),
    ev({ type: 'purchase', date: '2026-10-05' }),
  ]
  const stats = observerStats(wishes, events, '2026-09-03')
  assert.equal(stats.keptDays, 2)
  assert.equal(stats.carryovers, 1)
  assert.equal(stats.carryoverAmount, 12_400)
  assert.equal(stats.waits, 1)
  assert.equal(stats.completed, 1)
  assert.equal(stats.cancelled, 1)
  assert.equal(stats.lifetimeDeposit, 22_400)

  const titles = earnedTitles(wishes, events, '2026-09-03')
  assert.equal(titles.includes('first'), true)
  // 2026-09-01 등록 → 2026-10-05 구매. 34일이라 장기 관측
  assert.equal(titles.includes('long'), true)
  assert.equal(titles.includes('thrift'), false)
  assert.equal(titles.includes('constellation'), false)
  // 정리 칭호는 목표까지 모은 뒤 놓아준 것만. 중간에 지운 위시는 안 쳐준다
  assert.equal(titles.includes('letgo'), false)
  const letgoEvent = ev({ type: 'cancel', date: '2026-09-03', wishId: 'w2', amount: 300_000 })
  assert.equal(earnedTitles(wishes, [...events, letgoEvent], '2026-09-03').includes('letgo'), true)
  const partial = ev({ type: 'cancel', date: '2026-09-03', wishId: 'w2', amount: 120_000 })
  assert.equal(earnedTitles(wishes, [...events, partial], '2026-09-03').includes('letgo'), false)
  console.log('통계·칭호 통과')
}

// ── 코스믹 박스 ───────────────────────────────────────
{
  const TYPES = ['normal', 'rare', 'premium'] as const

  // 확률의 합은 1이다. 어긋나면 마지막 등급이 넘치거나 뽑히지 않는 칸이 생긴다
  TYPES.forEach((type) => {
    const sum = Object.values(BOX_ODDS[type]).reduce((total, value) => total + value, 0)
    assert.ok(Math.abs(sum - 1) < 1e-9, `${type} 확률 합 ${sum}`)
  })
  // 희귀 확정·프리미엄에는 일반이 없다(§8). 있으면 「확정」이라는 이름이 거짓이 된다
  assert.equal(BOX_ODDS.rare.common, 0)
  assert.equal(BOX_ODDS.premium.common, 0)

  TYPES.forEach((type) => {
    const pool = boxPool(type)
    assert.ok(pool.length > 0, `${type} 풀이 비었다`)
    // 레벨·지역 전용은 일반 상자에 넣지 않는다(§8). 상점 재고만 오른다
    pool.forEach((itemId) => assert.equal(ITEMS[itemId].source, 'shop', `상자 풀에 든 ${itemId}`))
    // 확률이 0인 등급은 풀에도 없어야 한다 — 뽑을 수 없는 아이템이 목록에 뜬다
    const allowed = boxRarities(type)
    pool.forEach((itemId) => assert.ok(allowed.includes(ITEMS[itemId].rarity), `못 뽑는 등급 ${itemId}`))
    // 확률이 있는 등급은 뽑을 아이템이 있어야 한다. 비면 다른 등급으로 미끄러진다
    allowed.forEach((rarity) => {
      assert.ok(pool.some((itemId) => ITEMS[itemId].rarity === rarity), `${type} ${rarity} 후보 없음`)
    })
  })

  // 중복 전환은 §7 가격의 1/4이다. 둘이 갈라지면 「사는 것보다 중복이 낫다」가 된다
  assert.equal(DUPLICATE_DUST.common, PRICES.common / 4)
  assert.equal(DUPLICATE_DUST.rare, PRICES.rare / 4)
  assert.equal(DUPLICATE_DUST.epic, PRICES.epic / 4)

  // 상점에 오르는 상자는 일반뿐이다. 희귀 확정·프리미엄에 값이 붙으면 Lv.14·20
  // 보상이 「사면 그만인 것」이 된다
  assert.ok((BOX_PRICE.normal ?? 0) > 0)
  assert.equal(BOX_PRICE.rare, undefined)
  assert.equal(BOX_PRICE.premium, undefined)

  const all = new Set<string>(boxPool('normal'))

  // 미보유가 남아 있으면 중복은 나오지 않는다(§8 미보유 우선)
  for (let seed = 0; seed < 200; seed += 1) {
    const result = rollBox('normal', new Set(['ring-debris']), 0, rng(seed))
    assert.equal(result.duplicate, false, `씨앗 ${seed}에서 이른 중복`)
    assert.equal(result.duplicateDust, 0)
    assert.notEqual(result.itemId, 'ring-debris')
  }

  // 전부 보유했을 때만 중복이고 그때는 별가루가 나온다
  const dup = rollBox('normal', all, 0, rng(1))
  assert.equal(dup.duplicate, true)
  assert.ok(dup.duplicateDust > 0)
  assert.equal(dup.duplicateDust, DUPLICATE_DUST[ITEMS[dup.itemId].rarity])

  // 천장 — 마지막 희귀 이후 PITY_LIMIT번을 굴렸으면 다음은 희귀 이상이다
  for (let seed = 0; seed < 50; seed += 1) {
    const forced = rollBox('normal', new Set(), PITY_LIMIT, rng(seed))
    assert.notEqual(ITEMS[forced.itemId].rarity, 'common', `천장이 안 걸린 씨앗 ${seed}`)
  }
  // 희귀 확정 상자는 천장과 무관하게 언제나 희귀 이상이다
  for (let seed = 0; seed < 50; seed += 1) {
    assert.notEqual(ITEMS[rollBox('rare', new Set(), 0, rng(seed)).itemId].rarity, 'common')
    assert.notEqual(ITEMS[rollBox('premium', new Set(), 0, rng(seed)).itemId].rarity, 'common')
  }

  // 같은 씨앗이면 같은 결과다. 저장 트랜잭션이 재시도돼도 아이템이 바뀌지 않는다
  assert.deepEqual(rollBox('normal', new Set(), 0, rng(7)), rollBox('normal', new Set(), 0, rng(7)))

  // 천장 횟수 — 마지막 희귀 이상 이후의 개봉 수. 개봉 순서대로 들어온다
  assert.equal(pityCount([]), 0)
  assert.equal(pityCount([{ itemId: 'planet-color-mint' }, { itemId: 'planet-color-coral' }]), 2)
  assert.equal(pityCount([{ itemId: 'planet-color-mint' }, { itemId: 'ring-debris' }]), 0)
  assert.equal(pityCount([{ itemId: 'ring-debris' }, { itemId: 'planet-color-mint' }]), 1)
  // 카탈로그에서 사라진 아이템은 일반으로 세고 넘어간다 — 천장이 멈추면 안 된다
  assert.equal(pityCount([{ itemId: '없는-아이템' }]), 1)

  // 이름표에 시각을 섞지 않는다. 두 번 돌려도 같은 줄로 걸려야 한다
  const openId = boxOpenId('level:16:normal:1')
  assert.equal(openId, 'open:level:16:normal:1')
  assert.equal(duplicateDustId(openId), 'duplicate:open:level:16:normal:1')
  const dustRow = duplicateDustRow(openId, 60, 1_700_000_000_000)
  assert.equal(dustRow.type, 'earn')
  assert.equal(dustRow.sourceType, 'duplicate')
  assert.equal(dustRow.id, duplicateDustRow(openId, 60, 0).id)

  // 상자 구매는 차감 줄이고 이름표가 상자 id로 갈린다 — 같은 종류를 여러 장 산다
  const buyRow = boxPurchaseRow('shop:normal:2', 'normal', 0)
  assert.equal(buyRow.type, 'spend')
  assert.equal(buyRow.amount, BOX_PRICE.normal)
  assert.equal(buyRow.id, 'purchase:box:shop:normal:2')
  assert.notEqual(buyRow.id, boxPurchaseRow('shop:normal:3', 'normal', 0).id)
  console.log('코스믹 박스 통과')
}

console.log('\n모든 Wish 검산 통과')
