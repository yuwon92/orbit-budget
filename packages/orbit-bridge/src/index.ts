import { monthlyFreeAmount } from '@orbit/budget-core/budget'
import type { Category } from '@orbit/budget-core/types'
import { db } from './db'

export interface OrbitSnapshot {
  connected: boolean
  freeAmount: number
  reserveAmount: number
  categories: Category[]
}

/** Wish에 필요한 최소한의 예산 정보만 읽어 제공한다. */
export async function getOrbitSnapshot(
  today: string,
  includePlannedIncome = true,
): Promise<OrbitSnapshot> {
  const month = today.slice(0, 7)
  const [categories, transactions, settings] = await Promise.all([
    db.categories.toArray(),
    db.transactions.where('date').startsWith(month).toArray(),
    db.monthSettings.get(month),
  ])
  const reserveAmount = settings?.reserveAmount ?? 0

  return {
    connected: true,
    freeAmount: monthlyFreeAmount(transactions, categories, today, reserveAmount, includePlannedIncome),
    reserveAmount,
    categories: categories.sort((a, b) => a.sortOrder - b.sortOrder),
  }
}
