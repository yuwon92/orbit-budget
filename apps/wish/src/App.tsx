import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Clock3, Lock, Moon, Orbit, Plus, Sun, WalletCards } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import {
  dailyShare,
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
  ensurePlayer,
  claimAll as claimAllWrite,
  claimMission,
  createWish,
  deposit,
  markCelebratedLevel,
  purchaseWish,
  recordWaitDay,
  renameWish,
  skipDay,
} from '@orbit/wish-bridge'
import { OrbitRing, PixelPlanet } from './components/PixelPlanet'
import { PixelBar } from './components/PixelBar'
import { OrbitMap } from './components/OrbitMap'
import { RewardOverlay, type Reward } from './components/RewardOverlay'
import { CollectSheet, WishSheet } from './components/Sheets'
import { buildMissions, type Mission } from './missions'
import { CODEX_SLOTS, STAGE_NAMES, TITLES } from './lib/labels'
import { formatDate, pad2, todayString } from './lib/format'
import { useClaims, usePlayer, useWishEvents, useWishes } from './lib/hooks'
import { loadBudgetView, sinceLabel, type BudgetView } from './lib/budget'
import { SAMPLE_CARRYOVER } from './data'

type Screen = 'hub' | 'quests' | 'codex' | 'observer'

const NAV: { id: Screen; label: string }[] = [
  { id: 'hub', label: '오르빗' },
  { id: 'quests', label: '퀘스트' },
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
  // 어제 남은 예산. Orbit 연동 전까지는 고정 샘플 값
  const carryover = SAMPLE_CARRYOVER
  const [collecting, setCollecting] = useState<Wish | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Wish | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [xpPop, setXpPop] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [dark, setDark] = useState(readTheme)

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
  const doneWishes = useMemo(() => wishes.filter((wish) => wish.status === 'done'), [wishes])
  const totalXp = useMemo(() => totalXpOf(wishes, events, claims), [wishes, events, claims])
  const level = levelFromXp(totalXp)
  const slots = slotCount(level.level, doneWishes.length)
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
    setToast('오늘은 쉬어감. 벌점 없음')
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
      setToast('오늘도 기다리기 기록')
      return
    }
    if (mission.kind === 'carryover') {
      const target = active ?? openWishes[0]
      if (!target) {
        setToast('넣을 궤도가 없다')
        return
      }
      // 금액을 0으로 만들면 미션 줄 자체가 사라진다. 중복 수행은 이벤트 유무로 막는다
      await deposit(target.id, carryover, today, 'carryover')
      refreshBudget()
      setToast(`남은 예산 ${money(carryover)}원 저금 완료`)
    }
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

  async function completeWish(wish: Wish) {
    await purchaseWish(wish.id, today)
    pushReward({
      kind: 'complete',
      name: wish.name,
      seed: wish.seed,
      stardust: keptDays(events, wish.id) * XP.share + XP.complete,
      date: today,
    })
    setActiveId((current) => (current === wish.id ? null : current))
  }

  function openAdd() {
    if (openWishes.length >= slots) {
      setToast(`궤도 슬롯 ${slots}개를 모두 사용 중`)
      return
    }
    setAdding(true)
  }

  // 저장소를 읽는 동안은 화면을 그리지 않는다. 빈 궤도 화면이 한 번 번쩍이는 것을 막는다
  if (!loaded) return <div className="wl-app loading" />

  return (
    <div className={`wl-app screen-${screen}`}>
      <header className="wl-hud">
        <div className="hud-top">
          <button className="hud-avatar" onClick={() => setScreen('observer')} aria-label="관측자 화면">
            <PixelPlanet progress={Math.min(99, level.level * 14)} seed={7} size={36} />
            <span className="pixel-label">LV. {pad2(level.level)}</span>
          </button>
          <div className="hud-xp">
            <PixelBar ratio={level.ratio} segments={14} label={`별먼지 ${level.into} / ${level.need}`} />
            <p><span>{level.into.toLocaleString('ko-KR')} / {level.max ? '—' : level.need.toLocaleString('ko-KR')} STARDUST</span></p>
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
          <li><span className="res-icon" aria-hidden="true">☄️</span><div><strong>{stats.streak}일</strong><span>연속 관측</span></div></li>
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
            events={events}
            today={today}
            slots={slots}
            onCollect={(wish) => setCollecting(wish)}
            onAdd={openAdd}
            onEdit={(wish) => setEditing(wish)}
            onComplete={completeWish}
            onWait={async (wish) => {
              await chooseWait(wish.id, today)
              setToast(`기다리는 중 · 하루마다 +${XP.wait} XP`)
            }}
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
      {adding && (
        <WishSheet
          today={today}
          existingShare={existingShare}
          freeAmount={freeAmount}
          onClose={() => setAdding(false)}
          onCreate={async (input) => {
            setAdding(false)
            const wish = await createWish({ ...input, today })
            setActiveId(wish.id)
            setScreen('hub')
            setToast('새 행성이 궤도에 올랐다')
          }}
        />
      )}
      {editing && (
        <WishSheet
          today={today}
          wish={editing}
          existingShare={existingShare}
          freeAmount={freeAmount}
          onClose={() => setEditing(null)}
          onRename={async (name) => {
            const target = editing
            setEditing(null)
            await renameWish(target.id, name)
            setToast('이름을 바꿨다')
          }}
        />
      )}
      {rewards[0] && <RewardOverlay reward={rewards[0]} onClose={() => setRewards((current) => current.slice(1))} />}
      {toast && <div className="wl-toast"><span aria-hidden="true">⭐</span>{toast}</div>}
    </div>
  )
}

function HubScreen({ wishes, active, events, today, missions, pendingXp, slots, level, onSelect, onAdd, onRun, onClaimOne, onClaimAll, onOpenQuests }: {
  wishes: Wish[]
  active: Wish | null
  events: WishEvent[]
  today: string
  missions: Mission[]
  pendingXp: number
  slots: number
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
          lockedSlots={Math.max(0, 3 - slots)}
          onSelect={onSelect}
          onAdd={onAdd}
        />
        <div className="stage-caption">
          <span className="pixel-label">ORBIT {pad2(orbitLevelOf(progress))} · {STAGE_NAMES[stageOf(progress)]}</span>
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
        <p className="claim-hint">Lv.{pad2(level)} 관측자 · 궤도 슬롯 {wishes.length} / {slots}</p>
      </section>
    </main>
  )
}

function QuestScreen({ wishes, events, today, slots, onCollect, onAdd, onEdit, onComplete, onWait, onFocus }: {
  wishes: Wish[]
  events: WishEvent[]
  today: string
  slots: number
  onCollect: (wish: Wish) => void
  onAdd: () => void
  onEdit: (wish: Wish) => void
  onComplete: (wish: Wish) => void
  onWait: (wish: Wish) => void
  onFocus: (wish: Wish) => void
}) {
  return (
    <main className="quest-screen">
      <header className="screen-head">
        <span className="pixel-label">QUEST LOG</span>
        <h1>진행 중인 궤도</h1>
        <p>{wishes.length} / {slots} 슬롯 사용 중</p>
      </header>

      <ul className="quest-list">
        {wishes.map((wish) => {
          const progress = progressOf(wish)
          const share = dailyShare(wish, events, today)
          const days = remainingDays(wish, today)
          const todayDone = dayStatus(wish, events, today) !== 'none'
          return (
            <li key={wish.id} className={`quest-card state-${wish.status}`}>
              <button className="quest-planet" onClick={() => onFocus(wish)} aria-label={`${wish.name} 허브에서 보기`}>
                <PixelPlanet progress={progress} seed={wish.seed} size={64} />
              </button>
              <div className="quest-body">
                <span className="pixel-label">ORBIT {pad2(orbitLevelOf(progress))}</span>
                <h2>{wish.name}</h2>
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
                  {wish.status === 'ready' ? (
                    <>
                      <button className="primary-button" onClick={() => onComplete(wish)}><WalletCards size={17} /> 구매하기</button>
                      <button className="secondary-button" onClick={() => onWait(wish)}><Clock3 size={17} /> 더 기다리기</button>
                    </>
                  ) : wish.status === 'waiting' ? (
                    <button className="primary-button" onClick={() => onComplete(wish)}><WalletCards size={17} /> 이제 구매하기</button>
                  ) : (
                    <button className="primary-button" disabled={todayDone} onClick={() => onCollect(wish)}>
                      {todayDone ? '오늘 몫 완료' : '오늘 모으기'}
                    </button>
                  )}
                  <button className="secondary-button" onClick={() => onEdit(wish)}>이름 수정</button>
                </div>
              </div>
            </li>
          )
        })}

        {Array.from({ length: Math.max(0, 3 - wishes.length) }, (_, index) => {
          const slotNumber = wishes.length + index + 1
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
  // 두 앱이 같은 저장소를 보는지 눈으로 확인하는 진단값
  const probe = budget?.snapshot?.probe

  return (
    <main className="observer-screen">
      <header className="screen-head">
        <span className="pixel-label">OBSERVER</span>
        <h1>관측자 Lv.{pad2(level.level)}</h1>
        <p>{level.title}</p>
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
              <strong>Orbit Budget</strong>
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
          {probe && (
            <div className="setting-row">
              <div>
                <strong>읽은 내용</strong>
                <span>
                  거래 {probe.transactions}건(이번 달 {probe.monthTransactions}건) · 카테고리 {probe.categories}개
                  (예산 있는 것 {probe.budgetedCategories}개) · 예비비 {probe.hasMonthSettings ? '설정됨' : '없음'} ·
                  예정 수입 {probe.includePlannedIncome ? '포함' : '제외'}
                </span>
              </div>
            </div>
          )}
          <div className="setting-row">
            <div><strong>프로토타입</strong><span>샘플 데이터 · 새로고침 시 초기화</span></div>
            <span className="version-label">WISH 0.1</span>
          </div>
        </div>
        <a className="orbit-link" href={import.meta.env.DEV ? '/apps/orbit/' : '/'}><Orbit size={18} /> Orbit Budget 열기</a>
      </section>
    </main>
  )
}
