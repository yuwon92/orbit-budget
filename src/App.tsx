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
  WalletCards,
  X,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { db } from './lib/db'
import { money } from './lib/format'
import { useCategories } from './lib/hooks'
import { CategoryPlanet } from './components/CategoryPlanet'
import { CategorySettings } from './components/CategorySettings'

type Tab = 'home' | 'calendar' | 'transactions' | 'settings'

// 아직 DB에 연결되지 않은 목업 데이터. 3단계(지출 입력)에서 실제 거래로 대체된다.
const transactions = [
  { time: '12:30', name: '점심', category: '식비', amount: 12000, color: '#8ebeff' },
  { time: '16:20', name: '아이스 라테', category: '카페', amount: 4500, color: '#b7a7f8' },
]

function useMonthSpent(month: string) {
  return useLiveQuery(async () => {
    const list = await db.transactions.where('date').startsWith(month).toArray()
    const map: Record<string, number> = {}
    for (const t of list) {
      if (t.type === 'expense' && t.categoryId) map[t.categoryId] = (map[t.categoryId] ?? 0) + t.amount
    }
    return map
  }, [month])
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
  return <aside className="sidebar"><nav>{items.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => setActive(item.id)} className={active === item.id ? 'active' : ''}><Icon size={19}/><span>{item.label}</span></button> })}</nav><div className="month-chip"><Planet small/><div><span>9월의 행성</span><strong>34% 사용 중</strong></div></div></aside>
}

function HomeView({ openExpense }: { openExpense: () => void }) {
  const categories = useCategories() ?? []
  const month = format(new Date(), 'yyyy-MM')
  const spent = useMonthSpent(month) ?? {}
  const budgeted = categories.filter(c => c.monthlyBudget > 0)
  return <div className="view home-view">
    <section className="hero-card">
      <div className="hero-copy">
        <p className="eyebrow">9월 13일, 일요일</p>
        <p className="hero-label">오늘 사용할 수 있는 금액</p>
        <h1><span>32,400</span><small>원</small></h1>
        <div className="daily-budget"><span>오늘 예산</span><strong>41,200원</strong><i>40%</i></div>
        <div className="hero-progress"><span style={{ width: '40%' }} /></div>
        <p className="hero-note">오늘 16,500원을 사용했어요</p>
      </div>
      <Planet />
    </section>

    <div className="section-heading"><div><p className="eyebrow">MONTHLY PLAN</p><h2>이번 달 예산</h2></div><button className="text-button">전체 보기 <ChevronRight size={16}/></button></div>
    <section className="category-grid">
      {budgeted.map((category) => {
        const used = spent[category.id] ?? 0
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

    <div className="section-heading transaction-heading"><div><p className="eyebrow">TODAY</p><h2>오늘 지출</h2></div><button className="text-button">거래 내역 <ChevronRight size={16}/></button></div>
    <section className="transaction-card">
      {transactions.map(item => <div className="transaction-row" key={item.time}><span className="transaction-time">{item.time}</span><CategoryPlanet color={item.color}/><div className="transaction-name"><strong>{item.name}</strong><span>{item.category}</span></div><strong className="transaction-amount">-{money(item.amount)}원</strong></div>)}
    </section>
    <button className="mobile-add" onClick={openExpense}><Plus size={19}/> 지출 추가</button>
  </div>
}

function CalendarView() {
  const days = Array.from({ length: 35 }, (_, i) => i - 1)
  const expenses: Record<number, string> = { 1:'50,000', 3:'8,500', 5:'12,000', 8:'9,900', 10:'500,000', 12:'7,400', 13:'16,500', 17:'2,500', 21:'15,090', 25:'4,800', 30:'31,000' }
  return <div className="view"><div className="page-heading"><div><p className="eyebrow">MONTHLY ORBIT</p><h1>달력</h1><p>날짜별 소비 흐름과 예정 거래를 확인하세요.</p></div><div className="month-switch"><button><ChevronLeft size={18}/></button><strong>2026년 9월</strong><button><ChevronRight size={18}/></button></div></div><section className="calendar-card"><div className="weekdays">{['일','월','화','수','목','금','토'].map(d=><span key={d}>{d}</span>)}</div><div className="calendar-grid">{days.map((day,i)=> { const indicator = day===10||day===25?'income':day===8||day===17||day===21||day===30?'planned':''; return day < 1 || day > 30 ? <div className="calendar-day muted" key={i}/> : <button className={`calendar-day ${day===13?'selected':''}`} key={i}><span>{day}</span>{expenses[day]&&<span className="calendar-amount">{indicator&&<i className={indicator}/>}<strong>{expenses[day]}</strong></span>}</button> })}</div><div className="calendar-legend"><span><i className="planned"/> 예정 거래</span><span><i className="income"/> 수입</span></div></section><section className="selected-day"><div><p className="eyebrow">SELECTED DAY</p><h2>9월 13일</h2></div><strong>-16,500원</strong></section></div>
}

function TransactionsView() {
  return <div className="view"><div className="page-heading"><div><p className="eyebrow">HISTORY</p><h1>거래 내역</h1><p>아직 검색과 필터는 UI만 준비되어 있어요.</p></div><button className="outline-button"><Download size={17}/> CSV 내보내기</button></div><div className="filterbar"><div><Search size={18}/><input placeholder="메모 또는 카테고리 검색"/></div><button><SlidersHorizontal size={17}/> 필터</button></div><section className="history-card"><div className="date-divider"><span>9월 13일</span><strong>-16,500원</strong></div>{transactions.map(item=><div className="history-row" key={item.time}><span className="money-direction expense"><ArrowUpRight size={18}/></span><div><strong>{item.name}</strong><span>{item.time} · {item.category}</span></div><strong>-{money(item.amount)}원</strong></div>)}<div className="date-divider"><span>9월 10일</span><strong className="income-text">+321,950원</strong></div><div className="history-row"><span className="money-direction income"><ArrowDownLeft size={18}/></span><div><strong>알바비</strong><span>09:00 · 수입</span></div><strong className="income-text">+821,950원</strong></div><div className="history-row"><span className="money-direction expense"><ArrowUpRight size={18}/></span><div><strong>대여금 상환</strong><span>18:30 · 기타</span></div><strong>-500,000원</strong></div></section></div>
}

function SettingsView({ dark, onTheme }: { dark: boolean; onTheme: () => void }) {
  const [sub, setSub] = useState<'categories' | null>(null)
  if (sub === 'categories') return <CategorySettings back={() => setSub(null)} />
  const settings = [
    { icon: CircleDollarSign, title: '카테고리 관리', desc: '예산과 카테고리 색상 설정', onClick: () => setSub('categories') },
    { icon: Repeat2, title: '반복 거래', desc: '정기 수입과 예정 지출 관리', onClick: undefined },
    { icon: WalletCards, title: '예비비 설정', desc: '이번 달 예비비 50,000원', onClick: undefined },
  ]
  return <div className="view"><div className="page-heading"><div><p className="eyebrow">PREFERENCES</p><h1>설정</h1><p>나의 예산 행성을 관리하세요.</p></div></div><section className="settings-card">{settings.map(row=>{const Icon=row.icon;return <button className="setting-row" key={row.title} onClick={row.onClick}><span><Icon size={20}/></span><div><strong>{row.title}</strong><small>{row.desc}</small></div><ChevronRight size={18}/></button>})}</section><h2 className="settings-subhead">앱 설정</h2><section className="settings-card"><button className="setting-row" onClick={onTheme}><span>{dark?<Moon size={20}/>:<Sun size={20}/>}</span><div><strong>화면 테마</strong><small>{dark?'다크 모드':'라이트 모드'}</small></div><i className={`toggle ${dark?'on':''}`}><b/></i></button><button className="setting-row"><span><Download size={20}/></span><div><strong>데이터 내보내기</strong><small>CSV 파일로 안전하게 보관</small></div><ChevronRight size={18}/></button></section><p className="version">ORBIT BUDGET · UI PROTOTYPE 0.2</p></div>
}

function ExpenseSheet({ close }: { close: () => void }) {
  const categories = useCategories() ?? []
  const [amount, setAmount] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ?? categories[0]?.id ?? null
  const formatted = amount ? money(Number(amount)) : '0'
  return <div className="sheet-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><section className="expense-sheet"><div className="sheet-handle"/><header><div><p className="eyebrow">NEW TRANSACTION</p><h2>지출 추가</h2></div><button className="icon-button" onClick={close}><X size={20}/></button></header><label className="amount-input"><span>금액</span><div><input autoFocus inputMode="numeric" value={formatted} onChange={e=>setAmount(e.target.value.replace(/\D/g,''))}/><strong>원</strong></div></label><div className="field-label">카테고리</div><div className="category-pills">{categories.map(c=><button key={c.id} className={selected===c.id?'selected':''} onClick={()=>setSelectedId(c.id)}><CategoryPlanet color={c.color}/>{c.name}</button>)}</div><div className="simple-fields"><button><CalendarDays size={18}/><span>2026년 9월 13일</span><ChevronRight size={17}/></button><label><input placeholder="메모 추가 (선택)"/></label></div><button className="save-button" onClick={close} disabled={!amount}>{amount?`${formatted}원 저장`:'금액을 입력하세요'}</button></section></div>
}

function App() {
  const [active, setActive] = useState<Tab>('home')
  const [dark, setDark] = useState(false)
  const [sheet, setSheet] = useState(false)
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  useEffect(() => { document.body.style.overflow = sheet ? 'hidden' : '' }, [sheet])
  const content = useMemo(() => ({home:<HomeView openExpense={()=>setSheet(true)}/>,calendar:<CalendarView/>,transactions:<TransactionsView/>,settings:<SettingsView dark={dark} onTheme={()=>setDark(!dark)}/>})[active], [active,dark])
  return <div className="app-shell"><Header dark={dark} onTheme={()=>setDark(!dark)}/><Sidebar active={active} setActive={setActive}/><main>{content}</main>{active==='home'&&<button className="desktop-add" onClick={()=>setSheet(true)}><Plus size={20}/> 지출 추가</button>}<nav className="bottom-nav">{([{id:'home',label:'홈',icon:Home},{id:'calendar',label:'달력',icon:CalendarDays},{id:'transactions',label:'거래',icon:ListFilter},{id:'settings',label:'설정',icon:Settings}] as const).map(item=>{const Icon=item.icon;return <button key={item.id} className={active===item.id?'active':''} onClick={()=>setActive(item.id)}><Icon size={20}/><span>{item.label}</span></button>})}</nav>{sheet&&<ExpenseSheet close={()=>setSheet(false)}/>}</div>
}

export default App
