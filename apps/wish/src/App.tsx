import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Clock3, Lock, Moon, Orbit, Plus, Sun, WalletCards } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import { OrbitRing, PixelPlanet } from './components/PixelPlanet'
import { PixelBar } from './components/PixelBar'
import { OrbitMap } from './components/OrbitMap'
import { RewardOverlay, type Reward } from './components/RewardOverlay'
import { CollectSheet, WishSheet } from './components/Sheets'
import { BADGES, CODEX_SLOTS, INITIAL_CODEX, INITIAL_WISHES, STATS } from './data'
import {
  UNLOCKS,
  XP,
  buildMissions,
  claimableXp,
  dailyShare,
  levelOf,
  orbitLevelOf,
  pad2,
  progressOf,
  remainingDays,
  SAMPLE_CARRYOVER,
  slotCount,
  stageOf,
  STAGE_NAMES,
  type CodexEntry,
  type LabWish,
  type Mission,
  type MissionState,
} from './game'

type Screen = 'hub' | 'quests' | 'codex' | 'observer'

const NAV: { id: Screen; label: string }[] = [
  { id: 'hub', label: '오르빗' },
  { id: 'quests', label: '퀘스트' },
  { id: 'codex', label: '도감' },
  { id: 'observer', label: '관측자' },
]

const formatDate = (date: string) => date.replaceAll('-', '.')

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
  const [screen, setScreen] = useState<Screen>('hub')
  const [wishes, setWishes] = useState<LabWish[]>(INITIAL_WISHES)
  const [codex, setCodex] = useState<CodexEntry[]>(INITIAL_CODEX)
  const [activeId, setActiveId] = useState<string | null>(INITIAL_WISHES[0]?.id ?? null)
  const [missionState, setMissionState] = useState<Record<string, MissionState>>({})
  const [totalXp, setTotalXp] = useState(STATS.totalXp)
  const [freeAmount, setFreeAmount] = useState(STATS.freeAmount)
  const [vault, setVault] = useState(STATS.vaultAmount)
  const [collecting, setCollecting] = useState<LabWish | null>(null)
  const [adding, setAdding] = useState(false)
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

  const level = levelOf(totalXp)
  const slots = slotCount(level.level, codex.length)
  const missions = useMemo(() => buildMissions(wishes, missionState), [wishes, missionState])
  const pending = claimableXp(missions)
  const active = wishes.find((wish) => wish.id === activeId) ?? wishes[0] ?? null

  const pushReward = useCallback((next: Reward) => setRewards((current) => [...current, next]), [])

  /** XP는 항상 이 함수를 거친다. 레벨 문턱을 넘으면 연출을 대기열에 넣는다. */
  const grantXp = useCallback((amount: number) => {
    setTotalXp((current) => {
      const next = current + amount
      const before = levelOf(current)
      const after = levelOf(next)
      if (after.level > before.level) {
        const unlock = UNLOCKS.find((item) => item.level === after.level)
        pushReward({ kind: 'levelup', from: before.level, to: after.level, title: after.title, unlock: unlock?.name ?? null })
      }
      return next
    })
    setXpPop(amount)
  }, [pushReward])

  function collect(amount: number) {
    if (!collecting) return
    const target = collecting
    const share = dailyShare(target)
    setWishes((current) => current.map((wish) => {
      if (wish.id !== target.id) return wish
      const savedAmount = Math.min(wish.targetAmount, wish.savedAmount + amount)
      return {
        ...wish,
        savedAmount,
        keptDays: wish.keptDays + 1,
        state: savedAmount >= wish.targetAmount ? 'ready' : wish.state,
      }
    }))
    setFreeAmount((current) => Math.max(0, current - amount))
    setVault((current) => current + amount)
    setMissionState((current) => ({ ...current, [`share-${target.id}`]: 'done' }))
    setCollecting(null)
    setToast(amount >= share ? '하루 몫 완료 · 보상 대기' : '부분 납입 기록 · 보상 대기')
  }

  function skipToday() {
    if (!collecting) return
    setMissionState((current) => ({ ...current, [`share-${collecting.id}`]: 'claimed' }))
    setCollecting(null)
    setToast('오늘은 쉬어감. 벌점 없음')
  }

  /** 미션 종류별 수행. 하루 몫만 시트를 열고 나머지는 그 자리에서 완료 처리한다. */
  function runMission(mission: Mission) {
    if (mission.kind === 'share') {
      const wish = wishes.find((item) => item.id === mission.wishId)
      if (wish) setCollecting(wish)
      return
    }
    if (mission.kind === 'carryover') {
      setVault((current) => current + SAMPLE_CARRYOVER)
      setMissionState((current) => ({ ...current, [mission.id]: 'done' }))
      setToast(`남은 예산 ${money(SAMPLE_CARRYOVER)}원 저금 완료`)
      return
    }
    if (mission.kind === 'wait') {
      setMissionState((current) => ({ ...current, [mission.id]: 'done' }))
      setToast('오늘도 기다리기 기록')
    }
  }

  function claimRewards() {
    if (!pending) return
    const claimed: Record<string, MissionState> = {}
    for (const mission of missions) if (mission.state === 'done') claimed[mission.id] = 'claimed'
    setMissionState((current) => ({ ...current, ...claimed }))
    grantXp(pending)
  }

  function completeWish(wish: LabWish) {
    const entry: CodexEntry = {
      id: wish.id,
      name: wish.name,
      amount: wish.targetAmount,
      days: wish.startedDays,
      keptDays: wish.keptDays,
      stardust: wish.keptDays * XP.share + XP.complete,
      date: new Date().toLocaleDateString('sv-SE'),
      seed: wish.seed,
    }
    setWishes((current) => current.filter((item) => item.id !== wish.id))
    setCodex((current) => [entry, ...current])
    pushReward({ kind: 'complete', name: wish.name, seed: wish.seed, stardust: entry.stardust, date: entry.date })
    grantXp(XP.complete)
    setActiveId((current) => (current === wish.id ? null : current))
  }

  function openAdd() {
    if (wishes.length >= slots) {
      setToast(`궤도 슬롯 ${slots}개를 모두 사용 중`)
      return
    }
    setAdding(true)
  }

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
          <li><span className="res-icon" aria-hidden="true">🪙</span><div><strong>{money(freeAmount)}원</strong><span>남은 자유비용</span></div></li>
          <li><span className="res-icon" aria-hidden="true">☄️</span><div><strong>{STATS.streak}일</strong><span>연속 관측</span></div></li>
          <li><span className="res-icon" aria-hidden="true">🫙</span><div><strong>{money(vault)}원</strong><span>저금통 누적</span></div></li>
        </ul>
        {xpPop !== null && <span className="xp-pop">+{xpPop} XP</span>}
      </header>

      <div className="wl-content">
        {screen === 'hub' && (
          <HubScreen
            wishes={wishes}
            active={active}
            missions={missions}
            pending={pending}
            slots={slots}
            level={level.level}
            onSelect={setActiveId}
            onAdd={openAdd}
            onRun={runMission}
            onClaim={claimRewards}
            onOpenQuests={() => setScreen('quests')}
          />
        )}
        {screen === 'quests' && (
          <QuestScreen
            wishes={wishes}
            slots={slots}
            missions={missions}
            onCollect={(wish) => setCollecting(wish)}
            onAdd={openAdd}
            onComplete={completeWish}
            onWait={(wish) => {
              setWishes((current) => current.map((item) => item.id === wish.id ? { ...item, state: 'waiting' } : item))
              setToast('기다리는 중 · 하루마다 +20 XP')
            }}
            onFocus={(wish) => { setActiveId(wish.id); setScreen('hub') }}
          />
        )}
        {screen === 'codex' && <CodexScreen codex={codex} />}
        {screen === 'observer' && (
          <ObserverScreen
            level={level}
            totalXp={totalXp}
            codexCount={codex.length}
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
          dailyShare={dailyShare(collecting)}
          availableAmount={freeAmount}
          onClose={() => setCollecting(null)}
          onCollect={collect}
          onSkip={skipToday}
        />
      )}
      {adding && (
        <WishSheet
          onClose={() => setAdding(false)}
          onCreate={(wish) => {
            setWishes((current) => [...current, wish])
            setActiveId(wish.id)
            setAdding(false)
            setScreen('hub')
            setToast('새 행성이 궤도에 올랐다')
          }}
        />
      )}
      {rewards[0] && <RewardOverlay reward={rewards[0]} onClose={() => setRewards((current) => current.slice(1))} />}
      {toast && <div className="wl-toast"><span aria-hidden="true">⭐</span>{toast}</div>}
    </div>
  )
}

function HubScreen({ wishes, active, missions, pending, slots, level, onSelect, onAdd, onRun, onClaim, onOpenQuests }: {
  wishes: LabWish[]
  active: LabWish | null
  missions: Mission[]
  pending: number
  slots: number
  level: number
  onSelect: (id: string) => void
  onAdd: () => void
  onRun: (mission: Mission) => void
  onClaim: () => void
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
  const days = remainingDays(active.targetDate)
  const share = dailyShare(active)
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
            <span>지킨 날 {active.keptDays}일</span>
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
              <span className="mission-xp">+{mission.xp} XP</span>
              {mission.state === 'todo' ? (
                <button className="mission-go" onClick={() => onRun(mission)}>수행</button>
              ) : (
                <span className="mission-state">{mission.state === 'done' ? '수령 대기' : '완료'}</span>
              )}
            </li>
          ))}
        </ul>

        <button className="claim-button" onClick={onClaim} disabled={!pending}>
          {pending ? `CLAIM +${pending} XP` : '수령할 보상 없음'}
        </button>
        <p className="claim-hint">Lv.{pad2(level)} 관측자 · 궤도 슬롯 {wishes.length} / {slots}</p>
      </section>
    </main>
  )
}

function QuestScreen({ wishes, slots, missions, onCollect, onAdd, onComplete, onWait, onFocus }: {
  wishes: LabWish[]
  slots: number
  missions: Mission[]
  onCollect: (wish: LabWish) => void
  onAdd: () => void
  onComplete: (wish: LabWish) => void
  onWait: (wish: LabWish) => void
  onFocus: (wish: LabWish) => void
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
          const share = dailyShare(wish)
          const days = remainingDays(wish.targetDate)
          const todayDone = missions.find((mission) => mission.id === `share-${wish.id}`)?.state !== 'todo'
          return (
            <li key={wish.id} className={`quest-card state-${wish.state}`}>
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
                  {wish.state === 'ready' ? (
                    <span className="flag ready">목표 도달</span>
                  ) : wish.state === 'waiting' ? (
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
                  {wish.state === 'ready' ? (
                    <>
                      <button className="primary-button" onClick={() => onComplete(wish)}><WalletCards size={17} /> 구매하기</button>
                      <button className="secondary-button" onClick={() => onWait(wish)}><Clock3 size={17} /> 더 기다리기</button>
                    </>
                  ) : wish.state === 'waiting' ? (
                    <button className="primary-button" onClick={() => onComplete(wish)}><WalletCards size={17} /> 이제 구매하기</button>
                  ) : (
                    <>
                      <button className="primary-button" disabled={todayDone} onClick={() => onCollect(wish)}>
                        {todayDone ? '오늘 몫 완료' : '오늘 모으기'}
                      </button>
                      <button className="secondary-button"><Clock3 size={17} /> 연기</button>
                    </>
                  )}
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

function CodexScreen({ codex }: { codex: CodexEntry[] }) {
  const [selected, setSelected] = useState(0)
  const entry = codex[Math.min(selected, Math.max(codex.length - 1, 0))]
  const empty = Math.max(0, CODEX_SLOTS - codex.length)

  return (
    <main className="codex-screen">
      <header className="screen-head">
        <span className="pixel-label">UNIVERSE CODEX</span>
        <h1>우주 도감</h1>
        <p>별 {codex.length} / {CODEX_SLOTS} 수집</p>
      </header>

      <section className="constellation">
        {codex.map((item, index) => (
          <button
            key={item.id}
            className={`constellation-star s-${(index % 6) + 1}${entry?.id === item.id ? ' selected' : ''}`}
            onClick={() => setSelected(index)}
            aria-label={item.name}
          >
            <PixelPlanet progress={100} seed={item.seed} size={40} />
          </button>
        ))}
        <span className="dust d1" /><span className="dust d2" /><span className="dust d3" /><span className="dust d4" />
      </section>

      {entry && (
        <section className="codex-detail">
          <div>
            <span className="pixel-label">ORBIT COMPLETE · {formatDate(entry.date)}</span>
            <h2>{entry.name}</h2>
          </div>
          <dl>
            <div><dt>걸린 날</dt><dd>{entry.days}일</dd></div>
            <div><dt>지킨 날</dt><dd>{entry.keptDays}일</dd></div>
            <div><dt>모은 금액</dt><dd>{money(entry.amount)}원</dd></div>
            <div><dt>얻은 별먼지</dt><dd>{entry.stardust.toLocaleString('ko-KR')}</dd></div>
          </dl>
        </section>
      )}

      <section className="codex-grid">
        {codex.map((item, index) => (
          <button key={item.id} className={`codex-cell${entry?.id === item.id ? ' selected' : ''}`} onClick={() => setSelected(index)}>
            <PixelPlanet progress={100} seed={item.seed} size={52} />
            <strong>{item.name}</strong>
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

function ObserverScreen({ level, totalXp, codexCount, dark, onThemeChange }: {
  level: ReturnType<typeof levelOf>
  totalXp: number
  codexCount: number
  dark: boolean
  onThemeChange: (value: boolean) => void
}) {
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
          <p className="observer-xp-sub">누적 {totalXp.toLocaleString('ko-KR')} · 다음 레벨까지 {level.max ? 0 : level.need - level.into}</p>
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
        <div><span>지킨 날</span><strong>{STATS.keptDays}일</strong><small>전체 기록</small></div>
        <div><span>현재 연속</span><strong>{STATS.streak}일</strong><small>최장 {STATS.bestStreak}일</small></div>
        <div><span>넘긴 예산</span><strong>{STATS.carryovers}회</strong><small>{money(STATS.carryoverAmount)}원</small></div>
        <div><span>완주한 별</span><strong>{codexCount}개</strong><small>더 기다림 {STATS.waits}회</small></div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><span className="pixel-label">TITLES</span><h2>칭호</h2></div><span className="panel-count">{BADGES.filter((badge) => badge.earned).length} / {BADGES.length}</span></div>
        <div className="badge-grid">
          {BADGES.map((badge) => (
            <div key={badge.id} className={`badge ${badge.earned ? 'earned' : 'locked'}`}>
              <span className="badge-icon" aria-hidden="true">{badge.icon}</span>
              <strong>{badge.name}</strong>
              <span>{badge.detail}</span>
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
            <div><strong>Orbit Budget</strong><span>같은 브라우저 연결</span></div>
            <span className="connection-state"><i /> 연결됨</span>
          </div>
          <div className="setting-row">
            <div><strong>프로토타입</strong><span>샘플 데이터 · 새로고침 시 초기화</span></div>
            <span className="version-label">WISH 0.1</span>
          </div>
        </div>
        <a className="orbit-link" href={import.meta.env.DEV ? '/apps/orbit/' : '/orbit/'}><Orbit size={18} /> Orbit Budget 열기</a>
      </section>
    </main>
  )
}
