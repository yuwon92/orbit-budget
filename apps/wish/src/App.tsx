import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import {
  dailyShare,
  canPurchase,
  keptDays,
  totalDailyShare,
  vaultTotal,
} from '@orbit/wish-core/wish'
import {
  UNLOCKS,
  XP,
  earnedTitles,
  levelFromXp,
  missionUnits,
  observerStats,
  pendingUnits,
  slotCount,
  sumXp,
  totalXp as totalXpOf,
} from '@orbit/wish-core/xp'
import {
  bonusDustGrants,
  missionDustRows,
  stardustBalance,
} from '@orbit/wish-core/dust'
import type { Wish, WishEvent } from '@orbit/wish-core/types'
import {
  chooseWait,
  cancelWish,
  ensurePlayer,
  claimAll as claimAllWrite,
  claimMission,
  createWish,
  deposit,
  grantDust,
  markCelebratedLevel,
  markCelebratedTitles,
  purchaseWish,
  recordWaitDay,
  skipDay,
  updateWish,
} from '@orbit/wish-bridge'
import { createWishPurchaseTransaction } from '@orbit/bridge'
import { PixelPlanet } from './components/PixelPlanet'
import { PixelBar } from './components/PixelBar'
import { RewardOverlay, type Reward } from './components/RewardOverlay'
import { CarryoverSheet, CollectSheet, ResolveWishSheet, WishSheet } from './components/Sheets'
import { HubScreen } from './screens/HubScreen'
import { QuestScreen } from './screens/QuestScreen'
import { CodexScreen } from './screens/CodexScreen'
import { ObservatoryScreen, type ObsSub } from './screens/ObservatoryScreen'
import { buildMissions, type Mission } from './missions'
import { TITLES } from './lib/labels'
import { pad2, todayString } from './lib/format'
import { useClaims, useDustLedger, usePlayer, useWishEvents, useWishes } from './lib/hooks'
import { loadBudgetView, type BudgetView } from './lib/budget'

type Screen = 'hub' | 'quests' | 'codex' | 'observatory'

const NAV: { id: Screen; label: string }[] = [
  { id: 'hub', label: '궤도' },
  { id: 'quests', label: '위시' },
  { id: 'codex', label: '도감' },
  { id: 'observatory', label: '관측소' },
]

// index.html의 첫 페인트 스크립트와 같은 키를 쓴다.
const THEME_KEY = 'wish-theme'
const THEME_COLORS = { light: '#ffffff', dark: '#1a1710' } as const

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
  // 관측소 하위 화면. 탭을 옮기면 반드시 비운다 — 안 그러면 다른 탭에 갔다
  // 돌아왔을 때 하위 화면이 그대로 떠 있다
  const [obsSub, setObsSub] = useState<ObsSub>(null)
  const goScreen = useCallback((next: Screen) => { setObsSub(null); setScreen(next) }, [])

  // 저장소 구독은 여기 한 곳뿐. 화면들은 prop으로 받는다
  const storedWishes = useWishes()
  const storedEvents = useWishEvents()
  const storedClaims = useClaims()
  const storedDust = useDustLedger()
  const player = usePlayer()
  const loaded =
    storedWishes !== undefined && storedEvents !== undefined && storedClaims !== undefined
    && storedDust !== undefined && player !== undefined
  const wishes = useMemo(() => storedWishes ?? [], [storedWishes])
  const events = useMemo(() => storedEvents ?? [], [storedEvents])
  const claims = useMemo(() => storedClaims ?? [], [storedClaims])
  const dustRows = useMemo(() => storedDust ?? [], [storedDust])

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
  const [adding, setAdding] = useState<'orbit' | 'list' | null>(null)
  const [editing, setEditing] = useState<Wish | null>(null)
  const [resolving, setResolving] = useState<Wish | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  // 수령 직후 뜨는 한 줄. XP와 별가루를 따로 띄우지 않고 한 상태로 묶는다
  const [xpPop, setXpPop] = useState<{ xp: number; dust: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [dark, setDark] = useState(readTheme)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light)
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

  // 완주·첫 위시·연속 7일은 수령 버튼이 없어 영수증이 없다. 별가루를 걸 데가
  // 없으므로 화면을 열 때마다 「있어야 할 줄」을 전부 만들어 보내고 저장 단계에서
  // 없는 것만 남긴다. 이름표가 결정적이라 백 번 열어도 지급은 한 번씩이다.
  useEffect(() => {
    if (!loaded) return
    void grantDust(bonusDustGrants(wishes, events, Date.now()))
  }, [loaded, wishes, events])

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
  const orbitWishes = useMemo(() => openWishes.filter((wish) => wish.targetDate), [openWishes])
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
  // 별가루 잔액은 저장하지 않는다. 원장 줄의 합계로 매번 계산한다
  const stardust = useMemo(() => stardustBalance(dustRows), [dustRows])
  const vault = vaultTotal(wishes)
  // 등록할 때 무리한 계획을 경고하는 데 쓴다
  const existingShare = totalDailyShare(openWishes, events, today)
  const active = orbitWishes.find((wish) => wish.id === activeId) ?? orbitWishes[0] ?? null

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
    setXpPop({ xp: unit.xp, dust: stardustBalance(missionDustRows([unit], 0)) })
    await claimMission(unit)
  }

  /** 지금 받을 수 있는 것 전부 수령. 지난 날짜의 미수령분도 함께 들어온다 */
  async function claimAll() {
    if (!pending.length) return
    setXpPop({ xp: pendingXp, dust: stardustBalance(missionDustRows(pending, 0)) })
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
    // 완주 별가루를 여기서 한 번 더 부른다. 구독이 갱신되기를 기다리지 않아야
    // 완주 연출과 잔액이 같은 순간에 맞는다
    void grantDust(bonusDustGrants([...wishes.filter((item) => item.id !== wish.id), { ...wish, status: 'done' }], events, Date.now()))
    setResolving(null)
    pushReward({
      kind: 'complete',
      name: wish.name,
      seed: wish.seed,
      xp: keptDays(events, wish.id) * XP.share + XP.complete,
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
          {/* 연속 일수는 관측소 통계의 「현재 연속」에 그대로 남아 사라지지 않는다 */}
          <li><span className="res-icon" aria-hidden="true">✨</span><div><strong>{money(stardust)}</strong><span>별가루</span></div></li>
          <li><span className="res-icon" aria-hidden="true">🫙</span><div><strong>{money(vault)}원</strong><span>저금통</span></div></li>
        </ul>
        {xpPop !== null && <span className="xp-pop">+{xpPop.xp} XP · +{xpPop.dust} 별가루</span>}
      </header>

      <div className="wl-content">
        {screen === 'hub' && (
          <HubScreen
            wishes={orbitWishes}
            active={active}
            events={events}
            today={today}
            missions={missions}
            pendingXp={pendingXp}
            slots={slots}
            slotsUsed={slotsUsed}
            level={level.level}
            onSelect={setActiveId}
            onAdd={() => setAdding('orbit')}
            onRun={runMission}
            onClaimOne={claimOne}
            onClaimAll={claimAll}
            onOpenQuests={() => goScreen('quests')}
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
            onAddOrbit={() => setAdding('orbit')}
            onAddList={() => setAdding('list')}
            onEdit={(wish) => setEditing(wish)}
            onResolve={setResolving}
            onFocus={(wish) => { setActiveId(wish.id); goScreen('hub') }}
          />
        )}
        {screen === 'codex' && <CodexScreen wishes={doneWishes} events={events} />}
        {screen === 'observatory' && (
          <ObservatoryScreen
            level={level}
            totalXp={totalXp}
            pendingXp={pendingXp}
            stats={stats}
            titles={titles}
            budget={budget}
            dark={dark}
            onThemeChange={setDark}
            sub={obsSub}
            onSub={setObsSub}
          />
        )}
      </div>

      <nav className="wl-nav" aria-label="주요 화면">
        {NAV.map((item) => (
          <button key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => goScreen(item.id)}>
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
          wishes={orbitWishes}
          onClose={() => setCarrying(false)}
          onDeposit={carryOver}
        />
      )}
      {adding && (
        <WishSheet
          today={today}
          creationMode={adding}
          existingShare={existingShare}
          freeAmount={freeAmount}
          canSchedule={canSchedule}
          onClose={() => setAdding(null)}
          onCreate={async (input) => {
            const mode = adding
            setAdding(null)
            const wish = await createWish({ ...input, today })
            if (mode === 'orbit') {
              setActiveId(wish.id)
              goScreen('hub')
              setToast('새 행성이 궤도에 도착')
            } else {
              goScreen('quests')
              setToast('기간 없는 위시에 추가')
            }
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
            if (!target.targetDate && input.targetDate) {
              setActiveId(target.id)
              setToast('위시를 궤도에 올림')
            } else {
              setToast('위시 수정 완료')
            }
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
          transferTargets={orbitWishes.filter((wish) => wish.id !== resolving.id && wish.status === 'active')}
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
