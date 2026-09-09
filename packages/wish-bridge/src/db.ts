import Dexie, { type EntityTable } from 'dexie'
import type {
  BoxOpen,
  Claim,
  Equipped,
  LevelClaim,
  OwnedBox,
  OwnedItem,
  Player,
  Wish,
  WishEvent,
} from '@orbit/wish-core/types'
import type { DustRow } from '@orbit/wish-core/dust'

// Wish 데이터는 Orbit 예산 데이터와 섞지 않는다. 별도 DB로 둔다.
// v2에서 별가루·아이템·상자 스토어를 추가했다. v1 선언은 지우지 않는다 —
// 빈 선언이라도 없어지면 v1로 만들어진 기존 DB가 열리지 않는다.
export const wishDb = new Dexie('orbital-wish') as Dexie & {
  wishes: EntityTable<Wish, 'id'>
  wishEvents: EntityTable<WishEvent, 'id'>
  claims: EntityTable<Claim, 'id'>
  player: EntityTable<Player, 'id'>
  dustLedger: EntityTable<DustRow, 'id'>
  ownedItems: EntityTable<OwnedItem, 'itemId'>
  equipped: EntityTable<Equipped, 'category'>
  levelClaims: EntityTable<LevelClaim, 'level'>
  boxes: EntityTable<OwnedBox, 'boxId'>
  boxOpens: EntityTable<BoxOpen, 'id'>
}

wishDb.version(1).stores({
  wishes: 'id, status, createdAt',
  // date 인덱스는 월별 저금 합계 조회에 쓴다
  wishEvents: 'id, wishId, type, date, createdAt',
  // id = `${date}:${missionId}`. 같은 미션을 두 번 수령해도 한 행으로 덮인다
  claims: 'id, date',
  player: 'id',
})

// 기존 네 스토어는 한 글자도 바꾸지 않는다. 인덱스를 건드리지 않고 스토어만
// 더하는 업그레이드는 Dexie가 알아서 처리한다.
wishDb.version(2).stores({
  wishes: 'id, status, createdAt',
  wishEvents: 'id, wishId, type, date, createdAt',
  claims: 'id, date',
  player: 'id',
  // id = 지급 이름표. 이미 있으면 건너뛰므로 금액이 최초 지급값으로 굳는다.
  // sourceId에 유니크 인덱스를 걸지 않는다 — id와 같은 값이라 중복이고, 유니크
  // 위반은 트랜잭션을 통째로 되돌려 「수령 + 별가루」를 함께 날린다
  dustLedger: 'id, sourceType, createdAt',
  ownedItems: 'itemId, acquiredAt, sourceType',
  equipped: 'category, updatedAt',
  levelClaims: 'level, claimedAt',
  boxes: 'boxId, type, acquiredAt, openedAt',
  boxOpens: 'id, boxId, itemId, openedAt',
})
