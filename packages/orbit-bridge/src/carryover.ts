// 이월 원장. 달마다 「그 달이 받은 이월」을 monthSettings에 굳혀 둔다.
//
// 굳혀 두는 이유는 읽는 양이다. 마감 잔액은 앞 달 잔액을 그대로 얹어 넘기므로,
// 저장해 두지 않으면 이번 달 이월을 알기 위해 첫 달까지 거슬러 올라가야 한다.
// 한 칸씩 굴려 저장하면 지난달 한 달치만 읽으면 된다.
//
// 굴리는 계산은 budget-core의 `rollCarryoverForward`에 있다. 여기는 읽기·쓰기만
// 맡는다 — 계산이 DB에 붙어 있으면 검산 스크립트가 닿지 못한다.

import { monthsBetween, rollCarryoverForward } from '@orbit/budget-core/budget'
import { db } from './db'
import { ensureCarryoverStart, readPlannedIncome } from './settings'

/**
 * 그 달 설정 줄에 이월액만 써 넣는다. 예비비는 건드리지 않는다.
 *
 * **0을 새 줄로 만들지 않는다.** Wish는 `monthSettings` 줄이 있는지를 「Orbit을 쓴
 * 흔적」으로 읽는다(`getOrbitSnapshot`의 `connected`). 빈 DB에 줄을 만들면 저장소가
 * 분리된 환경에서 연결됐다고 잘못 말하게 되고, 마지막 캐시로 되돌아가는 안전장치가 죽는다.
 */
async function writeCarriedIn(month: string, carriedIn: number) {
  const existing = await db.monthSettings.get(month)
  if (!existing && carriedIn === 0) return
  await db.monthSettings.put({
    ...existing,
    yearMonth: month,
    reserveAmount: existing?.reserveAmount ?? 0,
    carriedIn,
  })
}

/**
 * 이월 원장을 이번 달까지 굴린다. 앱을 열 때, 날짜가 바뀔 때, 예정 수입 설정을
 * 바꿨을 때 부른다.
 *
 * 보통은 **지난달 한 달치 거래만 읽는다** — 지난달이 받은 이월은 이미 굳어 있으므로
 * 거기에 지난달 수지를 얹으면 이번 달 이월이 나온다.
 *
 * 이번 달 값은 부를 때마다 다시 계산해 덮어쓴다. 그래야 10월 2일에 9월 30일 지출을
 * 뒤늦게 넣어도 반영된다. 반대로 **지난달 이전 기록을 고치면 반영되지 않는다** —
 * 그 달들의 이월은 이미 굳었고, 되살리려면 다시 과거를 전부 읽어야 한다.
 *
 * 위시 저금은 달마다 값이 달라 조회 함수를 주입받는다 — 이 패키지가 Wish DB를
 * 직접 읽으면 경계가 순환한다(orbit-bridge는 wish-bridge를 몰라야 한다).
 */
export async function rollCarryover(
  today: string,
  wishSavedOf: (month: string) => Promise<number> = async () => 0,
  includePlannedIncome = readPlannedIncome(),
): Promise<void> {
  const month = today.slice(0, 7)
  const start = ensureCarryoverStart(month)
  // 시작 달은 받을 것이 없다. 0짜리 줄도 만들지 않는다 (위 writeCarriedIn 주석).
  if (month <= start) return

  // 굳어 있는 가장 최근 달에서 출발한다. 달마다 한 줄뿐인 작은 표다.
  // 이번 달 줄은 건너뛴다 — 그래야 매번 지난달에서 다시 계산해 덮어쓴다.
  const rows = await db.monthSettings.toArray()
  let base = start
  let carried = 0
  for (const row of rows) {
    if (row.carriedIn === undefined) continue
    if (row.yearMonth < base || row.yearMonth >= month) continue
    base = row.yearMonth
    carried = row.carriedIn
  }

  const since = await db.transactions
    .where('date')
    .between(`${base}-01`, `${month}-01`, true, false)
    .toArray()

  // 위시 저금은 다른 DB라 트랜잭션 밖에서 미리 모은다.
  const wishSavedByMonth = new Map<string, number>()
  for (const cursor of monthsBetween(base, month)) {
    wishSavedByMonth.set(cursor, await wishSavedOf(cursor))
  }

  const steps = rollCarryoverForward(since, base, month, carried, wishSavedByMonth, includePlannedIncome)
  await db.transaction('rw', db.monthSettings, async () => {
    for (const step of steps) await writeCarriedIn(step.month, step.carriedIn)
  })
}
