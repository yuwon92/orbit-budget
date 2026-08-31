import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { format } from 'date-fns'
import { inQuickSlot, quickAddAmount } from '../lib/budget'
import { db } from '../lib/db'
import { money } from '../lib/format'
import { useCategories } from '../lib/hooks'

export interface QuickPreset {
  categoryId: string
  amount?: number // 단가가 없는 카테고리는 금액을 비워 시트를 연다
}

/**
 * 홈 히어로 카드 아래 빠른 기록 줄.
 * 교통은 누르면 편도 요금이 바로 오늘 지출로 들어가고(왕복이면 두 번 누른다),
 * 횟수는 지출 시트를 그 카테고리·단가로 채워서 연다.
 * 잘못 눌렀으면 바로 아래 "오늘 내역"에서 그 행을 눌러 고치거나 지우면 된다.
 */
export function QuickAddOrbs({ openPreset }: { openPreset: (preset: QuickPreset) => void }) {
  const categories = useCategories() ?? []
  const [added, setAdded] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const orbs = categories
    .filter(inQuickSlot)
    .map((category) => ({ category, amount: quickAddAmount(category.budgetRule) }))

  if (orbs.length === 0) return null

  const addNow = async (categoryId: string, amount: number) => {
    await db.transactions.add({
      id: crypto.randomUUID(),
      date: format(new Date(), 'yyyy-MM-dd'),
      amount,
      type: 'expense',
      categoryId,
      memo: '',
      isPlanned: false,
      createdAt: Date.now(),
    })
    setAdded(categoryId)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(null), 1000)
  }

  return (
    <section className="quick-add">
      {orbs.map(({ category, amount }) => {
        // 교통만 한 번 눌러 바로 기록한다. 나머지는 시트를 열어 금액을 확인·수정한다.
        const oneTap = category.budgetRule?.kind === 'commute' && amount !== null
        return (
          <button
            className="quick-orb"
            key={category.id}
            onClick={() =>
              oneTap
                ? addNow(category.id, amount)
                : openPreset({ categoryId: category.id, amount: amount ?? undefined })
            }
            aria-label={
              amount === null
                ? `${category.name} 기록`
                : `${category.name} ${money(amount)}원 ${oneTap ? '바로 기록' : '기록'}`
            }
          >
            <span className="orb" style={{ '--category-color': category.color } as CSSProperties}>
              {category.name}
            </span>
            <small>
              {added === category.id ? '추가됨' : amount === null ? '직접 입력' : `${money(amount)}원`}
            </small>
          </button>
        )
      })}
    </section>
  )
}
