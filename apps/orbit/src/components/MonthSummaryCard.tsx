import { ChevronRight } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addMonths, format, parseISO } from 'date-fns'
import { categorySpending, monthSummary } from '../lib/analysis'
import { db } from '../lib/db'
import { money } from '../lib/format'
import type { Category, Transaction } from '../lib/types'
import { CategoryPlanet } from './CategoryPlanet'

/** 예비비·미분류 줄 이름과 색. 카테고리 줄은 카테고리 것을 쓴다 */
export const RESERVE_LABEL = { name: '예비비', color: '#b7a7f8' }
export const UNCATEGORIZED_LABEL = { name: '미분류', color: '#9aa3b4' }

/**
 * 달력 밑 그 달 소비 한 장 요약. 보고 있는 달의 거래는 달력이 이미 읽어 둔 것을 받고,
 * 지난달 비교용 거래만 여기서 한 번 더 읽는다.
 */
export function MonthSummaryCard({ month, today, transactions, categories, onOpen }: {
  month: string
  today: string
  transactions: Transaction[]
  categories: Category[]
  onOpen?: () => void
}) {
  const prevMonth = format(addMonths(parseISO(`${month}-01`), -1), 'yyyy-MM')
  const prevTx = useLiveQuery(() => db.transactions.where('date').startsWith(prevMonth).toArray(), [prevMonth])
  const summary = monthSummary(transactions, month, today)
  const top = categorySpending(transactions, categories, month)[0]
  // 지난달에 기록이 하나도 없으면(첫 달 등) 비교할 기준이 없다
  const change = prevTx && prevTx.length > 0 ? summary.spent - monthSummary(prevTx, prevMonth, today).spent : null
  const label = top?.category ?? (top?.key === 'reserve' ? RESERVE_LABEL : UNCATEGORIZED_LABEL)

  const body = <>
    <div className="month-summary-head">
      <p className="eyebrow">{Number(month.slice(5))}월 소비</p>
      {onOpen && <span className="month-summary-more">분석 보기 <ChevronRight size={15}/></span>}
    </div>
    <strong className="month-summary-total">{money(summary.spent)}<small>원</small></strong>
    <div className="month-summary-lines">
      {change !== null && <span><i className={change > 0 ? 'up' : 'down'}/>지난달 대비 {change > 0 ? '+' : change < 0 ? '-' : '±'}{money(Math.abs(change))}원</span>}
      {summary.plannedSpent > 0 && <span><i className="planned"/>예정 {money(summary.plannedSpent)}원</span>}
    </div>
    {top
      ? <p className="month-summary-top"><CategoryPlanet color={label.color}/><span>최다 지출 {label.name}</span><strong>{money(top.spent)}원 · {top.share}%</strong></p>
      : <p className="month-summary-top empty">지출 없음</p>}
  </>

  return onOpen
    ? <button className="month-summary-card" onClick={onOpen} aria-label={`${Number(month.slice(5))}월 소비 분석 보기`}>{body}</button>
    : <section className="month-summary-card">{body}</section>
}
