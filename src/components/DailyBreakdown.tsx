import type { CSSProperties } from 'react'
import type { BreakdownRow } from '../lib/budget'
import { money } from '../lib/format'
import type { Category } from '../lib/types'

/**
 * 히어로의 몫 목록. 계산은 budget.ts의 buildBreakdown이 하고 여기선 그리기만 한다.
 * 줄마다 기간이 다를 수 있어서(주 단위 / 오늘) 오른쪽에 기간을 같이 적는다.
 */
export function DailyBreakdown({ rows, categories }: { rows: BreakdownRow[]; categories: Category[] }) {
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const visibleRows = rows.filter((row) => !row.categoryId || !catMap.get(row.categoryId)?.hiddenOnHome)
  if (visibleRows.length <= 1) return null // 자유 한 줄뿐이면 굳이 쪼개 보여주지 않는다

  return (
    <ul className="hero-breakdown">
      {visibleRows.map((row) => {
        const category = row.categoryId ? catMap.get(row.categoryId) : undefined
        const period = row.scope === 'week' ? '이번 주' : '오늘'
        const note =
          row.limit === null
            ? period
            : !row.active
              ? '오늘은 예정 없음'
              : `${period} ${row.used}/${row.limit}회`
        return (
          <li key={row.categoryId ?? 'free'}>
            {/* 클래스 이름 주의: 전역 .dot은 행성 장식용 position:absolute라 쓰면 안 된다 */}
            <span
              className="cat-dot"
              style={{ '--category-color': category?.color ?? '#a8aebb' } as CSSProperties}
            />
            <span className="name">{category?.name ?? '자유'}</span>
            <strong className={row.remaining < 0 ? 'over' : ''}>{money(row.remaining)}원</strong>
            <span className="note">{note}</span>
          </li>
        )
      })}
    </ul>
  )
}
