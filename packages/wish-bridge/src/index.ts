// orbital-wish의 유일한 쓰기 창구. 화면은 여기를 통해서만 저장한다.
// 이벤트 추가와 savedAmount 갱신은 항상 한 트랜잭션 안에서 함께 한다 —
// 둘이 어긋나면 진행률과 이벤트 원장이 갈라진다.
import { canPurchase, monthlyDeposit, seedFromId } from '@orbit/wish-core/wish'
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

/** 연출을 이미 본 칭호. 레벨과 달리 순서가 없어 id 목록으로 남긴다 */
export async function markCelebratedTitles(titleIds: string[]) {
  await wishDb.player.update(PLAYER_ID, { celebratedTitles: [...new Set(titleIds)] })
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

export interface UpdateWishInput {
  name: string
  targetAmount: number
  targetDate: string | null
  today: string
}

/** 이름·목표 금액·기간을 함께 수정한다. 목표/기간 변경은 원장에도 남긴다. */
export async function updateWish(wishId: string, input: UpdateWishInput) {
  await wishDb.transaction('rw', wishDb.wishes, wishDb.wishEvents, async () => {
    const wish = await wishDb.wishes.get(wishId)
    if (!wish || wish.status === 'done' || wish.status === 'cancelled') return
    const targetAmount = Math.max(wish.savedAmount, Math.floor(input.targetAmount))
    const amountChanged = targetAmount !== wish.targetAmount
    const dateChanged = input.targetDate !== wish.targetDate
    const status = amountChanged
      ? targetAmount <= wish.savedAmount
        ? wish.status === 'waiting' ? 'waiting' : 'ready'
        : 'active'
      : wish.status

    await wishDb.wishes.update(wishId, {
      name: input.name,
      targetAmount,
      targetDate: input.targetDate,
      status,
    })
    if (amountChanged) await wishDb.wishEvents.add(event(wishId, 'targetChange', input.today, { amount: targetAmount }))
    if (dateChanged) await wishDb.wishEvents.add(event(wishId, 'extend', input.today))
  })
}

/** 저금. 목표를 채우면 그 자리에서 ready로 넘어간다 */
export async function deposit(wishId: string, amount: number, date: string, source: 'manual' | 'carryover' = 'manual') {
  if (amount <= 0) return
  await wishDb.transaction('rw', wishDb.wishes, wishDb.wishEvents, async () => {
    const wish = await wishDb.wishes.get(wishId)
    if (!wish || wish.status !== 'active') return
    const accepted = Math.min(amount, Math.max(0, wish.targetAmount - wish.savedAmount))
    if (accepted <= 0) return
    const savedAmount = wish.savedAmount + accepted
    await wishDb.wishes.update(wishId, {
      savedAmount,
      status: savedAmount >= wish.targetAmount ? 'ready' : wish.status,
    })
    await wishDb.wishEvents.add(event(wishId, 'deposit', date, { amount: accepted, source }))
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
    const wish = await wishDb.wishes.get(wishId)
    if (!wish || wish.status !== 'ready') return
    await wishDb.wishes.update(wishId, { status: 'waiting' })
    await wishDb.wishEvents.add(event(wishId, 'wait', date))
  })
}

/** 기다리는 중 하루가 더 지났다는 기록. 상태는 그대로 waiting */
export async function recordWaitDay(wishId: string, date: string) {
  await wishDb.wishEvents.add(event(wishId, 'wait', date))
}

/** Orbit 거래가 만들어진 뒤 구매를 확정한다. 같은 거래 id의 중복 이벤트는 만들지 않는다 */
export async function purchaseWish(wishId: string, date: string, transactionId: string) {
  await wishDb.transaction('rw', wishDb.wishes, wishDb.wishEvents, async () => {
    const wish = await wishDb.wishes.get(wishId)
    if (!wish || (wish.status !== 'ready' && wish.status !== 'waiting') || !canPurchase(wish, date)) return
    const existing = await wishDb.wishEvents.where('wishId').equals(wishId).filter(
      (item) => item.type === 'purchase' && item.transactionId === transactionId,
    ).first()
    if (existing) return
    await wishDb.wishes.update(wishId, { status: 'done' })
    await wishDb.wishEvents.add(event(wishId, 'purchase', date, { transactionId }))
  })
}

/**
 * 위시 정리. 다른 진행 중 위시를 고르면 들어갈 수 있는 만큼 옮기고,
 * 남는 금액은 withdraw만 남아 이번 달 자유비용으로 돌아간다.
 */
export async function cancelWish(wishId: string, date: string, targetWishId: string | null = null) {
  await wishDb.transaction('rw', wishDb.wishes, wishDb.wishEvents, async () => {
    const wish = await wishDb.wishes.get(wishId)
    if (!wish || wish.status === 'done' || wish.status === 'cancelled') return
    const amount = wish.savedAmount
    let transferred = 0
    if (targetWishId && targetWishId !== wishId) {
      const target = await wishDb.wishes.get(targetWishId)
      if (target?.status === 'active') {
        transferred = Math.min(amount, Math.max(0, target.targetAmount - target.savedAmount))
        if (transferred > 0) {
          const savedAmount = target.savedAmount + transferred
          await wishDb.wishes.update(target.id, {
            savedAmount,
            status: savedAmount >= target.targetAmount ? 'ready' : 'active',
          })
          await wishDb.wishEvents.add(event(target.id, 'deposit', date, { amount: transferred, source: 'transfer' }))
        }
      }
    }
    await wishDb.wishes.update(wishId, { savedAmount: 0, status: 'cancelled' })
    if (amount > 0) await wishDb.wishEvents.add(event(wishId, 'withdraw', date, { amount }))
    await wishDb.wishEvents.add(event(wishId, 'cancel', date, {
      amount,
      targetWishId: transferred > 0 ? targetWishId ?? undefined : undefined,
    }))
  })
}

/** Orbit 홈의 live query가 쓰는 읽기 API */
export const listWishes = () => wishDb.wishes.toArray()
export const listWishEvents = () => wishDb.wishEvents.toArray()

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
