import { monthlyFreeAmount } from '@orbit/budget-core/budget'
import { db } from './db'
import { readPlannedIncome } from './settings'

/**
 * Wish가 읽는 예산 요약. 계산은 Orbit이 하고 Wish는 결과만 본다 —
 * 같은 계산을 두 곳에서 하면 숫자가 갈라진다.
 *
 * 나중에 도메인을 나눠 서버를 거치게 되어도 이 모양 그대로 주고받는다.
 */
export interface OrbitBudgetSnapshot {
  /** 'yyyy-MM' */
  yearMonth: string
  freeAmount: number
  reserveAmount: number
  /** 스냅샷을 만든 시각. 오프라인일 때 얼마나 오래됐는지 보여주는 데 쓴다 */
  calculatedAt: number
  /** 스냅샷 구조 버전 */
  version: number
  /** Orbit에 실제 데이터가 있는지. 빈 DB를 읽은 것과 구분한다 */
  connected: boolean
}

export const SNAPSHOT_VERSION = 1

/**
 * Orbit 예산을 읽어 요약을 만든다.
 *
 * `connected`는 DB가 열리는지가 아니라 **데이터가 있는지**로 판단한다.
 * 저장소가 분리된 환경에서는 빈 DB가 새로 만들어지기만 하므로,
 * DB 존재 여부로 판단하면 연결됐다고 잘못 말하게 된다.
 *
 * 위시 저금액을 자유비용에서 빼는 것은 다음 단계다. 그때 여기에 인자로 주입한다 —
 * 이 안에서 Wish DB를 읽으면 경계가 순환한다.
 */
export async function getOrbitSnapshot(
  today: string,
  includePlannedIncome = readPlannedIncome(),
): Promise<OrbitBudgetSnapshot> {
  const yearMonth = today.slice(0, 7)
  const [categories, transactions, settings] = await Promise.all([
    db.categories.toArray(),
    db.transactions.where('date').startsWith(yearMonth).toArray(),
    db.monthSettings.get(yearMonth),
  ])
  const reserveAmount = settings?.reserveAmount ?? 0

  return {
    yearMonth,
    freeAmount: monthlyFreeAmount(transactions, categories, today, reserveAmount, includePlannedIncome),
    reserveAmount,
    calculatedAt: Date.now(),
    version: SNAPSHOT_VERSION,
    connected: categories.length > 0 || transactions.length > 0,
  }
}

export { readPlannedIncome, writePlannedIncome, PLANNED_INCOME_KEY } from './settings'
