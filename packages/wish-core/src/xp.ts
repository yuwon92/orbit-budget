// 경험치·레벨·칭호. 전부 순수 함수.
// XP는 어디에도 저장하지 않고 이벤트와 수령 기록에서 매번 다시 계산한다.
// 배점을 바꾸면 과거 기록도 새 배점으로 재계산된다. 스펙 §8·§9.

import { dayStatus, daysBetween, depositsOn } from './wish.ts'
import type { Claim, Wish, WishEvent } from './types.ts'

export const XP = {
  /** 하루 몫 전액 */
  share: 10,
  /** 부분 납입 */
  partial: 5,
  /** 남은 예산 넘기기. 그냥 써도 되는 돈을 옮기는 가장 어려운 행동 */
  carryover: 30,
  /** 목표를 채우고도 하루 더 기다림 */
  wait: 20,
  /** 위시 완주 */
  complete: 100,
  /** 연속 7일마다 */
  streak7: 30,
  /** 첫 위시 등록 */
  firstWish: 50,
} as const

/** 누적 XP 기준 레벨 문턱. Lv1부터 Lv8까지 */
export const LEVEL_STEPS = [0, 100, 300, 700, 1400, 2500, 4000, 6000]

export const LEVEL_TITLES = [
  'STARGAZER', 'DRIFTER', 'EXPLORER', 'NAVIGATOR',
  'VOYAGER', 'ASTRONOMER', 'CONSTELLATOR', 'COSMOGRAPHER',
]

/** 레벨별 해금. 슬롯은 레벨 또는 완주 횟수 중 먼저 도달한 쪽으로 열린다 */
export const UNLOCKS = [
  { level: 2, name: '위시 슬롯 2', detail: '또는 완주 1개' },
  { level: 3, name: '행성 색 선택', detail: '궤도 팔레트 개방' },
  { level: 4, name: '위시 슬롯 3', detail: '또는 완주 3개' },
  { level: 5, name: '행성 링 패턴', detail: '궤도 장식' },
  { level: 6, name: '성계 배경', detail: '도감 테마' },
  { level: 7, name: '목표 이미지', detail: '위시에 사진 첨부' },
  { level: 8, name: '행성 커스터마이즈', detail: '픽셀 직접 편집' },
]

export interface LevelInfo {
  level: number
  title: string
  into: number
  need: number
  ratio: number
  max: boolean
}

export function levelFromXp(totalXp: number): LevelInfo {
  let index = 0
  while (index + 1 < LEVEL_STEPS.length && totalXp >= LEVEL_STEPS[index + 1]) index += 1
  const base = LEVEL_STEPS[index]
  const next = LEVEL_STEPS[index + 1]
  const max = next === undefined
  const into = totalXp - base
  const need = max ? into : next - base
  return {
    level: index + 1,
    title: LEVEL_TITLES[index],
    into,
    need,
    ratio: max ? 1 : Math.min(1, into / need),
    max,
  }
}

/** 잠금 해제된 위시 슬롯 수. 동시 진행 최대 3개 */
export function slotCount(level: number, completed: number) {
  if (level >= 4 || completed >= 3) return 3
  if (level >= 2 || completed >= 1) return 2
  return 1
}

// ── 미션 수령 ─────────────────────────────────────────

export type MissionKind = 'share' | 'wait' | 'carryover'

/** 수령 단위 하나. 화면의 미션 행 하나에 대응한다 */
export interface MissionUnit {
  missionId: string
  date: string
  kind: MissionKind
  xp: number
  wishId?: string
}

export const claimIdOf = (date: string, missionId: string) => `${date}:${missionId}`

/**
 * 이벤트에서 수령 가능한 미션을 전부 만든다. 수령 여부는 claims로 따로 대조한다.
 * 남은 예산을 넘긴 날은 하루 몫과 넘기기 두 건이 함께 잡힌다 — 가장 어려운 행동이라 겹쳐 준다.
 */
export function missionUnits(wishes: Wish[], events: WishEvent[]): MissionUnit[] {
  const units: MissionUnit[] = []
  const byId = new Map(wishes.map((wish) => [wish.id, wish]))
  const seenShare = new Set<string>()

  for (const event of events) {
    const wish = byId.get(event.wishId)
    if (!wish) continue

    if (event.type === 'deposit' && (event.amount ?? 0) > 0) {
      const key = `${event.date}:${wish.id}`
      if (!seenShare.has(key) && depositsOn(events, wish.id, event.date) > 0) {
        seenShare.add(key)
        const status = dayStatus(wish, events, event.date)
        units.push({
          missionId: `share-${wish.id}`,
          date: event.date,
          kind: 'share',
          xp: status === 'partial' ? XP.partial : XP.share,
          wishId: wish.id,
        })
      }
      if (event.source === 'carryover') {
        units.push({ missionId: 'carryover', date: event.date, kind: 'carryover', xp: XP.carryover, wishId: wish.id })
      }
    }

    if (event.type === 'wait') {
      units.push({ missionId: `wait-${wish.id}`, date: event.date, kind: 'wait', xp: XP.wait, wishId: wish.id })
    }
  }

  return units
}

const claimedSet = (claims: Claim[]) => new Set(claims.map((claim) => claim.id))

export function pendingUnits(units: MissionUnit[], claims: Claim[]) {
  const claimed = claimedSet(claims)
  return units.filter((unit) => !claimed.has(claimIdOf(unit.date, unit.missionId)))
}

export const sumXp = (units: MissionUnit[]) => units.reduce((sum, unit) => sum + unit.xp, 0)

/** 이미 수령해 레벨에 반영된 XP */
export function claimedXp(units: MissionUnit[], claims: Claim[]) {
  const claimed = claimedSet(claims)
  return sumXp(units.filter((unit) => claimed.has(claimIdOf(unit.date, unit.missionId))))
}

/** 수령 없이 바로 붙는 보상. 완주·첫 위시·연속 7일 */
export function bonusXp(wishes: Wish[], events: WishEvent[]) {
  let sum = 0
  if (wishes.length > 0) sum += XP.firstWish
  sum += wishes.filter((wish) => wish.status === 'done').length * XP.complete
  sum += streakBlocks(events) * XP.streak7
  return sum
}

export function totalXp(wishes: Wish[], events: WishEvent[], claims: Claim[]) {
  return claimedXp(missionUnits(wishes, events), claims) + bonusXp(wishes, events)
}

// ── 연속 기록 ─────────────────────────────────────────

/** 저금한 날짜를 오름차순 연속 묶음으로 나눈다 */
function depositRuns(events: WishEvent[]): string[][] {
  const dates = [...new Set(
    events.filter((event) => event.type === 'deposit' && (event.amount ?? 0) > 0).map((event) => event.date),
  )].sort()
  const runs: string[][] = []
  for (const date of dates) {
    const last = runs[runs.length - 1]
    if (last && daysBetween(last[last.length - 1], date) === 1) last.push(date)
    else runs.push([date])
  }
  return runs
}

/** 지금까지 채운 7일 묶음 수. 연속 보너스 횟수 */
function streakBlocks(events: WishEvent[]) {
  return depositRuns(events).reduce((sum, run) => sum + Math.floor(run.length / 7), 0)
}

/**
 * 현재·최장 연속. 끊겨도 0으로 되돌리지 않고 쉰 날마다 1씩만 줄인다.
 * 못 모으는 날을 상정한 설계와 충돌하지 않게 한다. 스펙 §8.
 */
export function streak(events: WishEvent[], today: string) {
  const runs = depositRuns(events)
  const best = runs.reduce((max, run) => Math.max(max, run.length), 0)
  const last = runs[runs.length - 1]
  if (!last) return { current: 0, best: 0 }
  const gap = Math.max(0, daysBetween(last[last.length - 1], today))
  return { current: Math.max(0, last.length - gap), best }
}

// ── 통계와 칭호 ────────────────────────────────────────

export interface ObserverStats {
  keptDays: number
  streak: number
  bestStreak: number
  carryovers: number
  carryoverAmount: number
  waits: number
  completed: number
  cancelled: number
  lifetimeDeposit: number
}

export function observerStats(wishes: Wish[], events: WishEvent[], today: string): ObserverStats {
  const deposits = events.filter((event) => event.type === 'deposit' && (event.amount ?? 0) > 0)
  const carryovers = deposits.filter((event) => event.source === 'carryover')
  const { current, best } = streak(events, today)
  return {
    keptDays: new Set(deposits.map((event) => event.date)).size,
    streak: current,
    bestStreak: best,
    carryovers: carryovers.length,
    carryoverAmount: carryovers.reduce((sum, event) => sum + (event.amount ?? 0), 0),
    waits: events.filter((event) => event.type === 'wait').length,
    completed: wishes.filter((wish) => wish.status === 'done').length,
    cancelled: wishes.filter((wish) => wish.status === 'cancelled').length,
    lifetimeDeposit: deposits.reduce((sum, event) => sum + (event.amount ?? 0), 0),
  }
}

/** 칭호 id. 이름·설명·아이콘은 앱이 갖는다 */
export const TITLE_IDS = ['first', 'long', 'thrift', 'patience', 'habit', 'constellation', 'letgo'] as const
export type TitleId = (typeof TITLE_IDS)[number]

export function earnedTitles(wishes: Wish[], events: WishEvent[], today: string): TitleId[] {
  const stats = observerStats(wishes, events, today)
  const earned: TitleId[] = []
  const done = wishes.filter((wish) => wish.status === 'done')

  if (done.length >= 1) earned.push('first')
  const longRun = done.some((wish) => {
    const end = events.find((event) => event.wishId === wish.id && event.type === 'purchase')?.date
    return end ? daysBetween(wish.startDate, end) >= 30 : false
  })
  if (longRun) earned.push('long')
  if (stats.carryovers >= 10) earned.push('thrift')
  if (stats.waits >= 5) earned.push('patience')
  if (stats.bestStreak >= 14) earned.push('habit')
  if (done.length >= 5) earned.push('constellation')
  if (stats.cancelled >= 1) earned.push('letgo')

  return earned
}

/** 오늘 아직 하지 않은 하루 몫이 있는지. 미션 목록을 만들 때 쓴다 */
export function shareDone(wish: Wish, events: WishEvent[], today: string) {
  const status = dayStatus(wish, events, today)
  return status === 'full' || status === 'partial' || status === 'skip'
}
