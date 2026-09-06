// 오늘의 미션 목록. 앱 고유 개념이라 wish-core가 아니라 여기에 둔다.
// 배점과 수령 판정은 wish-core를 그대로 쓰고, 여기서는 문구와 상태만 만든다.
import { dailyShare, dayStatus, remainingDays } from '@orbit/wish-core/wish'
import { XP, claimIdOf, missionUnits } from '@orbit/wish-core/xp'
import type { Claim, Wish, WishEvent } from '@orbit/wish-core/types'
import type { MissionKind } from '@orbit/wish-core/xp'

/** todo = 아직 안 함 · claimable = 하고 나서 수령 대기 · claimed = 수령 완료 */
export type MissionState = 'todo' | 'claimable' | 'claimed'

export interface Mission {
  /** 수령 키의 뒷부분. `${date}:${id}`가 Claim의 id가 된다 */
  id: string
  date: string
  kind: MissionKind
  title: string
  detail: string
  xp: number
  state: MissionState
  wishId?: string
  wishName?: string
  /** 건너뛴 날처럼 이미 지났지만 받을 XP가 없는 경우 */
  skipped?: boolean
}

export function buildMissions(
  wishes: Wish[],
  events: WishEvent[],
  claims: Claim[],
  today: string,
  carryoverAmount: number,
): Mission[] {
  const claimed = new Set(claims.map((claim) => claim.id))
  const units = missionUnits(wishes, events).filter((unit) => unit.date === today)
  const unitOf = (missionId: string) => units.find((unit) => unit.missionId === missionId)
  const stateOf = (missionId: string, acted: boolean): MissionState => {
    if (!acted) return 'todo'
    return claimed.has(claimIdOf(today, missionId)) ? 'claimed' : 'claimable'
  }

  const list: Mission[] = []

  for (const wish of wishes) {
    if (wish.status === 'active') {
      // 기간 없는 위시는 하루 몫이 없어 미션도 만들지 않는다. 넣으면 부분 납입으로만 쌓인다
      if (!wish.targetDate) continue
      const id = `share-${wish.id}`
      const status = dayStatus(wish, events, today)
      const share = dailyShare(wish, events, today)
      const days = remainingDays(wish, today)
      const unit = unitOf(id)
      list.push({
        id,
        date: today,
        kind: 'share',
        title: share ? `${share.toLocaleString('ko-KR')}원 모으기` : '저금하기',
        detail: status === 'skip' ? '오늘은 쉬어감' : days ? `${days}일 남음` : '기간 없음',
        xp: unit?.xp ?? XP.share,
        state: status === 'skip' ? 'claimed' : stateOf(id, status !== 'none'),
        wishId: wish.id,
        wishName: wish.name,
        skipped: status === 'skip',
      })
    }

    if (wish.status === 'waiting') {
      const id = `wait-${wish.id}`
      const acted = events.some(
        (event) => event.wishId === wish.id && event.type === 'wait' && event.date === today,
      )
      list.push({
        id,
        date: today,
        kind: 'wait',
        title: '하루 더 기다리기',
        detail: '목표 달성',
        xp: XP.wait,
        state: stateOf(id, acted),
        wishId: wish.id,
        wishName: wish.name,
      })
    }
  }

  if (carryoverAmount > 0) {
    const acted = events.some((event) => event.date === today && event.source === 'carryover')
    list.push({
      id: 'carryover',
      date: today,
      kind: 'carryover',
      title: `${carryoverAmount.toLocaleString('ko-KR')}원 저금하기`,
      detail: '어제 남은 예산',
      xp: XP.carryover,
      state: stateOf('carryover', acted),
    })
  }

  return list
}
