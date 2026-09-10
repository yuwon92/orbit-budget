// orbital-wish의 유일한 쓰기 창구. 화면은 여기를 통해서만 저장한다.
// 이벤트 추가와 savedAmount 갱신은 항상 한 트랜잭션 안에서 함께 한다 —
// 둘이 어긋나면 진행률과 이벤트 원장이 갈라진다.
import { canPurchase, monthlyDeposit, seedFromId } from '@orbit/wish-core/wish'
import { claimIdOf, type MissionUnit } from '@orbit/wish-core/xp'
import { missionDustGrants, stardustBalance, type DustRow } from '@orbit/wish-core/dust'
import { canBuy, purchaseRows, type BuyRefusal } from '@orbit/wish-core/shop'
import { STARTER_ITEMS, equipTargetOf } from '@orbit/wish-core/items'
import type { Claim, OwnedItem, Player, Wish, WishEvent } from '@orbit/wish-core/types'
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

const receiptOf = (unit: MissionUnit, now: number): Claim =>
  ({ id: claimIdOf(unit.date, unit.missionId), date: unit.date, missionId: unit.missionId, createdAt: now })

/**
 * 별가루 지급. 이미 있는 이름표는 건너뛴다.
 *
 * put이 아니라 add인 이유 — put은 덮어쓰기라 나중에 배점표를 조정하면 과거 지급액까지
 * 새 값으로 바꿔 버린다. 지급액은 최초 지급 시점 값으로 굳어야 한다.
 *
 * 트랜잭션 안에서 부르면 그 트랜잭션에 함께 묶인다. 미션 수령이 그렇게 쓴다.
 */
async function addDustRows(rows: DustRow[]) {
  // 한 번에 들어온 줄 사이의 중복도 먼저 걷어낸다. bulkAdd는 중복 키에서 던진다
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()]
  if (!unique.length) return
  // 기본키 조회라 bulkGet으로 본다. where('id')는 인덱스 이름이 어긋나면 조회
  // 시점에 던지고, 그러면 미션 수령까지 함께 실패한다
  const existing = await wishDb.dustLedger.bulkGet(unique.map((row) => row.id))
  const fresh = unique.filter((_, index) => existing[index] === undefined)
  if (fresh.length) await wishDb.dustLedger.bulkAdd(fresh)
}

/** 영수증이 없는 보너스 지급용. 화면을 열 때마다 「있어야 할 줄」을 통째로 보낸다 */
export async function grantDust(rows: DustRow[]) {
  if (!rows.length) return
  await wishDb.transaction('rw', wishDb.dustLedger, () => addDustRows(rows))
}

/**
 * 미션 하나 수령. 영수증만 남기고 XP 값은 저장하지 않는다.
 * 별가루는 같은 트랜잭션에 넣는다 — 따로 저장하면 영수증만 남고 별가루는 없는
 * 상태가 만들어지고, 그 미션은 다시 수령할 수 없어 영영 못 받는다.
 */
export async function claimMission(unit: MissionUnit) {
  const now = Date.now()
  const receipt = receiptOf(unit, now)
  await wishDb.transaction('rw', wishDb.claims, wishDb.dustLedger, async () => {
    await wishDb.claims.put(receipt)
    await addDustRows(missionDustGrants([unit], [receipt], now))
  })
}

/** 지금 받을 수 있는 것 전부. 지난 날짜의 미수령분도 함께 들어온다 */
export async function claimAll(units: MissionUnit[]) {
  if (!units.length) return
  const now = Date.now()
  const receipts = units.map((unit) => receiptOf(unit, now))
  await wishDb.transaction('rw', wishDb.claims, wishDb.dustLedger, async () => {
    await wishDb.claims.bulkPut(receipts)
    await addDustRows(missionDustGrants(units, receipts, now))
  })
}

/**
 * 아이템 지급. 이미 보유한 것은 건너뛴다.
 *
 * put이 아니라 add인 이유는 별가루 원장과 같다 — 덮어쓰면 최초 획득 시각과 출처가
 * 나중 지급으로 바뀐다. 「언제 처음 얻었나」가 보관함 정렬 기준이다.
 *
 * 트랜잭션 안에서 부르면 그 트랜잭션에 함께 묶인다. 상점 구매·레벨 보상이 그렇게 쓴다.
 */
async function addOwnedItems(rows: OwnedItem[]) {
  const unique = [...new Map(rows.map((row) => [row.itemId, row])).values()]
  if (!unique.length) return
  const existing = await wishDb.ownedItems.bulkGet(unique.map((row) => row.itemId))
  const fresh = unique.filter((_, index) => existing[index] === undefined)
  if (fresh.length) await wishDb.ownedItems.bulkAdd(fresh)
}

/** 보유 아이템 지급. sourceId는 별가루 원장의 이름표와 같은 형식 */
export async function grantItems(itemIds: string[], sourceType: OwnedItem['sourceType'], sourceId: string) {
  if (!itemIds.length) return
  const now = Date.now()
  const rows = itemIds.map((itemId) => ({ itemId, acquiredAt: now, sourceType, sourceId }))
  await wishDb.transaction('rw', wishDb.ownedItems, () => addOwnedItems(rows))
}

/**
 * 장착. 카테고리당 한 줄이라 같은 자리의 이전 아이템은 자동으로 밀린다.
 * 보유하지 않은 아이템은 장착하지 않는다 — 화면이 막지만 쓰기 창구에서도 막는다.
 */
export async function equipItem(category: string, itemId: string) {
  await wishDb.transaction('rw', wishDb.ownedItems, wishDb.equipped, async () => {
    if (!(await wishDb.ownedItems.get(itemId))) return
    await wishDb.equipped.put({ category, itemId, updatedAt: Date.now() })
  })
}

/** 해제는 그 카테고리의 장착 줄을 지운다 */
export async function unequipItem(category: string) {
  await wishDb.equipped.delete(category)
}

/**
 * Lv.1 `관측자 스타터 세트`. 처음 앱을 열 때 기본 아이템을 보유·장착 상태로 만든다.
 *
 * **처음 지급하는 것만 장착한다.** 이미 보유한 것을 매번 다시 장착하면 사용자가
 * 해제하거나 바꿔 둔 자리를 앱을 열 때마다 되돌리게 된다. 해제는 줄 삭제라
 * 「해제해 뒀다」는 흔적이 남지 않으므로, 보유 여부를 그 흔적 대신 쓴다.
 */
export async function ensureStarterSet() {
  const now = Date.now()
  await wishDb.transaction('rw', wishDb.ownedItems, wishDb.equipped, async () => {
    const existing = await wishDb.ownedItems.bulkGet(STARTER_ITEMS)
    const fresh = STARTER_ITEMS.filter((_, index) => existing[index] === undefined)
    if (!fresh.length) return
    await wishDb.ownedItems.bulkAdd(fresh.map((itemId) => ({
      itemId, acquiredAt: now, sourceType: 'level' as const, sourceId: 'level:1',
    })))
    const equips = fresh.flatMap((itemId) => {
      const category = equipTargetOf(itemId)
      return category ? [{ category, itemId, updatedAt: now }] : []
    })
    if (equips.length) await wishDb.equipped.bulkPut(equips)
  })
}

export type BuyOutcome = 'ok' | BuyRefusal

/**
 * 상점 구매. 검증 → 별가루 차감 줄 → 아이템 지급이 한 트랜잭션이다.
 * 중간에 앱이 꺼지면 전부 취소된다 — 「별가루만 빠지고 아이템은 없는」 상태를 막는다(§7).
 *
 * **화면이 들고 있던 잔액을 믿지 않는다.** 트랜잭션 안에서 원장을 다시 합산한다 —
 * 화면을 그린 뒤 다른 탭에서 구매가 일어났을 수 있다.
 */
export async function buyItem(itemId: string): Promise<BuyOutcome> {
  return wishDb.transaction('rw', wishDb.dustLedger, wishDb.ownedItems, async () => {
    const balance = stardustBalance(await wishDb.dustLedger.toArray())
    const owned = (await wishDb.ownedItems.toArray()).map((row) => row.itemId)
    const check = canBuy(balance, itemId, owned)
    if (!check.ok) return check.reason
    const { dust } = purchaseRows(itemId, Date.now())
    await addDustRows([dust])
    await addOwnedItems([{
      itemId, acquiredAt: dust.createdAt, sourceType: 'shop', sourceId: dust.id,
    }])
    return 'ok'
  })
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
