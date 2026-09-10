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
  source?: 'manual' | 'carryover' | 'transfer'
  /** purchase 전용. Orbit 거래와의 연결 */
  transactionId?: string
  /** cancel 전용. 모은 돈을 옮긴 대상 위시 */
  targetWishId?: string
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

// 아래 다섯은 별가루 경제가 쓰는 저장 형태다. 화면은 Phase마다 하나씩 붙지만
// 스토어는 v2에서 한 번에 선언한다 — 나중에 하나씩 추가하면 그때마다 새 버전이
// 필요하고, 버전이 늘수록 기존 DB를 여는 경로가 길어진다.

/** 보유 꾸미기 아이템. itemId가 기본키라 같은 아이템을 두 번 갖지 않는다 */
export interface OwnedItem {
  itemId: string
  acquiredAt: number
  sourceType: 'shop' | 'box' | 'level' | 'region'
  /** 어느 지급에서 왔는지. 별가루 원장의 이름표와 같은 형식 */
  sourceId: string
}

/** 장착 상태. 카테고리당 한 줄이고 해제는 줄 삭제 */
export interface Equipped {
  category: string
  itemId: string
  updatedAt: number
}

/** 레벨 보상 수령 기록. 없는 레벨이 미수령이다 */
export interface LevelClaim {
  level: number
  claimedAt: number
}

/**
 * 아직 열지 않은 상자도 보유물이라 따로 남긴다.
 * premium은 Lv.20 보상 하나뿐이다 — rare로 눌러 담으면 그 등급이 사라진다.
 */
export interface OwnedBox {
  boxId: string
  type: 'normal' | 'rare' | 'premium'
  acquiredAt: number
  openedAt: number | null
}

/** 상자 개봉 결과. 중복이면 별가루로 전환되고 그 이름표가 여기서 나온다 */
export interface BoxOpen {
  id: string
  boxId: string
  itemId: string
  duplicate: boolean
  openedAt: number
}

/** 하루 판정 네 갈래. 스펙 §4 */
export type DayStatus = 'full' | 'partial' | 'skip' | 'none'

export type PlanetStage = 'seed' | 'moon' | 'planet' | 'ring' | 'satellites' | 'system'
