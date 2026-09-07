import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Lock, Moon, Plus, Sun, WalletCards } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import {
  dailyShare,
  canPurchase,
  dayStatus,
  daysBetween,
  keptDays,
  orbitLevelOf,
  progress as progressOf,
  totalDailyShare,
  remainingDays,
  stageOf,
  vaultTotal,
} from '@orbit/wish-core/wish'
import {
  UNLOCKS,
  XP,
  claimIdOf,
  earnedTitles,
  levelFromXp,
  missionUnits,
  observerStats,
  pendingUnits,
  slotCount,
  sumXp,
  totalXp as totalXpOf,
} from '@orbit/wish-core/xp'
import type { Wish, WishEvent } from '@orbit/wish-core/types'
import {
  chooseWait,
  cancelWish,
  ensurePlayer,
  claimAll as claimAllWrite,
  claimMission,
  createWish,
  deposit,
  markCelebratedLevel,
  markCelebratedTitles,
  purchaseWish,
  recordWaitDay,
  skipDay,
  updateWish,
} from '@orbit/wish-bridge'
import { createWishPurchaseTransaction } from '@orbit/bridge'
import { OrbitRing, PixelPlanet } from './components/PixelPlanet'
import { PixelBar } from './components/PixelBar'
import { OrbitMap } from './components/OrbitMap'
import { RewardOverlay, type Reward } from './components/RewardOverlay'
import { CarryoverSheet, CollectSheet, ResolveWishSheet, WishSheet } from './components/Sheets'
import { buildMissions, type Mission } from './missions'
import { CODEX_SLOTS, STAGE_NAMES, TITLES } from './lib/labels'
import { formatDate, pad2, todayString } from './lib/format'
import { useClaims, usePlayer, useWishEvents, useWishes } from './lib/hooks'
import { loadBudgetView, sinceLabel, type BudgetView } from './lib/budget'

type Screen = 'hub' | 'quests' | 'codex' | 'observer'

const NAV: { id: Screen; label: string }[] = [
  { id: 'hub', label: '궤도' },
  { id: 'quests', label: '위시' },
  { id: 'codex', label: '도감' },
  { id: 'observer', label: '관측자' },
]

// index.html의 첫 페인트 스크립트와 같은 키를 쓴다.
const THEME_KEY = 'wish-theme'

/** 승격 전 Wish Lab 키('wish-lab-theme')로 저장된 선택을 한 번 더 읽어준다. */
function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY) ?? localStorage.getItem('wish-lab-theme')
    if (saved) return saved === 'dark'
  } catch { /* 저장소 접근 불가 */ }
  return matchMedia('(prefers-color-scheme: dark)').matches
}

export default function App() {
  const today = useMemo(todayString, [])
  const [screen, setScreen] = useState<Screen>('hub')

  // 저장소 구독은 여기 한 곳뿐. 화면들은 prop으로 받는다
  const storedWishes = useWishes()
  const storedEvents = useWishEvents()
  const storedClaims = useClaims()
  const player = usePlayer()
  const loaded =
    storedWishes !== undefined && storedEvents !== undefined && storedClaims !== undefined && player !== undefined
  const wishes = useMemo(() => storedWishes ?? [], [storedWishes])
  const events = useMemo(() => storedEvents ?? [], [storedEvents])
  const claims = useMemo(() => storedClaims ?? [], [storedClaims])

  const [activeId, setActiveId] = useState<string | null>(null)

  // Orbit 예산 요약. 저금할 때마다 다시 읽어 숫자를 맞춘다
  const [budget, setBudget] = useState<BudgetView | null>(null)
  const refreshBudget = useCallback(() => { void loadBudgetView(today).then(setBudget) }, [today])
  useEffect(refreshBudget, [refreshBudget])
  const freeAmount = budget?.snapshot?.freeAmount ?? 0
  // 어제 쓰고 남은 자유비용. Orbit이 계산해 스냅샷으로 넘겨준다
  const carryover = budget?.snapshot?.carryoverAmount ?? 0
  const carryoverRows = useMemo(() => budget?.snapshot?.carryoverRows ?? [], [budget])
  const [collecting, setCollecting] = useState<Wish | null>(null)
  const [carrying, setCarrying] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Wish | null>(null)
  const [resolving, setResolving] = useState<Wish | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [xpPop, setXpPop] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [dark, setDark] = useState(readTheme)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
    } catch { /* 저장소 접근 불가 */ }
  }, [dark])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (xpPop === null) return
    const timer = window.setTimeout(() => setXpPop(null), 1200)
    return () => window.clearTimeout(timer)
  }, [xpPop])

  // Player 레코드 생성과 마지막 접속일 갱신. 구독 밖에서 한다
  useEffect(() => {
    if (player === undefined) return
    if (player === null || player.lastOpenedDate !== today) void ensurePlayer(today)
  }, [player, today])

  // 화면에 필요한 값은 전부 이벤트와 수령 기록에서 파생한다. 저장하는 XP는 없다.
  const openWishes = useMemo(
    () => wishes.filter((wish) => wish.status === 'active' || wish.status === 'ready' || wish.status === 'waiting'),
    [wishes],
  )
  const orbitNumbers = useMemo(
    () => new Map(
      [...wishes]
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
        .map((wish, index) => [wish.id, index + 1]),
    ),
    [wishes],
  )
  const doneWishes = useMemo(() => wishes.filter((wish) => wish.status === 'done'), [wishes])
  const totalXp = useMemo(() => totalXpOf(wishes, events, claims), [wishes, events, claims])
  const level = levelFromXp(totalXp)
  const slots = slotCount(level.level, doneWishes.length)
  // 슬롯을 차지하는 것은 기간을 정한 위시뿐이다. 기간 없는 위시는 하루 몫 미션도
  // 만들지 않으므로(missions.ts) 몇 개를 담아 두든 관측 부담이 늘지 않는다.
  const slotsUsed = useMemo(() => openWishes.filter((wish) => wish.targetDate).length, [openWishes])
  const canSchedule = slotsUsed < slots
  const stats = useMemo(() => observerStats(wishes, events, today), [wishes, events, today])
  const titles = useMemo(() => earnedTitles(wishes, events, today), [wishes, events, today])
  const missions = useMemo(
    () => buildMissions(openWishes, events, claims, today, carryover),
    [openWishes, events, claims, today, carryover],
  )
  const pending = useMemo(
    () => pendingUnits(missionUnits(wishes, events), claims),
    [wishes, events, claims],
  )
  const pendingXp = sumXp(pending)
  const vault = vaultTotal(wishes)
  // 등록할 때 무리한 계획을 경고하는 데 쓴다
  const existingShare = totalDailyShare(openWishes, events, today)
  const active = openWishes.find((wish) => wish.id === activeId) ?? openWishes[0] ?? null

  const pushReward = useCallback((next: Reward) => setRewards((current) => [...current, next]), [])

  // XP는 파생값이라 레벨업은 "지급"이 아니라 문턱을 넘었는지 감시해서 잡는다.
  // 어디까지 연출을 봤는지는 Player에 남긴다. 안 그러면 새로고침마다 다시 뜬다.
  useEffect(() => {
    if (!loaded || !player || level.level <= player.celebratedLevel) return
    const unlock = UNLOCKS.find((item) => item.level === level.level)
    pushReward({
      kind: 'levelup',
      from: player.celebratedLevel,
      to: level.level,
      title: level.title,
      unlock: unlock?.name ?? null,
    })
    void markCelebratedLevel(level.level)
  }, [loaded, player, level.level, level.title, pushReward])

  // 칭호도 같은 방식으로 감시한다. 첫 계산에서 이미 달성한 것은 연출 없이 기록만 해
  // 업데이트 직후 밀린 연출이 한꺼번에 쏟아지지 않게 한다. shown은 저장이 끝나기 전에
  // 이펙트가 한 번 더 돌아 같은 칭호를 두 번 띄우는 것을 막는다.
  const shownTitles = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!loaded || !player) return
    // 이 필드가 없던 때 만들어진 Player 레코드도 있다
    const celebrated = player.celebratedTitles ?? []
    if (!shownTitles.current) {
      shownTitles.current = new Set(titles)
      if (titles.some((id) => !celebrated.includes(id))) void markCelebratedTitles([...celebrated, ...titles])
      return
    }
    const fresh = titles.filter((id) => !shownTitles.current!.has(id) && !celebrated.includes(id))
    if (!fresh.length) return
    for (const id of fresh) {
      shownTitles.current.add(id)
      const title = TITLES.find((item) => item.id === id)
      if (title) pushReward({ kind: 'title', name: title.name, detail: title.detail, icon: title.icon })
    }
    void markCelebratedTitles([...celebrated, ...fresh])
  }, [loaded, player, titles, pushReward])

  async function collect(amount: number) {
    if (!collecting) return
    const target = collecting
    const full = amount >= dailyShare(target, events, today)
    setCollecting(null)
    await deposit(target.id, amount, today)
    refreshBudget()
    setToast(full ? '하루 몫 완료 · 수령 대기' : '부분 납입 기록 · 수령 대기')
  }

  async function skipToday() {
    if (!collecting) return
    const target = collecting
    setCollecting(null)
    await skipDay(target.id, today)
    setToast('오늘은 쉬어감')
  }

  /** 미션 수행. 하루 몫만 시트를 열고 나머지는 그 자리에서 이벤트를 남긴다 */
  async function runMission(mission: Mission) {
    if (mission.kind === 'share') {
      const wish = openWishes.find((item) => item.id === mission.wishId)
      if (wish) setCollecting(wish)
      return
    }
    if (mission.kind === 'wait' && mission.wishId) {
      await recordWaitDay(mission.wishId, today)
      setToast('하루 더 기다리기')
      return
    }
    if (mission.kind === 'carryover') {
      // 어느 궤도에 넣을지는 시트에서 고른다. 중복 수행은 이벤트 유무로 막는다
      setCarrying(true)
    }
  }

  /** 어제 남은 예산을 고른 궤도에 넣는다. Orbit 자유비용에서도 그만큼 빠진다 */
  async function carryOver(wishId: string, amount: number) {
    setCarrying(false)
    await deposit(wishId, amount, today, 'carryover')
    refreshBudget()
    const target = openWishes.find((wish) => wish.id === wishId)
    setToast(`남은 예산 ${money(amount)}원을 ${target ? target.name : '궤도'}에 저금`)
  }

  /** 미션 하나 수령 */
  async function claimOne(mission: Mission) {
    const unit = pending.find((item) => item.date === mission.date && item.missionId === mission.id)
    if (!unit) return
    setXpPop(unit.xp)
    await claimMission(unit.date, unit.missionId)
  }

  /** 지금 받을 수 있는 것 전부 수령. 지난 날짜의 미수령분도 함께 들어온다 */
  async function claimAll() {
    if (!pending.length) return
    setXpPop(pendingXp)
    await claimAllWrite(pending)
  }

  async function completeWish(wish: Wish, categoryId: string | null) {
    if (!canPurchase(wish, today)) return
    // 결정적인 id + Orbit의 put 조합으로 두 DB 저장 도중 재시도해도 거래가 중복되지 않는다.
    const transactionId = `wish-purchase-${wish.id}`
    await createWishPurchaseTransaction({
      id: transactionId,
      wishName: wish.name,
      amount: wish.targetAmount,
      date: today,
      categoryId,
    })
    await purchaseWish(wish.id, today, transactionId)
    setResolving(null)
    pushReward({
      kind: 'complete',
      name: wish.name,
      seed: wish.seed,
      stardust: keptDays(events, wish.id) * XP.share + XP.complete,
      date: today,
    })
    setActiveId((current) => (current === wish.id ? null : current))
  }

  async function cancelOpenWish(wish: Wish, targetWishId: string | null) {
    await cancelWish(wish.id, today, targetWishId)
    setResolving(null)
    setActiveId((current) => (current === wish.id ? targetWishId : current))
    refreshBudget()
    setToast(targetWishId ? '모은 금액을 다른 궤도로 이동' : '모은 금액을 자유비용으로 회수')
  }

  // 기간 없는 위시는 언제든 담을 수 있으므로 여는 것 자체는 막지 않는다.
  // 슬롯이 없으면 시트 안에서 기간 입력만 잠근다.
  function openAdd() {
    setAdding(true)
  }

  // 저장소를 읽는 동안은 화면을 그리지 않는다. 빈 궤도 화면이 한 번 번쩍이는 것을 막는다
  if (!loaded) return <div className="wl-app loading" />

  return (
    <div className={`wl-app screen-${screen}`}>
      <header className="wl-hud">
        <div className="hud-top">
          {switcherOpen && <button className="app-switcher-dismiss" aria-label="앱 메뉴 닫기" onClick={() => setSwitcherOpen(false)} />}
          <div className="app-switcher">
            <button className="wish-wordmark" onClick={() => setSwitcherOpen((open) => !open)} aria-expanded={switcherOpen} aria-haspopup="menu">
              <PixelPlanet progress={38} seed={7} size={32} />
              <strong>wish</strong>
              <span aria-hidden="true">⌄</span>
            </button>
            {switcherOpen && (
              <div className="app-switcher-menu" role="menu">
                <button className="current" role="menuitem" onClick={() => setSwitcherOpen(false)}><PixelPlanet progress={38} seed={7} size={28} crop /><span><strong>wish</strong><small>현재 앱</small></span></button>
                <a role="menuitem" href={import.meta.env.DEV ? '/apps/orbit/' : '/'}><span className="menu-orbit-logo" aria-hidden="true" /><span><strong>orbit</strong><small>예산 관리</small></span></a>
              </div>
            )}
          </div>
          <div className="hud-xp">
            <PixelBar ratio={level.ratio} segments={14} label={`레벨 ${level.level} 진행률 ${Math.round(level.ratio * 100)}%`} />
            <p><span>LV. {pad2(level.level)}</span></p>
          </div>
          <button className="icon-button" onClick={() => setDark((value) => !value)} aria-label={dark ? '라이트 테마' : '다크 테마'}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <ul className="hud-resources">
          <li>
            <span className="res-icon" aria-hidden="true">🪙</span>
            <div>
              <strong>{budget?.snapshot ? `${money(freeAmount)}원` : '—'}</strong>
              <span>{budget?.snapshot ? (budget.stale ? '자유비용 (지난 값)' : '남은 자유비용') : '연결 안 됨'}</span>
            </div>
          </li>
          <li><span className="res-icon" aria-hidden="true">🌠</span><div><strong>{stats.streak}일</strong><span>연속 관측</span></div></li>
          <li><span className="res-icon" aria-hidden="true">🫙</span><div><strong>{money(vault)}원</strong><span>저금통</span></div></li>
        </ul>
        {xpPop !== null && <span className="xp-pop">+{xpPop} XP</span>}
      </header>

      <div className="wl-content">
        {screen === 'hub' && (
          <HubScreen
            wishes={openWishes}
            active={active}
            events={events}
            today={today}
            missions={missions}
            pendingXp={pendingXp}
            slots={slots}
            slotsUsed={slotsUsed}
            level={level.level}
            onSelect={setActiveId}
            onAdd={openAdd}
            onRun={runMission}
            onClaimOne={claimOne}
            onClaimAll={claimAll}
            onOpenQuests={() => setScreen('quests')}
          />
        )}
        {screen === 'quests' && (
          <QuestScreen
            wishes={openWishes}
            slotsUsed={slotsUsed}
            orbitNumbers={orbitNumbers}
            events={events}
            today={today}
            slots={slots}
            onCollect={(wish) => setCollecting(wish)}
            onAdd={openAdd}
            onEdit={(wish) => setEditing(wish)}
            onResolve={setResolving}
            onFocus={(wish) => { setActiveId(wish.id); setScreen('hub') }}
          />
        )}
        {screen === 'codex' && <CodexScreen wishes={doneWishes} events={events} />}
        {screen === 'observer' && (
          <ObserverScreen
            level={level}
            totalXp={totalXp}
            pendingXp={pendingXp}
            stats={stats}
            titles={titles}
            budget={budget}
            dark={dark}
            onThemeChange={setDark}
          />
        )}
      </div>

      <nav className="wl-nav" aria-label="주요 화면">
        {NAV.map((item) => (
          <button key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => setScreen(item.id)}>
            <span aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {collecting && (
        <CollectSheet
          wishName={collecting.name}
          dailyShare={dailyShare(collecting, events, today)}
          availableAmount={freeAmount}
          onClose={() => setCollecting(null)}
          onCollect={collect}
          onSkip={skipToday}
        />
      )}
      {carrying && (
        <CarryoverSheet
          amount={carryover}
          rows={carryoverRows}
          wishes={openWishes}
          onClose={() => setCarrying(false)}
          onDeposit={carryOver}
        />
      )}
      {adding && (
        <WishSheet
          today={today}
          existingShare={existingShare}
          freeAmount={freeAmount}
          canSchedule={canSchedule}
          onClose={() => setAdding(false)}
          onCreate={async (input) => {
            setAdding(false)
            const wish = await createWish({ ...input, today })
            setActiveId(wish.id)
            setScreen('hub')
            setToast('새 행성이 궤도에 도착')
          }}
        />
      )}
      {editing && (
        <WishSheet
          today={today}
          wish={editing}
          existingShare={existingShare}
          freeAmount={freeAmount}
          canSchedule={canSchedule || Boolean(editing.targetDate)}
          onClose={() => setEditing(null)}
          onUpdate={async (input) => {
            const target = editing
            setEditing(null)
            await updateWish(target.id, { ...input, today })
            setToast('위시 수정 완료')
          }}
          onDelete={async () => {
            const target = editing
            setEditing(null)
            await cancelWish(target.id, today, null)
            setActiveId((current) => current === target.id ? null : current)
            refreshBudget()
            setToast(target.savedAmount > 0 ? '위시 삭제 후 모은 금액 회수' : '위시 삭제 완료')
          }}
        />
      )}
      {resolving && (
        <ResolveWishSheet
          wish={resolving}
          today={today}
          categories={budget?.snapshot?.categories ?? []}
          transferTargets={openWishes.filter((wish) => wish.id !== resolving.id && wish.status === 'active')}
          onClose={() => setResolving(null)}
          onPurchase={(categoryId) => completeWish(resolving, categoryId)}
          onWait={async () => {
            await chooseWait(resolving.id, today)
            setResolving(null)
            setToast(`기다리는 중 · 하루마다 +${XP.wait} XP`)
          }}
          onCancel={(targetWishId) => cancelOpenWish(resolving, targetWishId)}
        />
      )}
      {rewards[0] && <RewardOverlay reward={rewards[0]} onClose={() => setRewards((current) => current.slice(1))} />}
      {toast && <div className="wl-toast"><span aria-hidden="true">⭐</span>{toast}</div>}
    </div>
  )
}

function HubScreen({ wishes, active, events, today, missions, pendingXp, slots, slotsUsed, level, onSelect, onAdd, onRun, onClaimOne, onClaimAll, onOpenQuests }: {
  wishes: Wish[]
  active: Wish | null
  events: WishEvent[]
  today: string
  missions: Mission[]
  pendingXp: number
  slots: number
  slotsUsed: number
  level: number
  onSelect: (id: string) => void
  onAdd: () => void
  onRun: (mission: Mission) => void
  onClaimOne: (mission: Mission) => void
  onClaimAll: () => void
  onOpenQuests: () => void
}) {
  if (!active) {
    return (
      <main className="hub-screen empty">
        <PixelPlanet progress={6} seed={3} size={140} float />
        <span className="pixel-label">EMPTY ORBIT</span>
        <h1>우주가 아직 조용하다</h1>
        <p>첫 소원을 빌고 궤도를 하나 열어 보자.</p>
        <button className="primary-button" onClick={onAdd}><Plus size={18} /> 새 소원 빌기</button>
      </main>
    )
  }

  const progress = progressOf(active)
  const days = remainingDays(active, today)
  const share = dailyShare(active, events, today)
  const done = missions.filter((mission) => mission.state !== 'todo').length

  return (
    <main className="hub-screen">
      <header className="hub-greeting">
        <h1>내 궤도</h1>
      </header>

      <section className="hub-stage">
        <OrbitMap
          wishes={wishes}
          activeId={active.id}
          onSelect={onSelect}
          onAdd={onAdd}
        />
        <div className="stage-caption">
          <span className="pixel-label">{orbitLevelOf(progress)}단계 · {STAGE_NAMES[stageOf(progress)]}</span>
          <h2>{active.name}</h2>
          <p className="stage-numbers">
            <strong>{progress}%</strong>
            <span>{money(active.savedAmount)} / {money(active.targetAmount)}원</span>
          </p>
          <p className="stage-meta">
            <span>하루 몫 {share ? `${money(share)}원` : '—'}</span>
            <i />
            <span>{days ? `${days}일 남음` : '기간 없음'}</span>
            <i />
            <span>지킨 날 {keptDays(events, active.id)}일</span>
          </p>
        </div>
      </section>

      <section className="mission-panel">
        <div className="panel-head">
          <div>
            <span className="pixel-label">TODAY'S MISSIONS</span>
            <h2>오늘의 미션 {done} / {missions.length}</h2>
          </div>
          <button className="link-button" onClick={onOpenQuests}>퀘스트 로그 <ChevronRight size={15} /></button>
        </div>

        <ul className="mission-list">
          {missions.map((mission) => (
            <li key={mission.id} className={`mission ${mission.state}`}>
              <span className="mission-mark" aria-hidden="true" />
              <div className="mission-text">
                <strong>{mission.title}</strong>
                <span className="mission-sub">
                  {mission.wishName && <span className="mission-wish">{mission.wishName}</span>}
                  {mission.detail}
                </span>
              </div>
              <span className="mission-xp">{mission.skipped ? '—' : `+${mission.xp} XP`}</span>
              {mission.state === 'todo' && <button className="mission-go" onClick={() => onRun(mission)}>수행</button>}
              {mission.state === 'claimable' && (
                <button className="mission-go claim" onClick={() => onClaimOne(mission)}>+{mission.xp} 받기</button>
              )}
              {mission.state === 'claimed' && <span className="mission-state">{mission.skipped ? '쉬어감' : '수령 완료'}</span>}
            </li>
          ))}
        </ul>

        <button className="claim-button" onClick={onClaimAll} disabled={!pendingXp}>
          {pendingXp ? `CLAIM +${pendingXp} XP` : '수령할 보상 없음'}
        </button>
        <p className="claim-hint">Lv.{pad2(level)} 관측자 · 궤도 슬롯 {slotsUsed} / {slots}</p>
      </section>
    </main>
  )
}

function QuestScreen({ wishes, slotsUsed, orbitNumbers, events, today, slots, onCollect, onAdd, onEdit, onResolve, onFocus }: {
  wishes: Wish[]
  orbitNumbers: ReadonlyMap<string, number>
  events: WishEvent[]
  today: string
  slots: number
  slotsUsed: number
  onCollect: (wish: Wish) => void
  onAdd: () => void
  onEdit: (wish: Wish) => void
  onResolve: (wish: Wish) => void
  onFocus: (wish: Wish) => void
}) {
  return (
    <main className="quest-screen">
      <header className="screen-head">
        <span className="pixel-label">QUEST LOG</span>
        <h1>진행 중인 궤도</h1>
        <p>{slotsUsed} / {slots} 슬롯 사용 중</p>
      </header>

      <ul className="quest-list">
        {wishes.map((wish) => {
          const progress = progressOf(wish)
          const share = dailyShare(wish, events, today)
          const days = remainingDays(wish, today)
          const todayDone = dayStatus(wish, events, today) !== 'none'
          return (
            <li key={wish.id} className={`quest-card state-${wish.status}`}>
              <div className="quest-body">
                <div className="quest-card-head">
                  <div className="quest-heading">
                    <span className="pixel-label">ORBIT {pad2(orbitNumbers.get(wish.id) ?? 1)}</span>
                    <div className="quest-title-row">
                      <h2>{wish.name}</h2>
                      <button className="quest-edit" onClick={() => onEdit(wish)} aria-label={`${wish.name} 수정하기`}><span aria-hidden="true">✎</span></button>
                    </div>
                  </div>
                  <button className="quest-planet" onClick={() => onFocus(wish)} aria-label={`${wish.name} 허브에서 보기`}>
                    <PixelPlanet progress={progress} seed={wish.seed} size={64} />
                  </button>
                </div>
                <PixelBar ratio={progress / 100} segments={12} />
                <p className="quest-numbers">
                  <strong>{money(wish.savedAmount)}</strong>
                  <span>/ {money(wish.targetAmount)}원</span>
                  <em>{progress}%</em>
                </p>
                <p className="quest-meta">
                  {wish.status === 'ready' ? (
                    <span className="flag ready">목표 도달</span>
                  ) : wish.status === 'waiting' ? (
                    <span className="flag waiting">기다리는 중 · 하루 +{XP.wait} XP</span>
                  ) : (
                    <>
                      <span className={todayDone ? 'flag done' : 'flag todo'}>{todayDone ? '오늘 몫 완료' : '오늘 몫 미완료'}</span>
                      <i />
                      <span>하루 {share ? `${money(share)}원` : '—'}</span>
                      <i />
                      <span>{days ? `${days}일 남음` : '기간 없음'}</span>
                    </>
                  )}
                </p>
                <div className="quest-actions">
                  {wish.status === 'ready' || wish.status === 'waiting' ? (
                    <button className="primary-button" onClick={() => onResolve(wish)}><WalletCards size={17} /> {wish.status === 'ready' ? '다음 선택하기' : '구매·정리 선택'}</button>
                  ) : (
                    <button className="primary-button" disabled={todayDone} onClick={() => onCollect(wish)}>
                      {todayDone ? '오늘 몫 완료' : '오늘 모으기'}
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}

        {Array.from({ length: Math.max(0, 3 - slotsUsed) }, (_, index) => {
          const slotNumber = slotsUsed + index + 1
          const locked = slotNumber > slots
          return (
            <li key={`slot-${slotNumber}`} className={`quest-slot${locked ? ' locked' : ''}`}>
              {locked ? (
                <>
                  <Lock size={18} />
                  <strong>슬롯 {slotNumber} 잠김</strong>
                  <span>{slotNumber === 2 ? 'Lv.2 또는 완주 1개' : 'Lv.4 또는 완주 3개'}</span>
                </>
              ) : (
                <button onClick={onAdd}><Plus size={18} /> 슬롯 {slotNumber} · 새 소원 빌기</button>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}

function CodexScreen({ wishes, events }: { wishes: Wish[]; events: WishEvent[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const entries = useMemo(() => wishes.map((wish) => {
    const purchase = events.find((event) => event.wishId === wish.id && event.type === 'purchase')
    const date = purchase?.date ?? wish.targetDate ?? wish.startDate
    const kept = keptDays(events, wish.id)
    return {
      wish,
      date,
      days: daysBetween(wish.startDate, date) + 1,
      keptDays: kept,
      // 그 위시에서 얻은 별먼지. 지킨 날 XP + 완주 보너스
      stardust: kept * XP.share + XP.complete,
    }
  }).sort((a, b) => (a.date < b.date ? 1 : -1)), [wishes, events])

  const entry = entries.find((item) => item.wish.id === selectedId) ?? entries[0]
  const empty = Math.max(0, CODEX_SLOTS - entries.length)

  return (
    <main className="codex-screen">
      <header className="screen-head">
        <span className="pixel-label">UNIVERSE CODEX</span>
        <h1>우주 도감</h1>
        <p>별 {entries.length} / {CODEX_SLOTS} 수집</p>
      </header>

      <section className="constellation">
        {entries.map((item, index) => (
          <button
            key={item.wish.id}
            className={`constellation-star s-${(index % 6) + 1}${entry?.wish.id === item.wish.id ? ' selected' : ''}`}
            onClick={() => setSelectedId(item.wish.id)}
            aria-label={item.wish.name}
          >
            <PixelPlanet progress={100} seed={item.wish.seed} size={40} />
          </button>
        ))}
        <span className="dust d1" /><span className="dust d2" /><span className="dust d3" /><span className="dust d4" />
      </section>

      {entry ? (
        <section className="codex-detail">
          <div>
            <span className="pixel-label">ORBIT COMPLETE · {formatDate(entry.date)}</span>
            <h2>{entry.wish.name}</h2>
          </div>
          <dl>
            <div><dt>걸린 날</dt><dd>{entry.days}일</dd></div>
            <div><dt>지킨 날</dt><dd>{entry.keptDays}일</dd></div>
            <div><dt>모은 금액</dt><dd>{money(entry.wish.targetAmount)}원</dd></div>
            <div><dt>얻은 별먼지</dt><dd>{entry.stardust.toLocaleString('ko-KR')}</dd></div>
          </dl>
        </section>
      ) : (
        <section className="codex-detail">
          <div>
            <span className="pixel-label">EMPTY UNIVERSE</span>
            <h2>아직 완주한 별이 없다</h2>
          </div>
        </section>
      )}

      <section className="codex-grid">
        {entries.map((item) => (
          <button
            key={item.wish.id}
            className={`codex-cell${entry?.wish.id === item.wish.id ? ' selected' : ''}`}
            onClick={() => setSelectedId(item.wish.id)}
          >
            <PixelPlanet progress={100} seed={item.wish.seed} size={52} />
            <strong>{item.wish.name}</strong>
            <span>{formatDate(item.date)}</span>
          </button>
        ))}
        {Array.from({ length: empty }, (_, index) => (
          <div key={`empty-${index}`} className="codex-cell locked">
            <span className="cell-silhouette" aria-hidden="true" />
            <strong>???</strong>
            <span>미수집</span>
          </div>
        ))}
      </section>
    </main>
  )
}

function ObserverScreen({ level, totalXp, pendingXp, stats, titles, budget, dark, onThemeChange }: {
  level: ReturnType<typeof levelFromXp>
  totalXp: number
  pendingXp: number
  stats: ReturnType<typeof observerStats>
  titles: ReturnType<typeof earnedTitles>
  budget: BudgetView | null
  dark: boolean
  onThemeChange: (value: boolean) => void
}) {
  const earned = new Set(titles)

  return (
    <main className="observer-screen">
      <header className="screen-head">
        <span className="pixel-label">OBSERVER</span>
        <h1>관측자 Lv.{pad2(level.level)}</h1>
      </header>

      <section className="observer-card">
        <div className="observer-planet">
          <OrbitRing progress={level.ratio * 100} size={150} dots={20} />
          <PixelPlanet progress={Math.min(99, level.level * 14)} seed={7} size={78} float />
        </div>
        <div className="observer-xp">
          <PixelBar ratio={level.ratio} segments={16} />
          <p className="observer-xp-numbers">
            <strong>{level.into.toLocaleString('ko-KR')}</strong>
            <span>/ {level.max ? '—' : level.need.toLocaleString('ko-KR')} STARDUST</span>
          </p>
          <p className="observer-xp-sub">
            누적 {totalXp.toLocaleString('ko-KR')} · 다음 레벨까지 {level.max ? 0 : level.need - level.into}
            {pendingXp > 0 && ` · 미수령 ${pendingXp}`}
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><span className="pixel-label">UNLOCKS</span><h2>궤도 해금</h2></div></div>
        <ul className="unlock-track">
          {UNLOCKS.map((item) => {
            const open = level.level >= item.level
            return (
              <li key={item.level} className={open ? 'open' : 'closed'}>
                <span className="pixel-label">LV. {pad2(item.level)}</span>
                <strong>{item.name}</strong>
                <span>{open ? '해금됨' : item.detail}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="stat-grid">
        <div><span>지킨 날</span><strong>{stats.keptDays}일</strong><small>전체 기록</small></div>
        <div><span>현재 연속</span><strong>{stats.streak}일</strong><small>최장 {stats.bestStreak}일</small></div>
        <div>
          <span>넘긴 예산</span>
          <strong>{stats.carryovers ? `${stats.carryovers}회` : '—'}</strong>
          <small>{stats.carryovers ? `${money(stats.carryoverAmount)}원` : '아직 없음'}</small>
        </div>
        <div>
          <span>누적 저금</span>
          <strong>{money(stats.lifetimeDeposit)}원</strong>
          <small>완주 {stats.completed}개 · 더 기다림 {stats.waits}회</small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><span className="pixel-label">TITLES</span><h2>칭호</h2></div>
          <span className="panel-count">{earned.size} / {TITLES.length}</span>
        </div>
        <div className="badge-grid">
          {TITLES.map((title) => (
            <div key={title.id} className={`badge ${earned.has(title.id) ? 'earned' : 'locked'}`}>
              <span className="badge-icon" aria-hidden="true">{title.icon}</span>
              <strong>{title.name}</strong>
              <span>{title.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><span className="pixel-label">SETTINGS</span><h2>관측소 설정</h2></div></div>
        <div className="setting-list">
          <div className="setting-row">
            <div><strong>화면 테마</strong><span>밝은 우주 / 꿈속의 밤</span></div>
            <div className="theme-choice">
              <button className={!dark ? 'active' : ''} onClick={() => onThemeChange(false)}><Sun size={16} /> 라이트</button>
              <button className={dark ? 'active' : ''} onClick={() => onThemeChange(true)}><Moon size={16} /> 다크</button>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>예산 연결</strong>
              <span>
                {!budget
                  ? '예산 확인 중'
                  : budget.snapshot && !budget.stale
                    ? `남은 자유비용 ${money(budget.snapshot.freeAmount)}원`
                    : budget.snapshot
                      ? `마지막 확인 ${sinceLabel(budget.snapshot.calculatedAt)} · ${money(budget.snapshot.freeAmount)}원`
                      : 'Orbit 예산을 읽지 못했다'}
              </span>
            </div>
            <span className={`connection-state${budget?.snapshot && !budget.stale ? '' : ' off'}`}>
              <i /> {budget?.snapshot && !budget.stale ? '연결됨' : '연결 안 됨'}
            </span>
          </div>
          <div className="setting-row">
            <div><strong>프로토타입</strong></div>
            <span className="version-label">WISH 0.1</span>
          </div>
        </div>
      </section>
    </main>
  )
}
