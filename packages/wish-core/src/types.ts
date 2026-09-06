// Wish 도메인 타입. 설계 근거는 orbit-wish-spec.md §9.
// 날짜는 Orbit과 같은 'yyyy-MM-dd' 문자열, 월은 'yyyy-MM'.

export type WishStatus = 'active' | 'ready' | 'waiting' | 'done' | 'cancelled'

export interface Wish {
  id: string
  name: string
  targetAmount: number
  /** 이벤트 합계의 캐시. 쓰기 API가 이벤트와 같은 트랜잭션에서 갱신한다 */
  savedAmount: number
  /** 등록일. 구매 3일 잠금의 기준 */
  startDate: string
  targetDate: string | null
  status: WishStatus
  seed: number
  createdAt: number
}

export type WishEventType =
  | 'deposit'
  | 'skip'
  | 'withdraw'
  | 'extend'
  | 'targetChange'
  | 'wait'
  | 'purchase'
  | 'cancel'

export interface WishEvent {
  id: string
  wishId: string
  type: WishEventType
  amount?: number
  date: string
  createdAt: number
  /** deposit 전용. 남은 예산 넘기기(30 XP)와 평범한 저금을 가른다 */
  source?: 'manual' | 'carryover'
  /** purchase 전용. Orbit 거래와의 연결 */
  transactionId?: string
}

/** 미션 수령 영수증. XP 값은 담지 않는다 — 배점표에서 매번 계산한다 */
export interface Claim {
  /** `${date}:${missionId}` */
  id: string
  date: string
  missionId: string
  createdAt: number
}

/** 단일 레코드. 파생 불가능한 것만 담는다 */
export interface Player {
  id: 'me'
  createdAt: number
  /** 연출을 이미 본 최고 레벨. 새로고침마다 레벨업 연출이 다시 뜨는 것을 막는다 */
  celebratedLevel: number
  celebratedTitles: string[]
  lastOpenedDate: string
}

/** 하루 판정 네 갈래. 스펙 §4 */
export type DayStatus = 'full' | 'partial' | 'skip' | 'none'

export type PlanetStage = 'seed' | 'moon' | 'planet' | 'ring' | 'satellites' | 'system'
