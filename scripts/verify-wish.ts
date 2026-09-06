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
  stageOf,
  totalDailyShare,
  vaultTotal,
} from '../packages/wish-core/src/wish.ts'
import {
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

  // 남은 예산 넘기기는 하루 몫과 함께 잡힌다. 가장 어려운 행동이라 겹쳐 준다
  const carryEvents = [deposit('2026-09-04', 30_000, { source: 'carryover' })]
  const carry = missionUnits([wish({ savedAmount: 30_000 })], carryEvents)
  assert.equal(sumXp(carry), XP.share + XP.carryover)
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
  assert.equal(titles.includes('letgo'), true)
  assert.equal(titles.includes('thrift'), false)
  assert.equal(titles.includes('constellation'), false)
  console.log('통계·칭호 통과')
}

console.log('\n모든 Wish 검산 통과')
