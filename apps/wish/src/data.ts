// 샘플 데이터. 새로고침하면 초기화된다. 실제 저장은 다음 단계에서 wish-bridge가 맡는다.
// 타입은 실제 모델 그대로라 Dexie를 붙일 때 화면 코드를 다시 고치지 않는다.
import { addDays, seedFromId } from '@orbit/wish-core/wish'
import type { Claim, Wish, WishEvent } from '@orbit/wish-core/types'
import { todayString } from './lib/format'

const today = todayString()
const ago = (days: number) => addDays(today, -days)

let seq = 0
const event = (over: Omit<WishEvent, 'id' | 'createdAt'>): WishEvent => ({
  id: `sample-${(seq += 1)}`,
  createdAt: seq,
  ...over,
})

const wish = (over: Omit<Wish, 'seed' | 'createdAt'>): Wish => ({
  ...over,
  seed: seedFromId(over.id),
  createdAt: 0,
})

/** 하루 몫을 며칠에 걸쳐 넣은 기록. 연속 기록과 지킨 날이 살아 보이게 한다 */
function depositRun(wishId: string, days: number[], amount: number) {
  return days.map((day) => event({ wishId, type: 'deposit', amount, date: ago(day) }))
}

export const SAMPLE_WISHES: Wish[] = [
  wish({
    id: 'headphones',
    name: '오래 쓸 헤드폰',
    targetAmount: 320_000,
    savedAmount: 217_000,
    startDate: ago(22),
    targetDate: addDays(today, 18),
    status: 'active',
  }),
  wish({
    id: 'desk-lamp',
    name: '작업실 조명',
    targetAmount: 86_000,
    savedAmount: 86_000,
    startDate: ago(14),
    targetDate: addDays(today, 9),
    status: 'waiting',
  }),
  wish({
    id: 'camera',
    name: '필름 카메라',
    targetAmount: 210_000,
    savedAmount: 210_000,
    startDate: ago(70),
    targetDate: ago(36),
    status: 'done',
  }),
  wish({
    id: 'chair',
    name: '독서 의자',
    targetAmount: 168_000,
    savedAmount: 168_000,
    startDate: ago(120),
    targetDate: ago(99),
    status: 'done',
  }),
  wish({
    id: 'ticket',
    name: '공연 티켓',
    targetAmount: 132_000,
    savedAmount: 132_000,
    startDate: ago(170),
    targetDate: ago(152),
    status: 'done',
  }),
]

export const SAMPLE_EVENTS: WishEvent[] = [
  // 진행 중인 헤드폰: 최근 6일 연속 + 그 전 기록
  ...depositRun('headphones', [22, 21, 20, 18, 17, 15, 14, 12, 11, 9], 12_000),
  ...depositRun('headphones', [6, 5, 4, 3, 2, 1], 16_000),
  event({ wishId: 'headphones', type: 'skip', date: ago(7) }),
  event({ wishId: 'headphones', type: 'deposit', amount: 12_400, date: ago(8), source: 'carryover' }),

  // 목표를 채우고 기다리는 중인 조명
  ...depositRun('desk-lamp', [14, 13, 12, 10, 9, 8, 6], 12_000),
  event({ wishId: 'desk-lamp', type: 'wait', date: ago(2) }),
  event({ wishId: 'desk-lamp', type: 'wait', date: ago(1) }),

  // 완주한 위시들
  ...depositRun('camera', [70, 69, 68, 66, 65, 63, 60, 58, 55, 52, 48, 44, 40, 38], 15_000),
  event({ wishId: 'camera', type: 'purchase', date: ago(36) }),
  ...depositRun('chair', [120, 118, 116, 113, 110, 108, 105, 102, 100], 18_666),
  event({ wishId: 'chair', type: 'purchase', date: ago(99) }),
  ...depositRun('ticket', [170, 168, 166, 163, 160, 158, 155], 18_857),
  event({ wishId: 'ticket', type: 'purchase', date: ago(152) }),
]

/** 지난 기록은 이미 수령한 것으로 둔다. 오늘 것만 수령 대기로 남는다 */
export const SAMPLE_CLAIMS: Claim[] = SAMPLE_EVENTS.filter((item) => item.date !== today).flatMap((item) => {
  const claim = (missionId: string): Claim => ({
    id: `${item.date}:${missionId}`,
    date: item.date,
    missionId,
    createdAt: 0,
  })
  if (item.type === 'deposit') {
    return item.source === 'carryover'
      ? [claim(`share-${item.wishId}`), claim('carryover')]
      : [claim(`share-${item.wishId}`)]
  }
  if (item.type === 'wait') return [claim(`wait-${item.wishId}`)]
  return []
})

/** Orbit 연동 전까지 쓰는 자유비용·남은 예산 샘플 값 */
export const SAMPLE_FREE_AMOUNT = 92_400
export const SAMPLE_CARRYOVER = 12_400
