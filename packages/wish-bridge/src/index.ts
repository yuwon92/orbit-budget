// orbital-wish의 유일한 쓰기 창구. 화면은 여기를 통해서만 저장한다.
// 이벤트 추가와 savedAmount 갱신은 항상 한 트랜잭션 안에서 함께 한다 —
// 둘이 어긋나면 진행률과 이벤트 원장이 갈라진다.
import { monthlyDeposit, seedFromId } from '@orbit/wish-core/wish'
import { claimIdOf, type MissionUnit } from '@orbit/wish-core/xp'
import type { Claim, Player, Wish, WishEvent } from '@orbit/wish-core/types'
import { wishDb } from './db'

const newId = () => crypto.randomUUID()

const PLAYER_ID = 'me' as const

/** 단일 Player 레코드. 없으면 만든다 */
export async function ensurePlayer(today: string): Promise<Player> {
  const existing = await wishDb.player.get(PLAYER_ID)
  if (existing) {
    if (existing.lastOpenedDate !== today) {
      await wishDb.player.update(PLAYER_ID, { lastOpenedDate: today })
      return { ...existing, lastOpenedDate: today }
    }
    return existing
  }
  const player: Player = {
    id: PLAYER_ID,
    createdAt: Date.now(),
    celebratedLevel: 1,
    celebratedTitles: [],
    lastOpenedDate: today,
  }
  await wishDb.player.put(player)
  return player
}

/** 레벨업 연출을 본 지점을 기록한다. 새로고침마다 다시 뜨지 않게 */
export async function markCelebratedLevel(level: number) {
  await wishDb.player.update(PLAYER_ID, { celebratedLevel: level })
}

export interface NewWishInput {
  name: string
  targetAmount: number
  targetDate: string | null
  today: string
}

export async function createWish(input: NewWishInput): Promise<Wish> {
  const id = newId()
  const wish: Wish = {
    id,
    name: input.name,
    targetAmount: input.targetAmount,
    savedAmount: 0,
    startDate: input.today,
    targetDate: input.targetDate,
    status: 'active',
    seed: seedFromId(id),
    createdAt: Date.now(),
  }
  await wishDb.wishes.put(wish)
  return wish
}

/** 이름은 계산에 쓰이지 않으므로 이벤트를 남기지 않는다 */
export async function renameWish(wishId: string, name: string) {
  await wishDb.wishes.update(wishId, { name })
}

function event(wishId: string, type: WishEvent['type'], date: string, extra: Partial<WishEvent> = {}): WishEvent {
  return { id: newId(), wishId, type, date, createdAt: Date.now(), ...extra }
}

/** 저금. 목표를 채우면 그 자리에서 ready로 넘어간다 */
export async function deposit(wishId: string, amount: number, date: string, source: 'manual' | 'carryover' = 'manual') {
  if (amount <= 0) return
  await wishDb.transaction('rw', wishDb.wishes, wishDb.wishEvents, async () => {
    const wish = await wishDb.wishes.get(wishId)
    if (!wish) return
    const savedAmount = Math.min(wish.targetAmount, wish.savedAmount + amount)
    await wishDb.wishes.update(wishId, {
      savedAmount,
      status: savedAmount >= wish.targetAmount ? 'ready' : wish.status,
    })
    await wishDb.wishEvents.add(event(wishId, 'deposit', date, { amount, source }))
  })
}

/** 오늘은 못 모아요. 기록만 남기고 벌점은 없다 */
export async function skipDay(wishId: string, date: string) {
  await wishDb.wishEvents.add(event(wishId, 'skip', date))
}

/** 회수. 취소하거나 다른 위시로 옮길 때 */
export async function withdraw(wishId: string, amount: number, date: string) {
  if (amount <= 0) return
  await wishDb.transaction('rw', wishDb.wishes, wishDb.wishEvents, async () => {
    const wish = await wishDb.wishes.get(wishId)
    if (!wish) return
    await wishDb.wishes.update(wishId, {
      savedAmount: Math.max(0, wish.savedAmount - amount),
      status: wish.status === 'ready' ? 'active' : wish.status,
    })
    await wishDb.wishEvents.add(event(wishId, 'withdraw', date, { amount }))
  })
}

/** 목표를 채우고도 더 기다리기 선택 */
export async function chooseWait(wishId: string, date: string) {
  await wishDb.transaction('rw', wishDb.wishes, wishDb.wishEvents, async () => {
    await wishDb.wishes.update(wishId, { status: 'waiting' })
    await wishDb.wishEvents.add(event(wishId, 'wait', date))
  })
}

/** 기다리는 중 하루가 더 지났다는 기록. 상태는 그대로 waiting */
export async function recordWaitDay(wishId: string, date: string) {
  await wishDb.wishEvents.add(event(wishId, 'wait', date))
}

/** 구매 확정. Orbit 거래 생성은 다음 단계에서 붙인다 */
export async function purchaseWish(wishId: string, date: string) {
  await wishDb.transaction('rw', wishDb.wishes, wishDb.wishEvents, async () => {
    await wishDb.wishes.update(wishId, { status: 'done' })
    await wishDb.wishEvents.add(event(wishId, 'purchase', date))
  })
}

/** 미션 하나 수령. 영수증만 남기고 XP 값은 저장하지 않는다 */
export async function claimMission(date: string, missionId: string) {
  const claim: Claim = { id: claimIdOf(date, missionId), date, missionId, createdAt: Date.now() }
  await wishDb.claims.put(claim)
}

/** 지금 받을 수 있는 것 전부. 지난 날짜의 미수령분도 함께 들어온다 */
export async function claimAll(units: MissionUnit[]) {
  if (!units.length) return
  const now = Date.now()
  await wishDb.claims.bulkPut(units.map((unit) => ({
    id: claimIdOf(unit.date, unit.missionId),
    date: unit.date,
    missionId: unit.missionId,
    createdAt: now,
  })))
}

/**
 * 그 달의 순 저금액. Orbit이 자유비용 계산에 쓸 값.
 * Wish DB가 없거나 열리지 않아도 Orbit이 멈추면 안 되므로 실패를 0으로 삼킨다.
 */
export async function monthlyWishDeposit(month: string): Promise<number> {
  try {
    const events = await wishDb.wishEvents.where('date').startsWith(month).toArray()
    return monthlyDeposit(events, month)
  } catch {
    return 0
  }
}

export { wishDb }
