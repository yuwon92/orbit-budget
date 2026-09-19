import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addMonths, format, parseISO } from 'date-fns'
import {
  categorySpending,
  fixedVsVariable,
  monthSummary,
  spendingChange,
  topExpenses,
  topMemos,
  usageCompliance,
  type CategorySpending,
} from '../lib/analysis'
import { db } from '../lib/db'
import { money } from '../lib/format'
import { useCategories } from '../lib/hooks'
import { monthlyWishDeposit } from '../lib/wish'
import { CategoryPlanet } from './CategoryPlanet'
import { RESERVE_LABEL, UNCATEGORIZED_LABEL } from './MonthSummaryCard'

const shiftMonth = (month: string, delta: number) => format(addMonths(parseISO(`${month}-01`), delta), 'yyyy-MM')

/** 금액 증감 한 줄. 늘면 빨간 점, 줄면 청록 점 — 바탕색은 깔지 않는다 */
function Change({ value, label }: { value: number; label?: string }) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '±'
  return <span className="analysis-change"><i className={value > 0 ? 'up' : 'down'}/>{label && `${label} `}{sign}{money(Math.abs(value))}원</span>
}

function rowLabel(row: CategorySpending) {
  return row.category ?? (row.key === 'reserve' ? RESERVE_LABEL : UNCATEGORIZED_LABEL)
}

/** 달력 요약 카드에서 들어오는 월 분석 화면. 이번 달까지만 넘길 수 있다 */
export function MonthAnalysis({ initialMonth, today, back }: { initialMonth: string; today: string; back: () => void }) {
  const thisMonth = today.slice(0, 7)
  const [month, setMonth] = useState(initialMonth)
  const prevMonth = shiftMonth(month, -1)
  const categories = useCategories() ?? []
  const monthTx = useLiveQuery(() => db.transactions.where('date').startsWith(month).toArray(), [month])
  const prevTx = useLiveQuery(() => db.transactions.where('date').startsWith(prevMonth).toArray(), [prevMonth])
  const rules = useLiveQuery(() => db.recurringRules.toArray(), []) ?? []
  const wishSaved = useLiveQuery(() => monthlyWishDeposit(month), [month])
  useEffect(() => { window.scrollTo(0, 0) }, [])

  const txs = monthTx ?? []
  const summary = monthSummary(txs, month, today)
  const rows = categorySpending(txs, categories, month, rules)
  // 지난달에 기록이 하나도 없으면(첫 달 등) 비교 줄을 모두 뺀다
  const hasPrev = prevTx !== undefined && prevTx.length > 0
  const prevSummary = hasPrev ? monthSummary(prevTx, prevMonth, today) : null
  const changes = hasPrev ? spendingChange(rows, categorySpending(prevTx, categories, prevMonth, rules)) : null
  // 직접 입력 예산은 이력이 없어 지난 달도 지금 값으로 비교한다
  const currentBudgetNote = month < thisMonth && rows.some((row) => row.budgetIsCurrent)
  const net = summary.income - summary.spent
  // 횟수·교통 카테고리의 일/주 몫. 끝난 기간만 센다
  const compliance = usageCompliance(categories, txs, month, today)
  const catMap = new Map(categories.map((category) => [category.id, category]))
  const biggest = topExpenses(txs, month)
  const memos = topMemos(txs, month)
  const split = fixedVsVariable(txs, categories, month)
  const fixedPercent = summary.spent > 0 ? Math.round((split.fixed / summary.spent) * 100) : 0

  return <div className="view analysis-view">
    <div className="page-heading">
      <div>
        <button className="back-button" onClick={back}><ChevronLeft size={16}/> 달력</button>
        <h1>소비 분석</h1>
      </div>
      <div className="month-switch">
        <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달"><ChevronLeft size={18}/></button>
        <div className="month-switch-center"><strong aria-live="polite">{format(parseISO(`${month}-01`), 'yyyy년 M월')}</strong></div>
        <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth} aria-label="다음 달"><ChevronRight size={18}/></button>
      </div>
    </div>

    <section className="analysis-card analysis-summary">
      <p className="eyebrow">총지출</p>
      <strong className="analysis-total">{monthTx ? money(summary.spent) : '—'}<small>원</small></strong>
      <div className="analysis-lines">
        {prevSummary && <Change value={summary.spent - prevSummary.spent} label="지난달 대비"/>}
        {summary.plannedSpent > 0 && <span className="analysis-change"><i className="planned"/>예정 {money(summary.plannedSpent)}원</span>}
      </div>
      <dl className="analysis-stats">
        <div><dt>수입</dt><dd className="income-text">+{money(summary.income)}원</dd></div>
        <div><dt>수입 − 지출</dt><dd className={net > 0 ? 'income-text' : ''}>{net > 0 ? '+' : net < 0 ? '-' : ''}{money(Math.abs(net))}원</dd></div>
        <div><dt>위시 저금</dt><dd>{money(wishSaved ?? 0)}원</dd></div>
        <div><dt>무지출일</dt><dd>{summary.noSpendDays}일 <small>/ {summary.elapsedDays}일</small></dd></div>
      </dl>
    </section>

    <div className="section-heading"><div><p className="eyebrow">BY CATEGORY</p><h2>카테고리별 지출</h2></div></div>
    <section className="analysis-card">
      {rows.length === 0
        ? <p className="empty-note">지출 없음</p>
        : rows.map((row) => {
            const label = rowLabel(row)
            const budgetPercent = row.budget ? Math.round((row.spent / row.budget) * 100) : null
            const change = changes?.get(row.key)
            return <div className="analysis-category" key={row.key}>
              <div className="analysis-category-top">
                <CategoryPlanet color={label.color}/>
                <strong>{label.name}</strong>
                <span className="analysis-share">{row.share}%</span>
                <strong className="analysis-amount">{money(row.spent)}원</strong>
              </div>
              <div className="category-progress"><i style={{ width: `${row.share}%`, background: label.color }}/></div>
              <div className="analysis-category-meta">
                {budgetPercent !== null
                  ? <span className={budgetPercent > 100 ? 'over' : ''}>예산 {money(row.budget!)}원 · {budgetPercent}%</span>
                  : <span>예산 없음</span>}
                {change !== undefined && <Change value={change}/>}
              </div>
            </div>
          })}
      {currentBudgetNote && <p className="analysis-note">직접 입력 예산 · 현재 값 기준</p>}
    </section>

    {compliance.length > 0 && <>
      <div className="section-heading"><div><p className="eyebrow">LIMITS</p><h2>횟수 한도</h2></div></div>
      <section className="analysis-card">
        {compliance.map((row) => {
          const unit = row.scope === 'week' ? '주' : '일'
          return <div className="analysis-category" key={row.category.id}>
            <div className="analysis-category-top">
              <CategoryPlanet color={row.category.color}/>
              <strong>{row.category.name}</strong>
              <span className="analysis-share">{row.scope === 'week' ? '주 단위' : '요일 지정'}</span>
              <strong className="analysis-amount">{row.periods}{unit} 중 {row.kept}{unit}</strong>
            </div>
            <div className="category-progress"><i style={{ width: `${Math.round((row.kept / row.periods) * 100)}%`, background: row.category.color }}/></div>
            <div className="analysis-category-meta">
              <span>자유비용 환급 {money(row.leftover)}원</span>
              {row.over > 0 && <span className="over">초과 {row.over}{unit} · {money(row.overAmount)}원</span>}
            </div>
          </div>
        })}
        {month === thisMonth && <p className="analysis-note">끝난 기간 기준</p>}
      </section>
    </>}

    {summary.spent > 0 && <>
      <div className="section-heading"><div><p className="eyebrow">HABITS</p><h2>소비 습관</h2></div></div>
      <section className="analysis-card analysis-habits">
        <div className="analysis-block">
          <div className="analysis-block-head"><h3>고정비 · 변동비</h3><span>고정비 {fixedPercent}%</span></div>
          <div className="split-bar"><i className="fixed" style={{ width: `${fixedPercent}%` }}/><i className="variable" style={{ width: `${100 - fixedPercent}%` }}/></div>
          <div className="split-legend">
            <span><i className="fixed"/>고정비 {money(split.fixed)}원</span>
            <span><i className="variable"/>변동비 {money(split.variable)}원</span>
          </div>
        </div>

        <div className="analysis-block">
          <div className="analysis-block-head"><h3>큰 지출</h3></div>
          {biggest.map((t) => {
            const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
            const category = t.fromReserve ? RESERVE_LABEL.name : cat?.name ?? UNCATEGORIZED_LABEL.name
            return <div className="analysis-list-row" key={t.id}>
              <span className="analysis-list-date">{format(parseISO(t.date), 'M/d')}</span>
              <CategoryPlanet color={t.fromReserve ? RESERVE_LABEL.color : cat?.color ?? UNCATEGORIZED_LABEL.color}/>
              <span className="analysis-list-name"><strong>{t.memo || category}</strong>{t.memo && <small>{category}</small>}</span>
              <strong>{money(t.amount)}원</strong>
            </div>
          })}
        </div>

        {memos.length > 0 && <div className="analysis-block">
          <div className="analysis-block-head"><h3>자주 쓴 곳</h3></div>
          {memos.map((row, index) => <div className="analysis-list-row" key={row.memo}>
            <span className="analysis-list-date">{index + 1}</span>
            <span className="analysis-list-name"><strong>{row.memo}</strong><small>{row.count}회</small></span>
            <strong>{money(row.total)}원</strong>
          </div>)}
        </div>}
      </section>
    </>}
  </div>
}
