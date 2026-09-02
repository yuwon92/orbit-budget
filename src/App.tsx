import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Home,
  ListFilter,
  Moon,
  MoreHorizontal,
  Plus,
  Repeat2,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, addMonths, format, getDaysInMonth, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { buildBreakdown, inQuickSlot, monthlyFreeAmount, spentByCategory, spentOnDate } from './lib/budget'
import { db, requestPersistentStorage, setQuickSlot } from './lib/db'
import { money } from './lib/format'
import { useCategories } from './lib/hooks'
import type { Transaction } from './lib/types'
import { buildCsv, downloadCsv } from './lib/csv'
import { materializeRecurring, syncRuleBudgets } from './lib/recurring'
import { CategoryPlanet } from './components/CategoryPlanet'
import { DailyBreakdown } from './components/DailyBreakdown'
import { CategorySettings } from './components/CategorySettings'
import { ExpenseSheet } from './components/ExpenseSheet'
import { QuickAddOrbs, type QuickPreset } from './components/QuickAddOrbs'
import { RecurringSettings } from './components/RecurringSettings'
import { ReserveSheet } from './components/ReserveSheet'

type Tab = 'home' | 'calendar' | 'transactions' | 'settings'
type SettingsSub = 'categories' | 'recurring' | null

function useToday(): string {
  const getToday = () => format(new Date(), 'yyyy-MM-dd')
  const [today, setToday] = useState(getToday)
  useEffect(() => {
    const timer = window.setInterval(() => setToday((current) => {
      const next = getToday()
      return next === current ? current : next
    }), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return today
}

function Planet({ small = false }: { small?: boolean }) {
  return (
    <div className={`planet-wrap ${small ? 'planet-small' : ''}`} aria-hidden="true">
      <div className="planet-orbit orbit-back" />
      <div className="planet-body">
        <span className="patch patch-one" />
        <span className="patch patch-two" />
        <span className="patch patch-three" />
        <span className="pixel pixel-one" />
        <span className="pixel pixel-two" />
      </div>
      <div className="planet-orbit orbit-front" />
      {!small && <><i className="star star-a" /><i className="star star-b" /><i className="dot dot-a" /><i className="dot dot-b" /></>}
    </div>
  )
}

function Header({ dark, onTheme }: { dark: boolean; onTheme: () => void }) {
  return (
    <header className="topbar">
      <div className="wordmark"><span className="logo-orbit"><i /></span><strong>orbit</strong></div>
      <div className="header-actions">
        <button className="icon-button desktop-search" aria-label="검색"><Search size={19} /></button>
        <button className="icon-button" onClick={onTheme} aria-label="테마 전환">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
      </div>
    </header>
  )
}

function Sidebar({ active, setActive }: { active: Tab; setActive: (tab: Tab) => void }) {
  const items: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: 'home', label: '홈', icon: Home },
    { id: 'calendar', label: '달력', icon: CalendarDays },
    { id: 'transactions', label: '거래 내역', icon: ListFilter },
    { id: 'settings', label: '설정', icon: Settings },
  ]
  const month = format(new Date(), 'yyyy-MM')
  const usage = useLiveQuery(async () => {
    const txs = await db.transactions.where('date').startsWith(month).toArray()
    const income = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    const expense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    return income > 0 ? Math.round(expense / income * 100) : 0
  }, [month])
  return <aside className="sidebar"><nav>{items.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => setActive(item.id)} className={active === item.id ? 'active' : ''}><Icon size={19}/><span>{item.label}</span></button> })}</nav><div className="month-chip"><Planet small/><div><span>{Number(month.slice(5))}월의 행성</span><strong>{usage ?? 0}% 사용 중</strong></div></div></aside>
}

function HomeView({ openExpense, openEdit, openPreset, goTransactions, goCategories }: { openExpense: () => void; openEdit: (t: Transaction) => void; openPreset: (preset: QuickPreset) => void; goTransactions: () => void; goCategories: () => void }) {
  const categories = useCategories() ?? []
  const today = format(new Date(), 'yyyy-MM-dd')
  const month = today.slice(0, 7)
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const monthTx = useLiveQuery(() => db.transactions.where('date').startsWith(month).toArray(), [month])
  const settings = useLiveQuery(() => db.monthSettings.get(month), [month])
  const loaded = monthTx !== undefined
  const txs = monthTx ?? []
  const [menuFor, setMenuFor] = useState<string | null>(null)
  useEffect(() => {
    if (!menuFor) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuFor(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuFor])

  const todaySpent = spentOnDate(txs, today)
  const spent = spentByCategory(txs, month)
  const todayTx = loaded
    ? txs.filter(t => t.date === today).sort((a, b) => a.createdAt - b.createdAt)
    : undefined
  const freeRemaining = monthlyFreeAmount(txs, categories, today, settings?.reserveAmount ?? 0)
  // 카테고리 이름이 아니라 각 카테고리에 저장된 일/주 주기 설정을 순회한다.
  const rows = buildBreakdown(categories, txs, today)
  const over = freeRemaining < 0
  const toggleHidden = async (category: typeof categories[number]) => {
    setMenuFor(null)
    await db.categories.update(category.id, { hiddenOnHome: !category.hiddenOnHome })
  }
  const toggleQuickSlot = async (category: typeof categories[number]) => {
    setMenuFor(null)
    await setQuickSlot(categories, category, !inQuickSlot(category))
  }
  return <div className="view home-view" onClick={() => menuFor && setMenuFor(null)}>
    <section className="hero-card">
      <div className="hero-copy">
        <p className="eyebrow">{format(new Date(), 'M월 d일, EEEE', { locale: ko })}</p>
        <p className="hero-label">남은 자유비용</p>
        <h1 className={over ? 'negative' : ''}><span>{loaded ? money(freeRemaining) : '—'}</span><small>원</small></h1>
        <p className="hero-note">오늘 {money(todaySpent)}원을 사용했어요</p>
        {loaded && <DailyBreakdown rows={rows} categories={categories}/>}
      </div>
      <Planet />
    </section>

    <QuickAddOrbs openPreset={openPreset} goCategories={goCategories} />

    <div className="section-heading"><div><p className="eyebrow">MONTHLY PLAN</p><h2>이번 달 예산</h2></div><button className="text-button" onClick={goCategories}>편집 <ChevronRight size={16}/></button></div>
    {categories.length === 0 && loaded && <section className="transaction-card">
      <div className="empty-state">
        <span className="empty-planet" aria-hidden="true" />
        <strong>아직 카테고리가 없어요</strong>
        <p>카테고리를 만들면 이번 달 소비가 여기에 보여요.</p>
        <button className="outline-button" onClick={goCategories}>카테고리 관리로 이동</button>
      </div>
    </section>}
    <section className="category-grid">
      {categories.map((category) => {
        const used = spent.get(category.id) ?? 0
        // 예산을 안 정한 카테고리는 진행률의 기준이 없어서 쓴 금액만 보여준다.
        const hasBudget = category.monthlyBudget > 0
        const progress = hasBudget ? Math.round(used / category.monthlyBudget * 100) : 0
        const barColor = progress >= 100 ? '#ef7777' : progress >= 80 ? '#e7b96a' : category.color
        // 홈 요약에 오르는 건 횟수·교통뿐이라 그 항목은 해당 카테고리에만 띄운다.
        // 퀵 슬롯은 모든 카테고리가 넣고 뺄 수 있다.
        const canToggleHome = category.budgetRule?.kind === 'perUse' || category.budgetRule?.kind === 'commute'
        const open = menuFor === category.id
        return <article className="category-card" key={category.id}>
          <div className="category-top">
            <CategoryPlanet color={category.color}/>
            <button aria-label="더 보기" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setMenuFor(open ? null : category.id) }}><MoreHorizontal size={18}/></button>
          </div>
          {open && <div className="card-menu" onClick={(e) => e.stopPropagation()}>
            {canToggleHome && <button onClick={() => toggleHidden(category)}>{category.hiddenOnHome ? '홈에 추가하기' : '홈에서 숨기기'}</button>}
            <button onClick={() => toggleQuickSlot(category)}>{inQuickSlot(category) ? '퀵 슬롯에서 숨기기' : '퀵 슬롯에 추가하기'}</button>
          </div>}
          <div><h3>{category.name}{category.hiddenOnHome && <em className="hidden-note">홈에서 숨김</em>}</h3><p>{hasBudget
            ? <><strong>{money(used)}</strong> <span>/ {money(category.monthlyBudget)}원</span></>
            : <><strong>{money(used)}원</strong> <span>사용</span></>}</p></div>
          {hasBudget
            ? <>
                <div className="progress-meta"><span>{progress}% 사용</span><span>{money(category.monthlyBudget - used)}원 남음</span></div>
                <div className="category-progress"><i style={{ width: `${Math.min(progress, 100)}%`, background: barColor }} /></div>
              </>
            : <p className="no-budget-note">예산 미설정</p>}
        </article>
      })}
    </section>

    <div className="section-heading transaction-heading"><div><p className="eyebrow">TODAY</p><h2>오늘 내역</h2></div><button className="text-button" onClick={goTransactions}>거래 내역 <ChevronRight size={16}/></button></div>
    <section className="transaction-card">
      {todayTx && todayTx.length === 0
        ? <div className="empty-state">
            <span className="empty-planet" aria-hidden="true" />
            <strong>아직 내역이 없어요</strong>
            <p>오늘의 첫 기록을 남겨보세요.</p>
            <button className="outline-button" onClick={openExpense}><Plus size={16}/> 추가</button>
          </div>
        : (todayTx ?? []).map(t => {
            const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
            const income = t.type === 'income'
            return <div className="transaction-row" key={t.id}>
              <span className="transaction-time">{format(t.createdAt, 'HH:mm')}</span>
              <CategoryPlanet color={cat?.color ?? '#9aa3b4'}/>
              {/* 메모가 없으면 제목이 곧 카테고리라 아래 줄을 또 쓰지 않는다 */}
              <button className="transaction-name" onClick={() => openEdit(t)}><strong>{t.memo || cat?.name || (income ? '수입' : '지출')}</strong>{t.memo && <span>{income ? '수입' : cat?.name ?? '미분류'}</span>}</button>
              <strong className={`transaction-amount ${income ? 'income-text' : ''}`}>{income ? '+' : '-'}{money(t.amount)}원</strong>
            </div>
          })}
    </section>
  </div>
}

function CalendarView({ openEdit, openExpenseForDate }: { openEdit: (t: Transaction) => void; openExpenseForDate: (date: string) => void }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState<string | null>(today)
  const [detailOpen, setDetailOpen] = useState(false)
  const categories = useCategories() ?? []
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const monthTx = useLiveQuery(() => db.transactions.where('date').startsWith(month).toArray(), [month])

  const byDay = useMemo(() => {
    // 발생한 지출/수입은 하루 총액으로 합치고, 예정 거래는 개별 항목으로 보여준다.
    const map = new Map<string, { expense: number; income: number; planned: { sign: '+' | '-'; amount: number }[] }>()
    const sorted = [...(monthTx ?? [])].sort((a, b) => a.createdAt - b.createdAt)
    for (const t of sorted) {
      const info = map.get(t.date) ?? { expense: 0, income: 0, planned: [] }
      if (t.isPlanned) info.planned.push({ sign: t.type === 'income' ? '+' : '-', amount: t.amount })
      else if (t.type === 'expense') info.expense += t.amount
      else info.income += t.amount
      map.set(t.date, info)
    }
    return map
  }, [monthTx])

  const monthDate = parseISO(`${month}-01`)
  const daysInMonth = getDaysInMonth(monthDate)
  const firstWeekday = monthDate.getDay()
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7
  const moveMonth = (delta: number) => {
    setMonth(format(addMonths(monthDate, delta), 'yyyy-MM'))
    setSelected(null)
    setDetailOpen(false)
  }
  const goToday = () => {
    setMonth(today.slice(0, 7))
    setSelected(today)
    setDetailOpen(true)
  }

  useEffect(() => {
    if (!detailOpen) return
    const closeDetail = (e: KeyboardEvent) => e.key === 'Escape' && setDetailOpen(false)
    window.addEventListener('keydown', closeDetail)
    return () => window.removeEventListener('keydown', closeDetail)
  }, [detailOpen])

  const dayTx = selected
    ? (monthTx ?? []).filter(t => t.date === selected).sort((a, b) => a.createdAt - b.createdAt)
    : []
  const dayNet = dayTx.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0)

  return <div className="view">
    <div className="page-heading">
      <div><p className="eyebrow">MONTHLY ORBIT</p><h1>달력</h1></div>
      <div className="month-switch">
        <button onClick={() => moveMonth(-1)} aria-label="이전 달"><ChevronLeft size={18}/></button>
        <div className="month-switch-center">
          <strong aria-live="polite">{format(monthDate, 'yyyy년 M월')}</strong>
          <button className="today-button" onClick={goToday}>오늘</button>
        </div>
        <button onClick={() => moveMonth(1)} aria-label="다음 달"><ChevronRight size={18}/></button>
      </div>
    </div>
    <section className="calendar-card">
      <div className="weekdays">{['일','월','화','수','목','금','토'].map(d=><span key={d}>{d}</span>)}</div>
      <div className="calendar-grid">
        {Array.from({ length: cellCount }, (_, i) => {
          const day = i - firstWeekday + 1
          if (day < 1 || day > daysInMonth) return <div className="calendar-day muted" key={i}/>
          const date = `${month}-${String(day).padStart(2, '0')}`
          const info = byDay.get(date)
          const lines: { dot: 'spent' | 'income' | 'planned'; text: string }[] = info
            ? [
                ...(info.expense > 0 ? [{ dot: 'spent' as const, text: `-${money(info.expense)}` }] : []),
                ...(info.income > 0 ? [{ dot: 'income' as const, text: `+${money(info.income)}` }] : []),
                ...info.planned.map(p => ({ dot: 'planned' as const, text: `${p.sign}${money(p.amount)}` })),
              ]
            : []
          const shown = lines.slice(0, 2)
          const moreCount = lines.length - shown.length
          const dayLabel = [
            format(parseISO(date), 'M월 d일 EEEE', { locale: ko }),
            ...(info?.expense ? [`지출 ${money(info.expense)}원`] : []),
            ...(info?.income ? [`수입 ${money(info.income)}원`] : []),
            ...(info?.planned.length ? [`예정 거래 ${info.planned.length}건`] : []),
          ].join(', ')
          return <button
            className={`calendar-day ${selected === date ? 'selected' : ''} ${date === today ? 'today' : ''}`}
            key={i}
            aria-label={dayLabel}
            aria-pressed={selected === date}
            onClick={() => { setSelected(date); setDetailOpen(true) }}
          >
            <span className="day-num">{day}</span>
            {shown.map((line, idx) => <span className="calendar-amount" key={idx}>
              <i className={line.dot}/>
              <strong>{line.text}</strong>
            </span>)}
            {moreCount > 0 && <span className="calendar-more">+{moreCount}개 더보기</span>}
          </button>
        })}
      </div>
      <div className="calendar-legend"><span><i className="spent"/> 지출</span><span><i className="income"/> 수입</span><span><i className="planned"/> 예정 거래</span></div>
    </section>
    {selected && <div className={`calendar-detail-layer ${detailOpen ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setDetailOpen(false)}>
      <section className="selected-day" role="region" aria-labelledby="selected-day-title">
        <div className="sheet-handle calendar-sheet-handle" aria-hidden="true" />
        <div className="selected-head">
          <div><p className="eyebrow">SELECTED DAY</p><h2 id="selected-day-title">{format(parseISO(selected), 'M월 d일, EEEE', { locale: ko })}</h2></div>
          <div className="selected-head-side">
            {dayTx.length > 0 && <strong className={dayNet > 0 ? 'income-text' : ''}>{dayNet > 0 ? '+' : dayNet < 0 ? '-' : ''}{money(Math.abs(dayNet))}원</strong>}
            <button className="icon-button calendar-detail-close" onClick={() => setDetailOpen(false)} aria-label="날짜 상세 닫기"><X size={19}/></button>
          </div>
        </div>
        <div className="selected-day-content">
          {dayTx.length === 0
            ? <p className="empty-note">이날의 내역이 없어요.</p>
            : dayTx.map(t => {
                const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
                const income = t.type === 'income'
                return <div className="transaction-row" key={t.id}>
                  <span className={`transaction-time ${t.isPlanned ? 'planned-label' : ''}`}>{t.isPlanned ? '예정' : format(t.createdAt, 'HH:mm')}</span>
                  <CategoryPlanet color={income ? '#83dad8' : cat?.color ?? '#9aa3b4'}/>
                  <button className="transaction-name" onClick={() => openEdit(t)}><strong>{t.memo || cat?.name || (income ? '수입' : '지출')}</strong>{t.memo && <span>{income ? '수입' : cat?.name ?? '미분류'}</span>}</button>
                  <strong className={`transaction-amount ${income ? 'income-text' : ''}`}>{income ? '+' : '-'}{money(t.amount)}원</strong>
                </div>
              })}
        </div>
        <button className="selected-day-add" onClick={() => openExpenseForDate(selected)}><Plus size={17}/> 이 날짜에 추가</button>
      </section>
    </div>}
  </div>
}

/** 조회 기간 버튼. 기본은 오늘까지 최근 1주일이고, '전체'는 위아래 경계를 두지 않는다. */
const RANGE_PRESETS = [
  { id: 'week', label: '1주일' },
  { id: 'month', label: '1개월' },
  { id: 'all', label: '전체' },
] as const
type RangeId = typeof RANGE_PRESETS[number]['id']

function presetRange(id: RangeId): { from: string; to: string } {
  if (id === 'all') return { from: '', to: '' }
  const start = id === 'week' ? addDays(new Date(), -6) : addMonths(new Date(), -1)
  return { from: format(start, 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') }
}

function TransactionsView({ openExpense, openEdit }: { openExpense: () => void; openEdit: (t: Transaction) => void }) {
  const categories = useCategories() ?? []
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const all = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [])
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all')
  // 카테고리 id 목록. 'none'은 미분류. 비어 있으면 카테고리로 거르지 않는다.
  const [catFilter, setCatFilter] = useState<string[]>([])
  // 예정 탭은 아직 오지 않은 거래를 모아 보는 자리라 조회 기간을 적용하지 않는다.
  const [tab, setTab] = useState<'all' | 'planned'>('all')
  const [range, setRange] = useState(() => presetRange('week'))
  const defaultRange = presetRange('week')
  const rangeChanged = range.from !== defaultRange.from || range.to !== defaultRange.to
  const activePreset = RANGE_PRESETS.find(p => {
    const r = presetRange(p.id)
    return r.from === range.from && r.to === range.to
  })?.id
  const activeCount = (typeFilter === 'all' ? 0 : 1) + (catFilter.length > 0 ? 1 : 0)
  const filtering = activeCount > 0 || query.trim().length > 0 || (tab === 'all' && rangeChanged)
  const reset = () => { setQuery(''); setTypeFilter('all'); setCatFilter([]); setRange(presetRange('week')) }
  const toggleCat = (id: string) =>
    setCatFilter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const plannedCount = (all ?? []).filter(t => t.isPlanned).length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (all ?? []).filter(t => {
      if (tab === 'planned') {
        if (!t.isPlanned) return false
      } else {
        if (range.from && t.date < range.from) return false
        if (range.to && t.date > range.to) return false
      }
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (catFilter.length > 0 && !catFilter.includes(t.categoryId ?? 'none')) return false
      if (!q) return true
      const name = t.categoryId ? catMap.get(t.categoryId)?.name ?? '' : '미분류'
      return t.memo.toLowerCase().includes(q) || name.toLowerCase().includes(q)
    })
  }, [all, query, typeFilter, catFilter, catMap, tab, range])

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of filtered) {
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date)!.push(t)
    }
    const list = [...map.entries()].map(([date, items]) => ({
      date,
      items: [...items].sort((a, b) => b.createdAt - a.createdAt),
      net: items.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0),
    }))
    // 지난 내역은 최신순이지만, 예정은 곧 다가올 날짜부터 보는 편이 쓸모 있다.
    return tab === 'planned' ? list.reverse() : list
  }, [filtered, tab])

  const remove = async (t: Transaction) => {
    const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
    const label = t.memo || cat?.name || (t.type === 'income' ? '수입' : '지출')
    if (!window.confirm(`'${label}' ${money(t.amount)}원 내역을 삭제할까요?`)) return
    await db.transactions.delete(t.id)
  }

  return <div className="view transactions-view">
    <div className="page-heading"><div><p className="eyebrow">HISTORY</p><h1>거래 내역</h1></div></div>
    <div className="type-toggle history-tabs" role="tablist">
      <button role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>전체</button>
      <button role="tab" aria-selected={tab === 'planned'} className={tab === 'planned' ? 'active' : ''} onClick={() => setTab('planned')}>예정{plannedCount > 0 && <span>{plannedCount}</span>}</button>
    </div>
    <div className="filterbar">
      <div>
        <Search size={18}/>
        <input placeholder="메모 또는 카테고리 검색" value={query} onChange={e => setQuery(e.target.value)}/>
        {query && <button className="clear-query" onClick={() => setQuery('')} aria-label="검색어 지우기"><X size={15}/></button>}
      </div>
      <button className={filterOpen || activeCount > 0 ? 'active' : ''} onClick={() => setFilterOpen(!filterOpen)}>
        <SlidersHorizontal size={17}/> 필터{activeCount > 0 ? ` · ${activeCount}` : ''}
        {activeCount > 0 && <i className="filter-dot" aria-hidden="true"/>}
      </button>
    </div>
    {tab === 'all' && <div className="range-bar">
      <div className="range-dates">
        <input type="date" value={range.from} max={range.to || undefined} onChange={e => setRange({ ...range, from: e.target.value })} aria-label="조회 시작일"/>
        <span aria-hidden="true">~</span>
        <input type="date" value={range.to} min={range.from || undefined} onChange={e => setRange({ ...range, to: e.target.value })} aria-label="조회 종료일"/>
      </div>
      <div className="range-presets">
        {RANGE_PRESETS.map(p =>
          <button key={p.id} className={activePreset === p.id ? 'active' : ''} onClick={() => setRange(presetRange(p.id))}>{p.label}</button>)}
      </div>
    </div>}
    {filterOpen && <section className="filter-panel">
      <div className="filter-group">
        <span className="field-label">종류</span>
        <div className="type-toggle">
          {([['all','전체'],['expense','지출'],['income','수입']] as const).map(([id, label]) =>
            <button key={id} className={typeFilter === id ? 'active' : ''} onClick={() => setTypeFilter(id)}>{label}</button>)}
        </div>
      </div>
      <div className="filter-group">
        <span className="field-label">카테고리</span>
        <div className="filter-pills">
          {categories.map(c =>
            <button key={c.id} className={catFilter.includes(c.id) ? 'selected' : ''} onClick={() => toggleCat(c.id)}>
              <CategoryPlanet color={c.color}/>{c.name}
            </button>)}
          <button className={catFilter.includes('none') ? 'selected' : ''} onClick={() => toggleCat('none')}>
            <CategoryPlanet color="#9aa3b4"/>미분류
          </button>
        </div>
      </div>
      {filtering && <button className="text-button filter-reset" onClick={reset}>필터 초기화</button>}
    </section>}
    <section className="history-card">
      {all && all.length === 0 && <div className="empty-state">
        <span className="empty-planet" aria-hidden="true" />
        <strong>아직 거래가 없어요</strong>
        <p>첫 지출이나 수입을 기록해보세요.</p>
        <button className="outline-button" onClick={openExpense}><Plus size={16}/> 거래 추가</button>
      </div>}
      {all && all.length > 0 && groups.length === 0 && (tab === 'planned' && !filtering
        ? <div className="empty-state">
            <span className="empty-planet" aria-hidden="true" />
            <strong>예정된 거래가 없어요</strong>
            <p>반복 지출이나 앞으로의 거래를 예정으로 남기면 여기에 모여요.</p>
            <button className="outline-button" onClick={openExpense}><Plus size={16}/> 거래 추가</button>
          </div>
        : <div className="empty-state">
            <span className="empty-planet" aria-hidden="true" />
            <strong>조건에 맞는 거래가 없어요</strong>
            <p>{tab === 'planned' ? '검색어나 필터를 바꿔보세요.' : '조회 기간이나 필터를 바꿔보세요.'}</p>
            <button className="outline-button" onClick={reset}>{tab === 'planned' ? '필터 초기화' : '기간·필터 초기화'}</button>
          </div>)}
      {groups.map(group => <div key={group.date}>
        <div className="date-divider">
          <span>{format(parseISO(group.date), 'M월 d일')}</span>
          <strong className={group.net > 0 ? 'income-text' : ''}>{group.net > 0 ? '+' : group.net < 0 ? '-' : ''}{money(Math.abs(group.net))}원</strong>
        </div>
        {group.items.map(t => {
          const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
          const income = t.type === 'income'
          return <div className="history-row" key={t.id}>
            <span className={`money-direction ${income ? 'income' : 'expense'}`}>{income ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</span>
            <button className="row-open" onClick={() => openEdit(t)}>
              <strong>{t.memo || cat?.name || (income ? '수입' : '지출')}{t.isPlanned && <em className="planned-chip">예정</em>}</strong>
              <span>{format(t.createdAt, 'HH:mm')} · {income ? '수입' : cat?.name ?? '미분류'}</span>
            </button>
            <strong className={income ? 'income-text' : ''}>{income ? '+' : '-'}{money(t.amount)}원</strong>
            <button className="row-delete" onClick={() => remove(t)} aria-label="삭제"><Trash2 size={16}/></button>
          </div>
        })}
      </div>)}
    </section>
  </div>
}

function SettingsView({ dark, onTheme, sub, setSub }: { dark: boolean; onTheme: () => void; sub: SettingsSub; setSub: (sub: SettingsSub) => void }) {
  const month = format(new Date(), 'yyyy-MM')
  const monthSettings = useLiveQuery(() => db.monthSettings.get(month), [month])
  const [reserveOpen, setReserveOpen] = useState(false)
  const reserve = monthSettings?.reserveAmount ?? 0
  if (sub === 'categories') return <CategorySettings back={() => setSub(null)} />
  if (sub === 'recurring') return <RecurringSettings back={() => setSub(null)} />
  const exportCsv = async () => {
    const [transactions, categories] = await Promise.all([db.transactions.toArray(), db.categories.toArray()])
    if (transactions.length === 0) { window.alert('내보낼 거래가 아직 없어요.'); return }
    downloadCsv(buildCsv(transactions, categories), `orbit-budget-${format(new Date(), 'yyyy-MM-dd')}.csv`)
  }
  const settings = [
    { icon: CircleDollarSign, title: '카테고리 관리', desc: '예산과 카테고리 색상 설정', onClick: () => setSub('categories') },
    { icon: Repeat2, title: '반복 거래', desc: '정기 수입과 예정 지출 관리', onClick: () => setSub('recurring') },
    {
      icon: WalletCards,
      title: '예비비 설정',
      desc: reserve > 0 ? `이번 달 예비비 ${money(reserve)}원` : '이번 달 예비비 없음',
      onClick: () => setReserveOpen(true),
    },
  ]
  return <div className="view"><div className="page-heading"><div><p className="eyebrow">PREFERENCES</p><h1>설정</h1><p>나의 예산 행성을 관리하세요.</p></div></div><section className="settings-card">{settings.map(row=>{const Icon=row.icon;return <button className="setting-row" key={row.title} onClick={row.onClick}><span><Icon size={20}/></span><div><strong>{row.title}</strong><small>{row.desc}</small></div><ChevronRight size={18}/></button>})}</section><h2 className="settings-subhead">앱 설정</h2><section className="settings-card"><button className="setting-row" onClick={onTheme}><span>{dark?<Moon size={20}/>:<Sun size={20}/>}</span><div><strong>화면 테마</strong><small>{dark?'다크 모드':'라이트 모드'}</small></div><i className={`toggle ${dark?'on':''}`}><b/></i></button><button className="setting-row" onClick={exportCsv}><span><Download size={20}/></span><div><strong>데이터 내보내기</strong><small>CSV 파일로 안전하게 보관</small></div><ChevronRight size={18}/></button></section><p className="version">ORBIT BUDGET · UI PROTOTYPE 0.4</p>{reserveOpen && <ReserveSheet month={month} current={reserve} close={() => setReserveOpen(false)} />}</div>
}

function App() {
  const today = useToday()
  const [active, setActive] = useState<Tab>('home')
  const [dark, setDark] = useState(false)
  // 빈 객체면 새 거래, transaction이 있으면 수정, preset이 있으면 퀵 슬롯에서 넘어온 프리필.
  const [sheet, setSheet] = useState<{ transaction?: Transaction; preset?: QuickPreset; initialDate?: string } | null>(null)
  const [settingsSub, setSettingsSub] = useState<SettingsSub>(null)
  const goSettings = (sub: SettingsSub) => { setSettingsSub(sub); setActive('settings') }
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  useEffect(() => { document.body.style.overflow = sheet ? 'hidden' : '' }, [sheet])
  const openExpense = () => setSheet({})
  const openExpenseForDate = (initialDate: string) => setSheet({ initialDate })
  const openEdit = (t: Transaction) => setSheet({ transaction: t })
  const openPreset = (preset: QuickPreset) => setSheet({ preset })
  // 날짜가 바뀌면 지난 예정 거래를 확정하고, 새 달의 반복 거래·계산식 예산을 맞춘다.
  useEffect(() => {
    materializeRecurring(today).then(() => syncRuleBudgets(today.slice(0, 7)))
  }, [today])
  useEffect(() => { requestPersistentStorage() }, [])
  const content = useMemo(() => ({home:<HomeView openExpense={openExpense} openEdit={openEdit} openPreset={openPreset} goTransactions={()=>setActive('transactions')} goCategories={()=>goSettings('categories')}/>,calendar:<CalendarView openEdit={openEdit} openExpenseForDate={openExpenseForDate}/>,transactions:<TransactionsView openExpense={openExpense} openEdit={openEdit}/>,settings:<SettingsView dark={dark} onTheme={()=>setDark(!dark)} sub={settingsSub} setSub={setSettingsSub}/>})[active], [active,dark,settingsSub,today])
  return <div className="app-shell"><Header dark={dark} onTheme={()=>setDark(!dark)}/><Sidebar active={active} setActive={(tab)=>{if(tab==='settings')setSettingsSub(null);setActive(tab)}}/><main>{content}</main>{(active==='home'||active==='transactions')&&<><button className="desktop-add" onClick={openExpense}><Plus size={20}/> 추가</button><button className="fab-add" onClick={openExpense} aria-label="거래 추가"><Plus size={26}/></button></>}<nav className="bottom-nav">{([{id:'home',label:'홈',icon:Home},{id:'calendar',label:'달력',icon:CalendarDays},{id:'transactions',label:'거래',icon:ListFilter},{id:'settings',label:'설정',icon:Settings}] as const).map(item=>{const Icon=item.icon;return <button key={item.id} className={active===item.id?'active':''} onClick={()=>{if(item.id==='settings')setSettingsSub(null);setActive(item.id)}}><Icon size={20}/><span>{item.label}</span></button>})}</nav>{sheet&&<ExpenseSheet transaction={sheet.transaction} preset={sheet.preset} initialDate={sheet.initialDate} close={()=>setSheet(null)}/>}</div>
}

export default App
