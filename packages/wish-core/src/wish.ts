// 위시 진행 계산. 전부 순수 함수. Dexie·React·화면 문구 금지.
// 금액은 정수, 나눗셈은 Math.floor 내림. budget-core와 같은 원칙.

import type { DayStatus, PlanetStage, Wish, WishEvent } from './types.ts'

/** 'yyyy-MM-dd' → 로컬 자정 Date. budget-core와 같은 방식으로 시간대 밀림을 막는다 */
function toDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const DAY = 86_400_000

/** 두 날짜의 달력 일수 차이. b - a */
export function daysBetween(a: string, b: string) {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY)
}

export function addDays(date: string, days: number) {
  const next = toDate(date)
  next.setDate(next.getDate() + days)
  const month = String(next.getMonth() + 1).padStart(2, '0')
  const day = String(next.getDate()).padStart(2, '0')
  return `${next.getFullYear()}-${month}-${day}`
}

/** 오늘 포함 남은 일수. 기간 미선택이면 null, 목표일이 지났으면 최소 1 */
export function remainingDays(wish: Pick<Wish, 'targetDate'>, today: string): number | null {
  if (!wish.targetDate) return null
  return Math.max(1, daysBetween(today, wish.targetDate) + 1)
}

const eventsOf = (events: WishEvent[], wishId: string) => events.filter((event) => event.wishId === wishId)

/** 그날의 순 납입액. 저금 − 회수 */
export function depositsOn(events: WishEvent[], wishId: string, date: string) {
  let sum = 0
  for (const event of events) {
    if (event.wishId !== wishId || event.date !== date) continue
    if (event.type === 'deposit') sum += event.amount ?? 0
    if (event.type === 'withdraw') sum -= event.amount ?? 0
  }
  return sum
}

/**
 * 하루 몫 판정에 쓰는 납입. 직접 저금(`manual`)만 센다.
 * 다른 위시에서 옮긴 돈(`transfer`)은 새 저금 행동이 아니고,
 * 남은 예산 넘기기(`carryover`)는 자기 미션이 따로 있어 하루 몫과 별개로 친다.
 */
export function actionDepositsOn(events: WishEvent[], wishId: string, date: string) {
  let sum = 0
  for (const event of events) {
    if (event.wishId !== wishId || event.date !== date) continue
    if (event.type === 'deposit' && (event.source ?? 'manual') === 'manual') sum += event.amount ?? 0
    if (event.type === 'withdraw') sum -= event.amount ?? 0
  }
  return sum
}

/**
 * 하루 몫 = 남은 금액 / 남은 일수, 내림.
 * 오늘 넣은 돈은 빼고 계산한다. 그러지 않으면 조금 넣을 때마다 목표가 내려가
 * 부분 납입이 전액 납입으로 둔갑한다.
 */
export function dailyShare(wish: Wish, events: WishEvent[], today: string) {
  if (wish.status !== 'active') return 0
  const days = remainingDays(wish, today)
  if (!days) return 0
  const savedAtDayStart = wish.savedAmount - depositsOn(events, wish.id, today)
  return Math.floor(Math.max(0, wish.targetAmount - savedAtDayStart) / days)
}

/** 진행 중인 위시 전체의 하루 몫 합계. 등록 시 무리한 계획을 경고하는 데 쓴다 */
export function totalDailyShare(wishes: Wish[], events: WishEvent[], today: string) {
  return wishes.reduce((sum, wish) => sum + dailyShare(wish, events, today), 0)
}

export function progress(wish: Pick<Wish, 'savedAmount' | 'targetAmount'>) {
  if (wish.targetAmount <= 0) return 0
  return Math.min(100, Math.round((wish.savedAmount / wish.targetAmount) * 100))
}

/** 진행률에 따른 행성 성장 단계 */
export function stageOf(progressPercent: number): PlanetStage {
  if (progressPercent >= 100) return 'system'
  if (progressPercent >= 80) return 'satellites'
  if (progressPercent >= 60) return 'ring'
  if (progressPercent >= 35) return 'planet'
  if (progressPercent >= 15) return 'moon'
  return 'seed'
}

/** 위시 하나의 진행 단계. 화면에는 4단계처럼 쓴다 */
export const orbitLevelOf = (progressPercent: number) => Math.min(5, Math.floor(progressPercent / 20) + 1)

/** 하루 판정 네 갈래. 건너뜀은 명시적으로 누른 날이고 무응답은 아무것도 안 한 날이다 */
export function dayStatus(wish: Wish, events: WishEvent[], today: string): DayStatus {
  const skipped = events.some(
    (event) => event.wishId === wish.id && event.date === today && event.type === 'skip',
  )
  const net = actionDepositsOn(events, wish.id, today)
  if (net <= 0) return skipped ? 'skip' : 'none'
  const share = dailyShare(wish, events, today)
  return share > 0 && net < share ? 'partial' : 'full'
}

/** 저금한 날 수. 하루에 여러 번 넣어도 하루로 센다 */
export function keptDays(events: WishEvent[], wishId: string) {
  const dates = new Set<string>()
  for (const event of eventsOf(events, wishId)) {
    if (event.type === 'deposit' && event.source !== 'transfer' && (event.amount ?? 0) > 0) dates.add(event.date)
  }
  return dates.size
}

/** 그 달의 순 저금액. Orbit 자유비용에 넘길 값. 회수가 더 크면 음수 */
export function monthlyDeposit(events: WishEvent[], month: string) {
  let sum = 0
  for (const event of events) {
    if (!event.date.startsWith(month)) continue
    if (event.type === 'deposit') sum += event.amount ?? 0
    if (event.type === 'withdraw') sum -= event.amount ?? 0
  }
  return sum
}

/** 저금통에 들어 있는 돈. 진행 중인 위시만 센다 (구매·취소하면 빠져나간다) */
export function vaultTotal(wishes: Wish[]) {
  return wishes
    .filter((wish) => wish.status === 'active' || wish.status === 'ready' || wish.status === 'waiting')
    .reduce((sum, wish) => sum + wish.savedAmount, 0)
}

/** 지금까지 넣은 총액. 구매·취소한 위시까지 포함하는 평생 누적 */
export function lifetimeDeposit(events: WishEvent[]) {
  return events.reduce(
    (sum, event) => (event.type === 'deposit' && event.source !== 'transfer' ? sum + (event.amount ?? 0) : sum),
    0,
  )
}

/** 기간 미선택 위시의 예상 달성일. 지금까지의 하루 평균 납입 속도로 민다 */
export function projectedDate(wish: Wish, events: WishEvent[], today: string): string | null {
  const left = wish.targetAmount - wish.savedAmount
  if (left <= 0) return today
  const elapsed = Math.max(1, daysBetween(wish.startDate, today) + 1)
  const perDay = wish.savedAmount / elapsed
  if (perDay <= 0) return null
  return addDays(today, Math.ceil(left / perDay))
}

/** 지금 하루 몫이 최초 계획의 몇 배인지. 못 채운 날이 쌓이면 올라간다 */
export function shareInflation(wish: Wish, events: WishEvent[], today: string) {
  if (!wish.targetDate) return 1
  const totalDays = Math.max(1, daysBetween(wish.startDate, wish.targetDate) + 1)
  const initial = Math.floor(wish.targetAmount / totalDays)
  if (initial <= 0) return 1
  return dailyShare(wish, events, today) / initial
}

/** 하루 몫이 최초의 1.5배를 넘으면 연기를 권한다. 스펙 §4 */
export function needsExtension(wish: Wish, events: WishEvent[], today: string) {
  return shareInflation(wish, events, today) >= 1.5
}

/** 등록 3일이 지나야 구매할 수 있다. 목표를 낮춰 최소 기간을 우회하는 것을 막는다 */
export function canPurchase(wish: Pick<Wish, 'startDate'>, today: string) {
  return daysBetween(wish.startDate, today) >= 3
}

/** 구매 잠금이 풀리는 날짜. 등록일은 0일째라 3일 뒤부터 열린다 */
export function purchaseUnlockDate(wish: Pick<Wish, 'startDate'>) {
  return addDays(wish.startDate, 3)
}

/** 위시 id에서 행성 무늬 시드를 만든다. 같은 위시는 항상 같은 얼굴 */
export function seedFromId(id: string) {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 100_000
  }
  return hash + 1
}

/** 결정적 의사난수. 행성 무늬를 항상 같게 그린다 */
export function rng(seed: number) {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}
