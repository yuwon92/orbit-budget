import Dexie, { type EntityTable } from 'dexie'
import type { Claim, Player, Wish, WishEvent } from '@orbit/wish-core/types'

// Wish 데이터는 Orbit 예산 데이터와 섞지 않는다. 별도 DB로 둔다.
// 승격 전 초안의 스키마 선언은 어디서도 import되지 않아 실제로 생성된 적이 없다.
// 따라서 레거시 버전 스텁 없이 v1을 최종 스키마로 확정한다.
export const wishDb = new Dexie('orbital-wish') as Dexie & {
  wishes: EntityTable<Wish, 'id'>
  wishEvents: EntityTable<WishEvent, 'id'>
  claims: EntityTable<Claim, 'id'>
  player: EntityTable<Player, 'id'>
}

wishDb.version(1).stores({
  wishes: 'id, status, createdAt',
  // date 인덱스는 월별 저금 합계 조회에 쓴다
  wishEvents: 'id, wishId, type, date, createdAt',
  // id = `${date}:${missionId}`. 같은 미션을 두 번 수령해도 한 행으로 덮인다
  claims: 'id, date',
  player: 'id',
})
