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
import { ITEMS, equippedMap, type ItemCategory, type ItemId } from '@orbit/wish-core/items'
import { LEVEL_REWARDS, unclaimedLevels, type BoxType } from '@orbit/wish-core/reward'
import type { Wish, WishEvent } from '@orbit/wish-core/types'
import {
  chooseWait,
  cancelWish,
  ensurePlayer,
  claimAll as claimAllWrite,
  claimMission,
  createWish,
  buyBox,
  buyItem,
  claimLevelReward,
  deposit,
  ensureStarterSet,
  equipItem,
  grantDust,
  markCelebratedLevel,
  markCelebratedTitles,
  openBox,
  purchaseWish,
  recordWaitDay,
  skipDay,
  unequipItem,
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
import { ITEM_LABELS, RARITY_LABELS } from './lib/items'
import { BOX_LABELS, titleOfLevel } from './lib/rewards'
import { wishSkinOf } from './lib/preview'
import { SAMPLE_REWARDS, readDevXp, writeDevXp } from './lib/dev'
import {
  useBoxOpens, useBoxes, useClaims, useDustLedger, useEquipped, useLevelClaims, useOwnedItems,
  usePlayer, useWishEvents, useWishes,
} from './lib/hooks'
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

  // 하위 화면에 들어갈 때 스크롤을 위로 되돌린다. 탭 뷰 전체를 대체하는 전환이라
  // 이전 화면의 스크롤 위치가 남으면 새 화면이 헤더(뒤로가기)가 화면 밖인 상태로 시작한다.
  // 680px 이하에서는 .wl-content가 스크롤 컨테이너이고 그보다 넓으면 문서가 스크롤돼서
  // 둘을 함께 되돌린다.
  //
  // 관측소로 돌아올 때(null)는 되돌리지 않는다 — 진입 행이 화면 아래쪽에 있어서
  // 꾸미기와 상점을 오갈 때마다 다시 내려야 한다.
  useEffect(() => {
    if (obsSub === null) return
    document.querySelector<HTMLElement>('.wl-content')?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [obsSub])

  // 저장소 구독은 여기 한 곳뿐. 화면들은 prop으로 받는다
  const storedWishes = useWishes()
  const storedEvents = useWishEvents()
  const storedClaims = useClaims()
  const storedDust = useDustLedger()
  const storedOwned = useOwnedItems()
  const storedEquipped = useEquipped()
  const storedLevelClaims = useLevelClaims()
  const storedBoxes = useBoxes()
  const storedBoxOpens = useBoxOpens()
  const player = usePlayer()
  const loaded =
    storedWishes !== undefined && storedEvents !== undefined && storedClaims !== undefined
    && storedDust !== undefined && storedOwned !== undefined && storedEquipped !== undefined
    && storedLevelClaims !== undefined && storedBoxes !== undefined && storedBoxOpens !== undefined
    && player !== undefined
  const wishes = useMemo(() => storedWishes ?? [], [storedWishes])
  const events = useMemo(() => storedEvents ?? [], [storedEvents])
  const claims = useMemo(() => storedClaims ?? [], [storedClaims])
  const dustRows = useMemo(() => storedDust ?? [], [storedDust])
  const owned = useMemo(() => storedOwned ?? [], [storedOwned])
  const equipped = useMemo(() => storedEquipped ?? [], [storedEquipped])
  const levelClaims = useMemo(() => storedLevelClaims ?? [], [storedLevelClaims])
  const boxes = useMemo(() => storedBoxes ?? [], [storedBoxes])
  const boxOpens = useMemo(() => storedBoxOpens ?? [], [storedBoxOpens])
  // 위시 행성에 입히는 장착 색·무늬. 궤도·퀘스트·도감·완주 연출이 함께 쓴다
  const skin = useMemo(() => wishSkinOf(equippedMap(equipped)), [equipped])

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
  // 개발용 XP 가산. 프로덕션에서는 0으로 접히고 아래 계산이 그대로 남는다
  const [devXp, setDevXp] = useState(() => (import.meta.env.DEV ? readDevXp() : 0))
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

  // Lv.1 스타터 세트. 이미 보유한 것이 있으면 아무것도 하지 않으므로 몇 번 열어도
  // 지급은 한 번이고, 해제해 둔 자리를 되돌리지도 않는다.
  useEffect(() => {
    if (storedOwned === undefined) return
    void ensureStarterSet()
  }, [storedOwned])

  const handleEquip = useCallback((category: ItemCategory, itemId: ItemId) => {
    void equipItem(category, itemId)
  }, [])
  const handleUnequip = useCallback((category: ItemCategory) => { void unequipItem(category) }, [])

  /**
   * 개발용 별가루. 상점·상자·레벨 보상은 잔액이 있어야 확인되는데 정상 경로로 모으려면
   * 며칠이 걸린다. `import.meta.env.DEV`가 빌드 때 false로 접히면서 이 핸들러를 넘기는
   * 자리와 설정 화면의 버튼이 함께 빠진다.
   *
   * 이름표에 시각을 섞는다 — 지급 함수는 이미 있는 이름표를 건너뛰므로 고정값이면
   * 두 번째 누름부터 아무 일도 일어나지 않는다. 결정적이어야 하는 실제 지급과 달리
   * 이 줄은 「누를 때마다 하나 더」가 목적이다.
   */
  const handleTestDust = useCallback(() => {
    // 가드를 본문 안에 둔다. 넘기는 자리만 접으면 이 본문과 문구가 프로덕션 번들에 남는다
    if (!import.meta.env.DEV) return
    const id = `devtest:${Date.now()}`
    void grantDust([{ id, type: 'earn', amount: 500, sourceType: 'bonus', sourceId: id, createdAt: Date.now() }])
    setToast('개발용 별가루 +500')
  }, [])

  const handleDevXp = useCallback((amount: number) => {
    if (!import.meta.env.DEV) return
    setDevXp((current) => {
      const next = writeDevXp(amount === 0 ? 0 : current + amount)
      setToast(next === 0 ? '개발용 XP 되돌림' : `개발용 XP ${next.toLocaleString('ko-KR')}`)
      return next
    })
  }, [])

  // 실패 사유는 전부 화면이 이미 막고 있는 경우다. 그래도 다른 탭에서 먼저 구매가
  // 일어나면 여기로 온다 — 조용히 넘기지 않고 이유를 띄운다
  const handleBuy = useCallback((itemId: ItemId) => {
    void buyItem(itemId).then((outcome) => {
      if (outcome === 'ok') return setToast('아이템 획득')
      setToast(outcome === 'poor' ? '별가루 부족' : outcome === 'owned' ? '이미 보유 중' : '상점에 없는 아이템')
    })
  }, [])

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
  // 개발용 가산값을 여기서 한 번만 더한다. 레벨·미수령 보상·레벨업 연출이 전부 이
  // 값에서 파생되므로 실제 경로를 그대로 타게 된다
  const totalXp = useMemo(
    () => totalXpOf(wishes, events, claims) + devXp,
    [wishes, events, claims, devXp],
  )
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

  /**
   * 상자 개봉. 추첨과 저장은 쓰기 창구가 트랜잭션 안에서 끝내고, 여기서는 돌려받은
   * 결과를 연출로만 보여 준다(§8 「결과를 먼저 확정하고 연출은 그 뒤」).
   *
   * `already`도 같은 연출을 태운다 — 개봉 도중 앱이 꺼졌다가 다시 눌렀을 때 저장된
   * 결과가 그대로 나오는 경로다. 다시 뽑지 않는다.
   */
  const handleOpenBox = useCallback((boxId: string) => {
    void openBox(boxId).then((outcome) => {
      if (outcome.status === 'missing') return setToast('없는 상자')
      const { open } = outcome
      const itemId = open.itemId as ItemId
      const box = boxes.find((row) => row.boxId === boxId)
      pushReward({
        kind: 'box',
        boxName: box ? BOX_LABELS[box.type] : '상자',
        itemId,
        itemName: ITEM_LABELS[itemId]?.name ?? itemId,
        // 카탈로그에서 빠진 아이템의 지난 기록을 다시 재생할 수 있다. 장착 쪽이
        // defaultItemFor로 대신 그리는 것과 같은 자리다
        rarity: ITEMS[itemId]?.rarity ?? 'common',
        items: equippedMap(equipped),
        duplicate: open.duplicate,
        dust: open.duplicateDust,
      })
    })
  }, [boxes, equipped, pushReward])

  const handleBuyBox = useCallback((type: BoxType) => {
    void buyBox(type).then((outcome) => {
      if (outcome === 'ok') return setToast(`${BOX_LABELS[type]} 1장 획득`)
      setToast(outcome === 'poor' ? '별가루 부족' : outcome === 'limit' ? '이번 주 구매 한도 도달' : '판매하지 않는 상자')
    })
  }, [])

  // 개발용 칭호 연출은 누를 때마다 실제 칭호표 순서로 하나씩 돌려 본다.
  const previewTitleIndex = useRef(0)
  const handlePreviewTitle = useCallback(() => {
    if (!import.meta.env.DEV) return
    const title = TITLES[previewTitleIndex.current % TITLES.length]
    previewTitleIndex.current += 1
    pushReward({ kind: 'title', name: title.name, detail: title.detail, icon: title.icon })
  }, [pushReward])

  // 미수령 레벨 보상. 지난 레벨을 자동 지급하지 않는다 — 고르는 보상이 섞여 있어서
  // 대신 골라 주면 안 된다(§11)
  const unclaimedRewards = useMemo(
    () => unclaimedLevels(level.level, levelClaims.map((row) => row.level)),
    [level.level, levelClaims],
  )

  const handleClaimReward = useCallback((value: number, selectedItemId?: ItemId) => {
    void claimLevelReward(value, selectedItemId).then((outcome) => {
      if (outcome !== 'ok') {
        return setToast(outcome === 'claimed' ? '이미 수령한 레벨' : '보상을 고르지 않음')
      }
      const reward = LEVEL_REWARDS[value]
      pushReward({
        kind: 'levelReward',
        level: value,
        dust: reward?.dust ?? 0,
        itemName: selectedItemId ? ITEM_LABELS[selectedItemId]?.name : undefined,
      })
    })
  }, [pushReward])

  // XP는 파생값이라 레벨업은 "지급"이 아니라 문턱을 넘었는지 감시해서 잡는다.
  // 어디까지 연출을 봤는지는 Player에 남긴다. 안 그러면 새로고침마다 다시 뜬다.
  useEffect(() => {
    if (!loaded || !player || level.level <= player.celebratedLevel) return
    pushReward({
      kind: 'levelup',
      from: player.celebratedLevel,
      to: level.level,
      title: level.title,
      // 해금 문구는 이제 레벨 보상표에서 뽑는다. 두 표가 같은 레벨에 다른 것을
      // 약속하지 않게 UNLOCKS를 없앤 결과다
      unlock: LEVEL_REWARDS[level.level] ? titleOfLevel(level.level) : null,
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
            skin={skin}
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
            skin={skin}
            onCollect={(wish) => setCollecting(wish)}
            onAddOrbit={() => setAdding('orbit')}
            onAddList={() => setAdding('list')}
            onEdit={(wish) => setEditing(wish)}
            onResolve={setResolving}
            onFocus={(wish) => { setActiveId(wish.id); goScreen('hub') }}
          />
        )}
        {screen === 'codex' && <CodexScreen wishes={doneWishes} events={events} skin={skin} />}
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
            owned={owned}
            equipped={equipped}
            onEquip={handleEquip}
            onUnequip={handleUnequip}
            stardust={stardust}
            onBuy={handleBuy}
            boxes={boxes}
            boxOpens={boxOpens}
            onOpenBox={handleOpenBox}
            onBuyBox={handleBuyBox}
            onTestDust={import.meta.env.DEV ? handleTestDust : undefined}
            devXp={import.meta.env.DEV ? devXp : undefined}
            onDevXp={import.meta.env.DEV ? handleDevXp : undefined}
            onPreviewReward={import.meta.env.DEV ? pushReward : undefined}
            onPreviewTitle={import.meta.env.DEV ? handlePreviewTitle : undefined}
            sampleRewards={import.meta.env.DEV ? SAMPLE_REWARDS : undefined}
            unclaimedRewards={unclaimedRewards}
            onClaimReward={handleClaimReward}
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
      {rewards[0] && <RewardOverlay reward={rewards[0]} skin={skin} onClose={() => setRewards((current) => current.slice(1))} />}
      {toast && <div className="wl-toast"><span aria-hidden="true">⭐</span>{toast}</div>}
    </div>
  )
}
