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
import { addMonths, format, getDaysInMonth, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { calcTodayBudget, remainingToday, spentByCategory, spentOnDate } from './lib/budget'
import { db } from './lib/db'
import { money } from './lib/format'
import { useCategories } from './lib/hooks'
import type { Transaction } from './lib/types'
import { materializeRecurring } from './lib/recurring'
import { CategoryPlanet } from './components/CategoryPlanet'
import { CategorySettings } from './components/CategorySettings'
import { ExpenseSheet } from './components/ExpenseSheet'
import { RecurringSettings } from './components/RecurringSettings'

type Tab = 'home' | 'calendar' | 'transactions' | 'settings'

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
        <button className="avatar" aria-label="프로필">SY</button>
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

function HomeView({ openExpense, goTransactions }: { openExpense: () => void; goTransactions: () => void }) {
  const categories = useCategories() ?? []
  const today = format(new Date(), 'yyyy-MM-dd')
  const month = today.slice(0, 7)
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const monthTx = useLiveQuery(() => db.transactions.where('date').startsWith(month).toArray(), [month])
  const settings = useLiveQuery(() => db.monthSettings.get(month), [month])
  const loaded = monthTx !== undefined
  const txs = monthTx ?? []

  const todayBudget = calcTodayBudget(txs, today, settings?.reserveAmount ?? 0)
  const todaySpent = spentOnDate(txs, today)
  const remaining = remainingToday(todayBudget, todaySpent)
  const over = remaining < 0
  const usedPercent = todayBudget > 0 ? Math.round(todaySpent / todayBudget * 100) : todaySpent > 0 ? 100 : 0
  const heroBarColor = usedPercent >= 100 ? 'var(--danger)' : usedPercent >= 80 ? '#e7b96a' : undefined
  const spent = spentByCategory(txs, month)
  const todayTx = loaded
    ? txs.filter(t => t.date === today).sort((a, b) => a.createdAt - b.createdAt)
    : undefined
  const budgeted = categories.filter(c => c.monthlyBudget > 0)
  return <div className="view home-view">
    <section className="hero-card">
      <div className="hero-copy">
        <p className="eyebrow">{format(new Date(), 'M월 d일, EEEE', { locale: ko })}</p>
        <p className="hero-label">오늘 사용할 수 있는 금액</p>
        <h1 className={over ? 'negative' : ''}><span>{loaded ? money(remaining) : '—'}</span><small>원</small></h1>
        <div className="daily-budget"><span>오늘 예산</span><strong>{loaded ? money(todayBudget) : '—'}원</strong><i>{usedPercent}%</i></div>
        <div className="hero-progress"><span style={{ width: `${Math.min(usedPercent, 100)}%`, ...(heroBarColor ? { background: heroBarColor } : {}) }} /></div>
        <p className="hero-note">오늘 {money(todaySpent)}원을 사용했어요</p>
      </div>
      <Planet />
    </section>

    <div className="section-heading"><div><p className="eyebrow">MONTHLY PLAN</p><h2>이번 달 예산</h2></div><button className="text-button">전체 보기 <ChevronRight size={16}/></button></div>
    <section className="category-grid">
      {budgeted.map((category) => {
        const used = spent.get(category.id) ?? 0
        const progress = Math.round(used / category.monthlyBudget * 100)
        const barColor = progress >= 100 ? '#ef7777' : progress >= 80 ? '#e7b96a' : category.color
        return <article className="category-card" key={category.id}>
          <div className="category-top"><CategoryPlanet color={category.color}/><button aria-label="더 보기"><MoreHorizontal size={18}/></button></div>
          <div><h3>{category.name}</h3><p><strong>{money(used)}</strong> <span>/ {money(category.monthlyBudget)}원</span></p></div>
          <div className="progress-meta"><span>{progress}% 사용</span><span>{money(category.monthlyBudget - used)}원 남음</span></div>
          <div className="category-progress"><i style={{ width: `${Math.min(progress, 100)}%`, background: barColor }} /></div>
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
              <CategoryPlanet color={cat?.color ?? '#a8aebb'}/>
              <div className="transaction-name"><strong>{t.memo || cat?.name || (income ? '수입' : '지출')}</strong><span>{income ? '수입' : cat?.name ?? '미분류'}</span></div>
              <strong className={`transaction-amount ${income ? 'income-text' : ''}`}>{income ? '+' : '-'}{money(t.amount)}원</strong>
            </div>
          })}
    </section>
    <button className="mobile-add" onClick={openExpense}><Plus size={19}/> 추가</button>
  </div>
}

function CalendarView() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState<string | null>(today)
  const categories = useCategories() ?? []
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const monthTx = useLiveQuery(() => db.transactions.where('date').startsWith(month).toArray(), [month])

  const byDay = useMemo(() => {
    // 실제 지출은 하루 총액으로 합치고, 예정 지출과 수입은 개별 항목으로 보여준다.
    const map = new Map<string, { actualExpense: number; items: { dot: 'planned' | 'income'; amount: number }[] }>()
    const sorted = [...(monthTx ?? [])].sort((a, b) => a.createdAt - b.createdAt)
    for (const t of sorted) {
      const info = map.get(t.date) ?? { actualExpense: 0, items: [] }
      if (t.type === 'expense' && !t.isPlanned) info.actualExpense += t.amount
      else if (t.type === 'expense') info.items.push({ dot: 'planned', amount: t.amount })
      else info.items.push({ dot: 'income', amount: t.amount })
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
  }

  const dayTx = selected
    ? (monthTx ?? []).filter(t => t.date === selected).sort((a, b) => a.createdAt - b.createdAt)
    : []
  const dayNet = dayTx.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0)

  return <div className="view">
    <div className="page-heading">
      <div><p className="eyebrow">MONTHLY ORBIT</p><h1>달력</h1><p>날짜별 소비 흐름과 예정 거래를 확인하세요.</p></div>
      <div className="month-switch">
        <button onClick={() => moveMonth(-1)} aria-label="이전 달"><ChevronLeft size={18}/></button>
        <strong>{format(monthDate, 'yyyy년 M월')}</strong>
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
          const lines: { dot?: 'planned' | 'income'; amount: number }[] = info
            ? [...(info.actualExpense > 0 ? [{ amount: info.actualExpense }] : []), ...info.items]
            : []
          const shown = lines.slice(0, 2)
          const moreCount = lines.length - shown.length
          return <button
            className={`calendar-day ${selected === date ? 'selected' : ''} ${date === today ? 'today' : ''}`}
            key={i}
            onClick={() => setSelected(date)}
          >
            <span className="day-num">{day}</span>
            {shown.map((line, idx) => <span className="calendar-amount" key={idx}>
              {line.dot && <i className={line.dot}/>}
              <strong>{money(line.amount)}</strong>
            </span>)}
            {moreCount > 0 && <span className="calendar-more">+{moreCount}개 더보기</span>}
          </button>
        })}
      </div>
      <div className="calendar-legend"><span><i className="planned"/> 예정 거래</span><span><i className="income"/> 수입</span></div>
    </section>
    {selected && <section className="selected-day">
      <div className="selected-head">
        <div><p className="eyebrow">SELECTED DAY</p><h2>{format(parseISO(selected), 'M월 d일, EEEE', { locale: ko })}</h2></div>
        {dayTx.length > 0 && <strong className={dayNet > 0 ? 'income-text' : ''}>{dayNet > 0 ? '+' : dayNet < 0 ? '-' : ''}{money(Math.abs(dayNet))}원</strong>}
      </div>
      {dayTx.length === 0
        ? <p className="empty-note">이날의 내역이 없어요.</p>
        : dayTx.map(t => {
            const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
            const income = t.type === 'income'
            return <div className="transaction-row" key={t.id}>
              <span className="transaction-time">{format(t.createdAt, 'HH:mm')}</span>
              <CategoryPlanet color={income ? '#83dad8' : cat?.color ?? '#a8aebb'}/>
              <div className="transaction-name"><strong>{t.memo || cat?.name || (income ? '수입' : '지출')}{t.isPlanned && <em className="planned-chip">예정</em>}</strong><span>{income ? '수입' : cat?.name ?? '미분류'}</span></div>
              <strong className={`transaction-amount ${income ? 'income-text' : ''}`}>{income ? '+' : '-'}{money(t.amount)}원</strong>
            </div>
          })}
    </section>}
  </div>
}

function TransactionsView({ openExpense }: { openExpense: () => void }) {
  const categories = useCategories() ?? []
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const all = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [])
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of all ?? []) {
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date)!.push(t)
    }
    return [...map.entries()].map(([date, items]) => ({
      date,
      items: [...items].sort((a, b) => b.createdAt - a.createdAt),
      net: items.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0),
    }))
  }, [all])

  const remove = async (t: Transaction) => {
    const cat = t.categoryId ? catMap.get(t.categoryId) : undefined
    const label = t.memo || cat?.name || (t.type === 'income' ? '수입' : '지출')
    if (!window.confirm(`'${label}' ${money(t.amount)}원 내역을 삭제할까요?`)) return
    await db.transactions.delete(t.id)
  }

  return <div className="view">
    <div className="page-heading"><div><p className="eyebrow">HISTORY</p><h1>거래 내역</h1><p>모든 수입과 지출을 날짜별로 확인하세요.</p></div></div>
    <div className="filterbar"><div><Search size={18}/><input placeholder="메모 또는 카테고리 검색"/></div><button><SlidersHorizontal size={17}/> 필터</button></div>
    <section className="history-card">
      {all && all.length === 0 && <div className="empty-state">
        <span className="empty-planet" aria-hidden="true" />
        <strong>아직 거래가 없어요</strong>
        <p>첫 지출이나 수입을 기록해보세요.</p>
        <button className="outline-button" onClick={openExpense}><Plus size={16}/> 거래 추가</button>
      </div>}
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
            <div>
              <strong>{t.memo || cat?.name || (income ? '수입' : '지출')}{t.isPlanned && <em className="planned-chip">예정</em>}</strong>
              <span>{format(t.createdAt, 'HH:mm')} · {income ? '수입' : cat?.name ?? '미분류'}</span>
            </div>
            <strong className={income ? 'income-text' : ''}>{income ? '+' : '-'}{money(t.amount)}원</strong>
            <button className="row-delete" onClick={() => remove(t)} aria-label="삭제"><Trash2 size={16}/></button>
          </div>
        })}
      </div>)}
    </section>
    <button className="mobile-add" onClick={openExpense}><Plus size={19}/> 추가</button>
  </div>
}

function SettingsView({ dark, onTheme }: { dark: boolean; onTheme: () => void }) {
  const [sub, setSub] = useState<'categories' | 'recurring' | null>(null)
  if (sub === 'categories') return <CategorySettings back={() => setSub(null)} />
  if (sub === 'recurring') return <RecurringSettings back={() => setSub(null)} />
  const settings = [
    { icon: CircleDollarSign, title: '카테고리 관리', desc: '예산과 카테고리 색상 설정', onClick: () => setSub('categories') },
    { icon: Repeat2, title: '반복 거래', desc: '정기 수입과 예정 지출 관리', onClick: () => setSub('recurring') },
    { icon: WalletCards, title: '예비비 설정', desc: '이번 달 예비비 50,000원', onClick: undefined },
  ]
  return <div className="view"><div className="page-heading"><div><p className="eyebrow">PREFERENCES</p><h1>설정</h1><p>나의 예산 행성을 관리하세요.</p></div></div><section className="settings-card">{settings.map(row=>{const Icon=row.icon;return <button className="setting-row" key={row.title} onClick={row.onClick}><span><Icon size={20}/></span><div><strong>{row.title}</strong><small>{row.desc}</small></div><ChevronRight size={18}/></button>})}</section><h2 className="settings-subhead">앱 설정</h2><section className="settings-card"><button className="setting-row" onClick={onTheme}><span>{dark?<Moon size={20}/>:<Sun size={20}/>}</span><div><strong>화면 테마</strong><small>{dark?'다크 모드':'라이트 모드'}</small></div><i className={`toggle ${dark?'on':''}`}><b/></i></button><button className="setting-row"><span><Download size={20}/></span><div><strong>데이터 내보내기</strong><small>CSV 파일로 안전하게 보관</small></div><ChevronRight size={18}/></button></section><p className="version">ORBIT BUDGET · UI PROTOTYPE 0.3</p></div>
}

function App() {
  const [active, setActive] = useState<Tab>('home')
  const [dark, setDark] = useState(false)
  const [sheet, setSheet] = useState(false)
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  useEffect(() => { document.body.style.overflow = sheet ? 'hidden' : '' }, [sheet])
  useEffect(() => { materializeRecurring(format(new Date(), 'yyyy-MM-dd')) }, [])
  const content = useMemo(() => ({home:<HomeView openExpense={()=>setSheet(true)} goTransactions={()=>setActive('transactions')}/>,calendar:<CalendarView/>,transactions:<TransactionsView openExpense={()=>setSheet(true)}/>,settings:<SettingsView dark={dark} onTheme={()=>setDark(!dark)}/>})[active], [active,dark])
  return <div className="app-shell"><Header dark={dark} onTheme={()=>setDark(!dark)}/><Sidebar active={active} setActive={setActive}/><main>{content}</main>{(active==='home'||active==='transactions')&&<button className="desktop-add" onClick={()=>setSheet(true)}><Plus size={20}/> 추가</button>}<nav className="bottom-nav">{([{id:'home',label:'홈',icon:Home},{id:'calendar',label:'달력',icon:CalendarDays},{id:'transactions',label:'거래',icon:ListFilter},{id:'settings',label:'설정',icon:Settings}] as const).map(item=>{const Icon=item.icon;return <button key={item.id} className={active===item.id?'active':''} onClick={()=>setActive(item.id)}><Icon size={20}/><span>{item.label}</span></button>})}</nav>{sheet&&<ExpenseSheet close={()=>setSheet(false)}/>}</div>
}

export default App
