import Dexie, { type EntityTable } from 'dexie'
import type { Wish, WishEvent } from './types'

// Wish 데이터는 Orbit 예산 데이터와 섞지 않는다. 실제 쓰기 API는 다음 단계에서 추가한다.
export const wishDb = new Dexie('orbital-wish') as Dexie & {
  wishes: EntityTable<Wish, 'id'>
  wishEvents: EntityTable<WishEvent, 'id'>
}

wishDb.version(1).stores({
  wishes: 'id, status, createdAt',
  wishEvents: 'id, wishId, type, createdAt',
})
