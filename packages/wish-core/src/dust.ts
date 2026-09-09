// 별가루. XP와 나란히 가는 두 번째 재화지만 저장 방식이 정반대다.
//
// XP는 저장하지 않고 이벤트에서 매번 다시 계산한다. 그래서 배점을 고치면 과거
// 기록도 새 배점으로 다시 계산된다. 별가루는 원장에 한 줄씩 쌓고 잔액은 그 합계라
// 배점을 고쳐도 이미 지급된 줄은 그대로 남는다. 의도한 차이다.
//
// 「이름표」— 지급 한 줄마다 고유한 id를 붙이고, 저장할 때 이미 있으면 건너뛴다.
// 버튼을 두 번 누르든 지급 도중 앱이 꺼지든 새로고침을 하든 결과가 한 번 지급한
// 것과 같아진다. 그래서 이름표를 만드는 함수는 결정적이어야 한다 — 같은 입력이면
// 언제 몇 번을 돌려도 같은 값이 나와야 한다. now는 createdAt에만 쓰고 id에는 섞지
// 않는다.
//
// ⚠ 연속 7일 이름표의 앞으로의 위험 — streak7 이름표는 7일 묶음의 마지막 날짜다.
// 지금은 모든 저금이 오늘 날짜로만 기록돼서 묶음 경계가 앞으로만 자라 안전하다.
// 나중에 「지난 날짜로 저금 입력」을 만들면 중간 구멍이 메워지면서 묶음이 합쳐지고
// 경계 날짜가 밀린다. 그러면 이미 지급한 streak7:2026-09-15 줄과 새로 나온
// streak7:2026-09-18 줄이 둘 다 남아 이중 지급이 된다. 그 기능을 만들 때 이 파일을
// 반드시 다시 볼 것.

import { XP, streakBlockEnds, type MissionUnit } from './xp.ts'
import type { Claim, Wish, WishEvent } from './types.ts'

/**
 * 별가루 배점. 스펙 §4 표를 그대로 옮긴 상수다.
 * XP에서 유도하지 않는다 — 대체로 절반이지만 연속 7일만 1:1(30/30),
 * 첫 위시는 0.4배(50/20)라 규칙이 없다.
 */
export const DUST = {
  /** 하루 몫 부분 납입 */
  partial: 2,
  /** 하루 몫 전액 */
  share: 5,
  /** 목표를 채우고도 하루 더 기다림 */
  wait: 10,
  /** 남은 예산 넘기기 */
  carryover: 15,
  /** 연속 7일마다 */
  streak7: 30,
  /** 위시 완주 */
  complete: 50,
  /** 첫 위시 등록 */
  firstWish: 20,
} as const

export type DustType = 'earn' | 'spend'
export type DustSourceType = 'mission' | 'bonus' | 'level' | 'purchase' | 'box' | 'duplicate'

export interface DustRow {
  /** 고유 이름표. 같은 사건이면 언제 만들어도 이 값이 같다 */
  id: string
  type: DustType
  /** 항상 양수. 획득인지 소비인지는 type이 가른다 */
  amount: number
  sourceType: DustSourceType
  /** id와 같은 값. 화면에서 출처를 읽는 용도 */
  sourceId: string
  createdAt: number
}

const earn = (id: string, amount: number, sourceType: DustSourceType, now: number): DustRow =>
  ({ id, type: 'earn', amount, sourceType, sourceId: id, createdAt: now })

/**
 * 잔액 = 원장 합계. 같은 이름표가 섞여 들어와도 한 번만 센다.
 * 저장 단계에서 이미 막지만, 저장 전 줄을 미리 더해 볼 때도 값이 맞아야 한다.
 */
export const stardustBalance = (rows: DustRow[]): number =>
  [...new Map(rows.map((row) => [row.id, row])).values()]
    .reduce((sum, row) => sum + (row.type === 'earn' ? row.amount : -row.amount), 0)

/**
 * 미션 하나가 만들어 낼 별가루 줄. 수령 여부는 보지 않는다 —
 * 수령 전 화면에 「받으면 얼마」를 보여줄 때도 같은 함수를 쓴다.
 *
 * 하루 몫은 기본 줄을 항상 부분 납입 값(2)으로 내고, 그 날이 전액이면 차액 3을
 * :topup 줄로 하나 더 낸다. 원장을 읽지 않아도 결과가 항상 같아진다 —
 * 부분으로 받아 둔 날을 전액으로 채워도 합계가 5로 맞는다.
 */
export function missionDustRows(units: MissionUnit[], now: number): DustRow[] {
  return units.flatMap((unit) => {
    const id = `mission:${unit.date}:${unit.missionId}`
    if (unit.kind === 'share') {
      const base = earn(id, DUST.partial, 'mission', now)
      if (unit.xp < XP.share) return [base]
      return [base, earn(`${id}:topup`, DUST.share - DUST.partial, 'mission', now)]
    }
    return [earn(id, unit.kind === 'wait' ? DUST.wait : DUST.carryover, 'mission', now)]
  })
}

/** 실제로 수령한 미션만 지급 대상이다 */
export function missionDustGrants(units: MissionUnit[], claims: Claim[], now: number): DustRow[] {
  const claimed = new Set(claims.map((claim) => claim.id))
  return missionDustRows(units.filter((unit) => claimed.has(`${unit.date}:${unit.missionId}`)), now)
}

/**
 * 수령 버튼이 없는 보너스. 완주·첫 위시·연속 7일은 영수증이 없어서 별가루를 걸 데가
 * 없다. 대신 「있어야 할 줄」을 전부 만들어 보내고 저장 단계에서 없는 것만 남긴다.
 */
export function bonusDustGrants(wishes: Wish[], events: WishEvent[], now: number): DustRow[] {
  const rows: DustRow[] = []
  if (wishes.length > 0) rows.push(earn('firstwish:me', DUST.firstWish, 'bonus', now))
  for (const wish of wishes) {
    if (wish.status === 'done') rows.push(earn(`complete:${wish.id}`, DUST.complete, 'bonus', now))
  }
  for (const endDate of streakBlockEnds(events)) {
    rows.push(earn(`streak7:${endDate}`, DUST.streak7, 'bonus', now))
  }
  return rows
}
