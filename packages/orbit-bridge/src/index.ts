import { monthlyFreeAmount } from '@orbit/budget-core/budget'
import type { Category, Transaction } from '@orbit/budget-core/types'
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
  /** 이번 달 위시 저금 합계. 위 freeAmount에서 이미 빠져 있다 */
  wishSavedAmount: number
  /** 스냅샷을 만든 시각. 오프라인일 때 얼마나 오래됐는지 보여주는 데 쓴다 */
  calculatedAt: number
  /** 스냅샷 구조 버전 */
  version: number
  /** Orbit을 실제로 쓴 흔적이 있는지. 새로 만들어진 빈 DB와 구분한다 */
  connected: boolean
  /** 위시 구매에서 선택할 수 있는 Orbit 카테고리 */
  categories: Category[]
  /** 무엇을 읽었는지 그대로 보여주는 진단값. 연결 문제를 눈으로 가릴 수 있게 한다 */
  probe: SnapshotProbe
}

export interface SnapshotProbe {
  /** 전체 거래 수 */
  transactions: number
  /** 이번 달 거래 수 */
  monthTransactions: number
  categories: number
  /** 월 예산이 잡힌 카테고리 수 */
  budgetedCategories: number
  /** 이번 달 예비비 설정이 있는지 */
  hasMonthSettings: boolean
  includePlannedIncome: boolean
}

export const SNAPSHOT_VERSION = 2

/**
 * Orbit 예산을 읽어 요약을 만든다.
 *
 * `connected`는 DB가 열리는지가 아니라 **데이터가 있는지**로 판단한다.
 * 저장소가 분리된 환경에서는 빈 DB가 새로 만들어지기만 하므로,
 * DB 존재 여부로 판단하면 연결됐다고 잘못 말하게 된다.
 *
 * 위시 저금액은 주입만 받는다. 여기서 Wish DB를 읽으면 경계가 순환한다
 * (orbit-bridge는 wish-bridge를 몰라야 한다).
 */
export async function getOrbitSnapshot(
  today: string,
  includePlannedIncome = readPlannedIncome(),
  wishSavedAmount = 0,
): Promise<OrbitBudgetSnapshot> {
  const yearMonth = today.slice(0, 7)
  const [categories, transactions, settings, totalTransactions] = await Promise.all([
    db.categories.toArray(),
    db.transactions.where('date').startsWith(yearMonth).toArray(),
    db.monthSettings.get(yearMonth),
    db.transactions.count(),
  ])
  const reserveAmount = settings?.reserveAmount ?? 0
  const budgetedCategories = categories.filter((category) => category.monthlyBudget > 0).length

  // 카테고리 존재만으로는 판단할 수 없다. 처음 열리는 DB에 기본 카테고리 4개가
  // 자동으로 심어지기 때문에(db.on('populate')), 저장소가 분리된 환경에서도
  // 카테고리는 항상 있다. 실제로 쓴 흔적으로만 연결을 판정한다.
  const connected = totalTransactions > 0 || budgetedCategories > 0 || settings !== undefined

  return {
    yearMonth,
    freeAmount: monthlyFreeAmount(transactions, categories, today, reserveAmount, includePlannedIncome, wishSavedAmount),
    reserveAmount,
    wishSavedAmount,
    calculatedAt: Date.now(),
    version: SNAPSHOT_VERSION,
    connected,
    categories: [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    probe: {
      transactions: totalTransactions,
      monthTransactions: transactions.length,
      categories: categories.length,
      budgetedCategories,
      hasMonthSettings: settings !== undefined,
      includePlannedIncome,
    },
  }
}

export interface WishPurchaseInput {
  id: string
  wishName: string
  amount: number
  date: string
  categoryId: string | null
}

/**
 * 위시 구매를 Orbit 거래로 기록한다. id를 호출자가 정하고 put을 써서,
 * 두 DB 사이 저장이 중간에 끊겨도 같은 id로 안전하게 다시 시도할 수 있다.
 */
export async function createWishPurchaseTransaction(input: WishPurchaseInput): Promise<Transaction> {
  const transaction: Transaction = {
    id: input.id,
    date: input.date,
    amount: input.amount,
    type: 'expense',
    categoryId: input.categoryId,
    memo: `Wish · ${input.wishName}`,
    isPlanned: false,
    createdAt: Date.now(),
    excludedFromFreeAmount: true,
  }
  await db.transactions.put(transaction)
  return transaction
}

export { readPlannedIncome, writePlannedIncome, PLANNED_INCOME_KEY } from './settings'
