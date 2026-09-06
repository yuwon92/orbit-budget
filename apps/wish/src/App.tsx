import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Edit3,
  GalleryHorizontalEnd,
  Moon,
  Orbit,
  Plus,
  Settings,
  Sun,
  WalletCards,
  X,
} from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import { DepositSheet } from './components/DepositSheet'
import { PlanetVisual } from './components/PlanetVisual'

type Screen = 'wishes' | 'galaxy' | 'observer' | 'settings'
type DemoStatus = 'active' | 'ready' | 'waiting'

interface DemoWish {
  id: string
  name: string
  targetAmount: number
  savedAmount: number
  targetDate: string | null
  color: string
  status: DemoStatus
}

const COLORS = ['#7faef5', '#ada2ff', '#76d7d7', '#e4b7e9', '#e7c46a', '#8fbc91']

function dateAfter(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const INITIAL_WISHES: DemoWish[] = [
  { id: 'headphones', name: '오래 쓸 헤드폰', targetAmount: 320_000, savedAmount: 184_000, targetDate: dateAfter(28), color: COLORS[0], status: 'active' },
  { id: 'desk-lamp', name: '작업실 조명', targetAmount: 86_000, savedAmount: 86_000, targetDate: dateAfter(14), color: COLORS[2], status: 'ready' },
]

const COMPLETED = [
  { id: 'camera', name: '필름 카메라', amount: 210_000, days: 34, kept: 28, date: '2026-08-12', color: COLORS[3] },
  { id: 'chair', name: '독서 의자', amount: 168_000, days: 21, kept: 17, date: '2026-06-03', color: COLORS[4] },
  { id: 'ticket', name: '공연 티켓', amount: 132_000, days: 18, kept: 16, date: '2026-04-19', color: COLORS[0] },
]

const NAV_ITEMS: { id: Screen; label: string; icon: typeof Orbit }[] = [
  { id: 'wishes', label: '위시', icon: Orbit },
  { id: 'galaxy', label: '성계', icon: GalleryHorizontalEnd },
  { id: 'observer', label: '관측자', icon: CircleUserRound },
  { id: 'settings', label: '설정', icon: Settings },
]

const formatDate = (date: string) => date.replaceAll('-', '.')

function remainingDays(targetDate: string | null) {
  if (!targetDate) return null
  const end = new Date(`${targetDate}T00:00:00`).getTime()
  const start = new Date(new Date().toLocaleDateString('sv-SE') + 'T00:00:00').getTime()
  return Math.max(1, Math.ceil((end - start) / 86_400_000) + 1)
}

function wishProgress(wish: DemoWish) {
  return Math.min(100, Math.round((wish.savedAmount / wish.targetAmount) * 100))
}

function shareFor(wish: DemoWish) {
  const days = remainingDays(wish.targetDate)
  if (!days || wish.status !== 'active') return 0
  return Math.floor(Math.max(0, wish.targetAmount - wish.savedAmount) / days)
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('wishes')
  const [wishes, setWishes] = useState(INITIAL_WISHES)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [depositing, setDepositing] = useState<DemoWish | null>(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('wish-theme')
    return saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('wish-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const activeWishes = wishes.filter((wish) => wish.status === 'active' || wish.status === 'ready' || wish.status === 'waiting')
  const selected = activeWishes[Math.min(selectedIndex, Math.max(activeWishes.length - 1, 0))]

  function moveWish(direction: -1 | 1) {
    if (!activeWishes.length) return
    setSelectedIndex((current) => (current + direction + activeWishes.length) % activeWishes.length)
  }

  function deposit(amount: number) {
    if (!depositing) return
    setWishes((current) => current.map((wish) => {
      if (wish.id !== depositing.id) return wish
      const savedAmount = Math.min(wish.targetAmount, wish.savedAmount + amount)
      return { ...wish, savedAmount, status: savedAmount >= wish.targetAmount ? 'ready' : wish.status }
    }))
    setDepositing(null)
    setToast('오늘 몫 완료')
  }

  function skipToday() {
    setDepositing(null)
    setToast('쉬어가기 기록')
  }

  function openAddSheet() {
    if (activeWishes.length >= 3) {
      setToast('위시 슬롯 가득 참')
      return
    }
    setAdding(true)
  }

  return (
    <div className={`wish-app screen-${screen}`}>
      <header className="app-header">
        <button className="wordmark" onClick={() => setScreen('wishes')} aria-label="위시 홈으로">
          <span className="wordmark-planet"><i /></span>
          <span>ORBIT WISH</span>
        </button>
        <div className="header-actions">
          <span className="draft-label">UI DRAFT</span>
          <button className="icon-button" onClick={() => setDark((value) => !value)} aria-label={dark ? '라이트 테마' : '다크 테마'}>
            <span className="pixel-emoji theme-emoji" aria-hidden="true">{dark ? '☀️' : '🌙'}</span>
          </button>
        </div>
      </header>

      <div className="app-content">
        {screen === 'wishes' && (
          <WishScreen
            wish={selected}
            wishes={activeWishes}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onMove={moveWish}
            onDeposit={() => selected && setDepositing(selected)}
            onAdd={openAddSheet}
            onWait={() => {
              if (!selected) return
              setWishes((current) => current.map((wish) => wish.id === selected.id ? { ...wish, status: 'waiting' } : wish))
              setToast('관측 연장')
            }}
          />
        )}
        {screen === 'galaxy' && <GalaxyScreen />}
        {screen === 'observer' && <ObserverScreen onAdd={() => { setScreen('wishes'); openAddSheet() }} />}
        {screen === 'settings' && <SettingsScreen dark={dark} onThemeChange={setDark} />}
      </div>

      <nav className="bottom-nav" aria-label="주요 화면">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return <button key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => setScreen(item.id)}><Icon size={21} /><span>{item.label}</span></button>
        })}
      </nav>

      {depositing && (
        <DepositSheet
          wishName={depositing.name}
          dailyShare={shareFor(depositing)}
          availableAmount={92_400}
          onClose={() => setDepositing(null)}
          onDeposit={deposit}
          onSkip={skipToday}
        />
      )}
      {adding && <AddWishSheet colorIndex={wishes.length} onClose={() => setAdding(false)} onAdd={(wish) => {
        setWishes((current) => [...current, wish])
        setSelectedIndex(activeWishes.length)
        setAdding(false)
        setScreen('wishes')
        setToast('새 위시 등록')
      }} />}
      {toast && <div className="toast"><span className="pixel-emoji toast-emoji" aria-hidden="true">⭐</span>{toast}</div>}
    </div>
  )
}

function WishScreen({ wish, wishes, selectedIndex, onSelect, onMove, onDeposit, onAdd, onWait }: {
  wish?: DemoWish
  wishes: DemoWish[]
  selectedIndex: number
  onSelect: (index: number) => void
  onMove: (direction: -1 | 1) => void
  onDeposit: () => void
  onAdd: () => void
  onWait: () => void
}) {
  if (!wish) return (
    <main className="empty-screen">
      <PlanetVisual color={COLORS[0]} progress={12} />
      <span className="pixel-label">EMPTY ORBIT</span>
      <h1>빈 궤도</h1>
      <button className="primary-button" onClick={onAdd}><Plus size={18} /> 위시 등록</button>
    </main>
  )

  const progress = wishProgress(wish)
  const days = remainingDays(wish.targetDate)
  const share = shareFor(wish)
  const ready = wish.status === 'ready'
  const waiting = wish.status === 'waiting'

  return (
    <main className="wish-screen">
      <div className="wish-toolbar">
        <div><span className="pixel-label">CURRENT ORBIT</span><p>{selectedIndex + 1} / {wishes.length}</p></div>
        <button className="add-compact" onClick={onAdd}><Plus size={17} /> 새 위시</button>
      </div>

      <section className="wish-stage">
        {wishes.length > 1 && <button className="carousel-arrow left" onClick={() => onMove(-1)} aria-label="이전 위시"><ChevronLeft /></button>}
        <PlanetVisual color={wish.color} progress={progress} active />
        {wishes.length > 1 && <button className="carousel-arrow right" onClick={() => onMove(1)} aria-label="다음 위시"><ChevronRight /></button>}
      </section>

      <section className="wish-info">
        <div className="wish-state"><span />{ready ? '목표 도달' : waiting ? '조금 더 관측 중' : `${days}일 뒤 궤도 도착`}</div>
        <h1>{wish.name}</h1>
        <div className="main-progress" aria-label={`진행률 ${progress}%`}><i style={{ width: `${progress}%` }} /></div>
        <div className="saved-row"><strong>{money(wish.savedAmount)}</strong><span>/ {money(wish.targetAmount)}원</span><em>{progress}%</em></div>

        <div className="wish-metrics">
          <div><span>하루 몫</span><strong>{share ? `${money(share)}원` : '—'}</strong></div>
          <i />
          <div><span>남은 날</span><strong>{days ? `${days}일` : '미정'}</strong></div>
          <i />
          <div><span>이번 달 저금</span><strong>40,000원</strong></div>
        </div>

        {ready ? (
          <div className="ready-actions">
            <button className="primary-button"><WalletCards size={18} /> 구매하기</button>
            <button className="secondary-button" onClick={onWait}><Clock3 size={18} /> 더 기다리기</button>
            <button className="text-button"><Archive size={17} /> 정리하기</button>
          </div>
        ) : waiting ? (
          <div className="waiting-panel"><span className="pixel-emoji" aria-hidden="true">✨</span><div><strong>관측 6일째</strong></div><button className="secondary-button">선택 열기</button></div>
        ) : (
          <>
            <button className="primary-button save-button" onClick={onDeposit}>오늘 모으기</button>
            <div className="sub-actions"><button><Clock3 size={15} /> 연기</button><span /> <button><Edit3 size={15} /> 수정</button></div>
          </>
        )}
      </section>

      <div className="page-dots">
        {wishes.map((item, index) => <button key={item.id} className={index === selectedIndex ? 'active' : ''} onClick={() => onSelect(index)} aria-label={`${index + 1}번째 위시`} />)}
      </div>
    </main>
  )
}

function GalaxyScreen() {
  const [selected, setSelected] = useState(COMPLETED[0])
  return (
    <main className="galaxy-screen">
      <header className="screen-heading inverted"><span className="pixel-label">MY CONSTELLATION</span><h1>완주한 성계</h1></header>
      <div className="galaxy-field">
        <span className="galaxy-star one" /><span className="galaxy-star two" /><span className="galaxy-star three" /><span className="galaxy-star four" />
        {COMPLETED.map((item, index) => (
          <button key={item.id} className={`galaxy-planet gp-${index + 1} ${selected.id === item.id ? 'selected' : ''}`} onClick={() => setSelected(item)}>
            <PlanetVisual compact color={item.color} progress={100} />
            <span>{item.name}</span>
          </button>
        ))}
      </div>
      <section className="galaxy-detail">
        <div><span className="pixel-label">ORBIT COMPLETE</span><h2>{selected.name}</h2></div>
        <dl><div><dt>걸린 날</dt><dd>{selected.days}일</dd></div><div><dt>지킨 날</dt><dd>{selected.kept}일</dd></div><div><dt>완주</dt><dd>{formatDate(selected.date)}</dd></div><div><dt>모은 금액</dt><dd>{money(selected.amount)}원</dd></div></dl>
      </section>
    </main>
  )
}

function ObserverScreen({ onAdd }: { onAdd: () => void }) {
  const badges = [
    { name: '첫 궤도', detail: '첫 위시 완주', icon: '🪐', earned: true },
    { name: '장기 관측', detail: '30일 이상 완주', icon: '🔭', earned: true },
    { name: '절약가', detail: '남은 예산 10회', icon: '🪙', earned: false },
    { name: '인내', detail: '더 기다리기 5회', icon: '⌛', earned: false },
    { name: '관측 습관', detail: '연속 14일', icon: '📡', earned: false },
    { name: '정리', detail: '위시를 잘 놓아주기', icon: '📦', earned: true },
  ]
  return (
    <main className="observer-screen">
      <header className="screen-heading"><span className="pixel-label">OBSERVER LOG</span><h1>관측자 Lv.4</h1></header>
      <section className="xp-card">
        <div className="observer-emblem"><span className="pixel-emoji observer-emoji" aria-hidden="true">🔭</span></div>
        <div className="xp-main"><div><span>다음 레벨까지</span><strong>180 XP</strong></div><div className="xp-track"><i style={{ width: '74%' }} /></div><p><span>520 XP</span><span>700 XP</span></p></div>
      </section>
      <section className="stat-grid">
        <div><span>지킨 날</span><strong>42일</strong><small>전체 기록</small></div>
        <div><span>현재 연속</span><strong>6일</strong><small>최장 14일</small></div>
        <div><span>넘긴 예산</span><strong>8회</strong><small>96,300원</small></div>
        <div><span>더 기다림</span><strong>3회</strong><small>소비를 미룬 선택</small></div>
      </section>
      <section className="title-section"><div className="section-title"><div><span className="pixel-label">TITLES</span><h2>관측 기록</h2></div><span>3 / 6</span></div><div className="badge-grid">{badges.map((badge) => <div className={`badge-card ${badge.earned ? 'earned' : 'locked'}`} key={badge.name}><span className="pixel-emoji badge-emoji" aria-hidden="true">{badge.icon}</span><strong>{badge.name}</strong><span>{badge.detail}</span></div>)}</div></section>
      <button className="observer-add" onClick={onAdd}><Plus size={17} /> 새 관측 시작</button>
    </main>
  )
}

function SettingsScreen({ dark, onThemeChange }: { dark: boolean; onThemeChange: (value: boolean) => void }) {
  return (
    <main className="settings-screen">
      <header className="screen-heading"><span className="pixel-label">SETTINGS</span><h1>관측소 설정</h1></header>
      <section className="settings-card">
        <div className="setting-row"><div><strong>화면 테마</strong></div><div className="theme-choice"><button className={!dark ? 'active' : ''} onClick={() => onThemeChange(false)}><Sun size={17} /> 라이트</button><button className={dark ? 'active' : ''} onClick={() => onThemeChange(true)}><Moon size={17} /> 다크</button></div></div>
        <div className="setting-row"><div><strong>Orbit Budget</strong><span>동일 브라우저 연결</span></div><span className="connection-state"><i /> 연결됨</span></div>
        <div className="setting-row"><div><strong>현재 프로토타입</strong><span>샘플 데이터</span></div><span className="version-label">DRAFT 01</span></div>
      </section>
      <a className="orbit-budget-link" href={import.meta.env.DEV ? '/apps/orbit/' : '/orbit/'}><Orbit size={18} /> Orbit Budget 열기</a>
    </main>
  )
}

function AddWishSheet({ colorIndex, onClose, onAdd }: { colorIndex: number; onClose: () => void; onAdd: (wish: DemoWish) => void }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState('')
  const [periodUnit, setPeriodUnit] = useState<'day' | 'week' | 'month'>('day')
  const targetDate = useMemo(() => {
    const count = Number(period)
    if (!Number.isInteger(count) || count < 1) return null
    const date = new Date()
    if (periodUnit === 'month') date.setMonth(date.getMonth() + count)
    else date.setDate(date.getDate() + count * (periodUnit === 'week' ? 7 : 1))
    return date.toLocaleDateString('sv-SE')
  }, [period, periodUnit])

  function submit(event: FormEvent) {
    event.preventDefault()
    const targetAmount = Number(amount)
    if (!name.trim() || targetAmount <= 0) return
    onAdd({ id: crypto.randomUUID(), name: name.trim(), targetAmount, savedAmount: 0, targetDate, color: COLORS[colorIndex % COLORS.length], status: 'active' })
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="deposit-sheet add-sheet" onSubmit={submit}>
        <div className="sheet-handle" />
        <header className="sheet-header"><div><span className="pixel-label">NEW WISH</span><h2>위시 등록</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button></header>
        <label>위시 이름<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="오래 생각해 본 것" /></label>
        <label>목표 금액<div className="input-with-unit"><input type="number" min="1" step="1000" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="200000" /><span>원</span></div></label>
        <fieldset>
          <legend>목표 기간</legend>
          <div className="period-editor">
            <input
              inputMode="numeric"
              aria-label="목표 기간 숫자"
              value={period}
              onChange={(event) => setPeriod(event.target.value.replace(/\D/g, ''))}
              placeholder="기간 없음"
            />
            <div className="period-unit-choice" aria-label="기간 단위">
              {([['day', '일'], ['week', '주'], ['month', '월']] as const).map(([value, label]) => (
                <button type="button" key={value} className={periodUnit === value ? 'active' : ''} aria-pressed={periodUnit === value} onClick={() => setPeriodUnit(value)}>{label}</button>
              ))}
            </div>
          </div>
        </fieldset>
        <button className="primary-button full" type="submit">이 위시 시작하기</button>
      </form>
    </div>
  )
}
