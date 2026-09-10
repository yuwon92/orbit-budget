import { useLiveQuery } from 'dexie-react-hooks'
import { wishDb } from '@orbit/wish-bridge/db'
import type { DustRow } from '@orbit/wish-core/dust'
import type { BoxOpen, Claim, Equipped, LevelClaim, OwnedBox, OwnedItem, Player, Wish, WishEvent } from '@orbit/wish-core/types'

// App에서 한 번만 구독해 prop으로 내린다. HUD가 모든 화면에서 같은 값을 쓰므로
// 화면마다 따로 구독하면 같은 테이블을 네다섯 번 읽게 된다.
// undefined = 아직 로딩 중. 빈 배열(데이터 없음)과 구분해야 화면이 번쩍이지 않는다.

export const useWishes = (): Wish[] | undefined =>
  useLiveQuery(() => wishDb.wishes.toArray(), [])

/** 이벤트는 전량 읽는다. 하루 몇 건이라 부담이 없고 XP·통계가 전부 여기서 나온다 */
export const useWishEvents = (): WishEvent[] | undefined =>
  useLiveQuery(() => wishDb.wishEvents.toArray(), [])

export const useClaims = (): Claim[] | undefined =>
  useLiveQuery(() => wishDb.claims.toArray(), [])

/** 별가루 원장. 잔액은 저장하지 않고 이 줄들의 합계로 매번 계산한다 */
export const useDustLedger = (): DustRow[] | undefined =>
  useLiveQuery(() => wishDb.dustLedger.toArray(), [])

/**
 * undefined = 로딩 중, null = 아직 만들어지지 않음.
 * 구독 안에서 쓰기를 하면 재구독 루프가 생기므로 생성은 App의 effect가 맡는다.
 */
export const usePlayer = (): Player | null | undefined =>
  useLiveQuery(async () => (await wishDb.player.get('me')) ?? null, [])

/** 보유 꾸미기 아이템. 상점·꾸미기·보관함이 같은 목록을 본다 */
export const useOwnedItems = (): OwnedItem[] | undefined =>
  useLiveQuery(() => wishDb.ownedItems.toArray(), [])

/** 장착 상태. 카테고리당 한 줄이고 해제한 카테고리는 줄이 없다 */
export const useEquipped = (): Equipped[] | undefined =>
  useLiveQuery(() => wishDb.equipped.toArray(), [])

/** 레벨 보상 수령 기록. 없는 레벨이 미수령이다 */
export const useLevelClaims = (): LevelClaim[] | undefined =>
  useLiveQuery(() => wishDb.levelClaims.toArray(), [])

/** 보유 상자. 열지 않은 것만 목록에 오르지만 구독은 전량이다 — 몇 장뿐이다 */
export const useBoxes = (): OwnedBox[] | undefined =>
  useLiveQuery(() => wishDb.boxes.toArray(), [])

/** 개봉 기록. 천장 횟수와 최근 결과를 여기서 읽는다 */
export const useBoxOpens = (): BoxOpen[] | undefined =>
  useLiveQuery(() => wishDb.boxOpens.toArray(), [])
