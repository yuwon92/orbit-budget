// Wish 게임 규칙. 순수 함수만. 화면·저장소 접근 금지.
// 수치는 orbit-wish-spec.md의 XP·레벨 곡선을 그대로 따른다.

export type WishState = 'active' | 'ready' | 'waiting'
export type MissionState = 'todo' | 'done' | 'claimed'
export type MissionKind = 'share' | 'carryover' | 'wait' | 'log'
export type PlanetStage = 'seed' | 'moon' | 'planet' | 'ring' | 'satellites' | 'system'

export interface LabWish {
  id: string
  name: string
  targetAmount: number
  savedAmount: number
  targetDate: string | null
  state: WishState
  seed: number
  startedDays: number
  keptDays: number
}

export interface Mission {
  id: string
  kind: MissionKind
  title: string
  detail: string
  xp: number
  state: MissionState
  wishId?: string
  /** 위시에 걸린 미션이면 대상 이름을 따로 넘겨 화면에서 강조한다. */
  wishName?: string
}

export interface CodexEntry {
  id: string
  name: string
  amount: number
  days: number
  keptDays: number
  stardust: number
  date: string
  seed: number
}

/** 누적 XP 기준 레벨 문턱. Lv1부터 Lv8까지. */
export const LEVEL_STEPS = [0, 100, 300, 700, 1400, 2500, 4000, 6000]

export const LEVEL_TITLES = [
  'STARGAZER', 'DRIFTER', 'EXPLORER', 'NAVIGATOR',
  'VOYAGER', 'ASTRONOMER', 'CONSTELLATOR', 'COSMOGRAPHER',
]

/** 레벨별 해금. 슬롯은 레벨 또는 완주 횟수 중 먼저 도달한 쪽으로 열린다. */
export const UNLOCKS = [
  { level: 2, name: '위시 슬롯 2', detail: '또는 완주 1개' },
  { level: 3, name: '행성 색 선택', detail: '궤도 팔레트 개방' },
  { level: 4, name: '위시 슬롯 3', detail: '또는 완주 3개' },
  { level: 5, name: '행성 링 패턴', detail: '궤도 장식' },
  { level: 6, name: '성계 배경', detail: '도감 테마' },
  { level: 7, name: '목표 이미지', detail: '위시에 사진 첨부' },
  { level: 8, name: '행성 커스터마이즈', detail: '픽셀 직접 편집' },
]

export const XP = {
  share: 10,
  partial: 5,
  carryover: 30,
  wait: 20,
  log: 5,
  complete: 100,
  streak7: 30,
}

export interface LevelInfo {
  level: number
  title: string
  into: number
  need: number
  ratio: number
  max: boolean
}

export function levelOf(totalXp: number): LevelInfo {
  let index = 0
  while (index + 1 < LEVEL_STEPS.length && totalXp >= LEVEL_STEPS[index + 1]) index += 1
  const base = LEVEL_STEPS[index]
  const next = LEVEL_STEPS[index + 1]
  const max = next === undefined
  const into = totalXp - base
  const need = max ? into : next - base
  return {
    level: index + 1,
    title: LEVEL_TITLES[index],
    into,
    need,
    ratio: max ? 1 : Math.min(1, into / need),
    max,
  }
}

/** 잠금 해제된 위시 슬롯 수. 최대 3개 동시 진행. */
export function slotCount(level: number, completed: number) {
  if (level >= 4 || completed >= 3) return 3
  if (level >= 2 || completed >= 1) return 2
  return 1
}

export const progressOf = (wish: LabWish) =>
  Math.min(100, Math.round((wish.savedAmount / wish.targetAmount) * 100))

/** 진행률에 따른 행성 성장 단계. 티끌에서 성계까지. */
export function stageOf(progress: number): PlanetStage {
  if (progress >= 100) return 'system'
  if (progress >= 80) return 'satellites'
  if (progress >= 60) return 'ring'
  if (progress >= 35) return 'planet'
  if (progress >= 15) return 'moon'
  return 'seed'
}

export const STAGE_NAMES: Record<PlanetStage, string> = {
  seed: '티끌', moon: '위성', planet: '행성', ring: '고리', satellites: '위성대', system: '성계',
}

/** 위시 하나의 궤도 단계. 화면에는 ORBIT 04처럼 두 자리로 쓴다. */
export const orbitLevelOf = (progress: number) => Math.min(5, Math.floor(progress / 20) + 1)

export const pad2 = (value: number) => String(value).padStart(2, '0')

export function remainingDays(targetDate: string | null) {
  if (!targetDate) return null
  const end = new Date(`${targetDate}T00:00:00`).getTime()
  const start = new Date(new Date().toLocaleDateString('sv-SE') + 'T00:00:00').getTime()
  return Math.max(1, Math.ceil((end - start) / 86_400_000) + 1)
}

/** 하루 몫 = 남은 금액 / 남은 일수 (내림). 대기 중이거나 기간이 없으면 0. */
export function dailyShare(wish: LabWish) {
  if (wish.state !== 'active') return 0
  const days = remainingDays(wish.targetDate)
  if (!days) return 0
  return Math.floor(Math.max(0, wish.targetAmount - wish.savedAmount) / days)
}

/** 남은 예산 넘기기 미션의 샘플 금액. 실제 연동 전까지 고정값. */
export const SAMPLE_CARRYOVER = 12_400

/** 오늘의 미션. 제목은 행동만, 설명줄에 대상과 맥락. */
export function buildMissions(wishes: LabWish[], done: Record<string, MissionState>): Mission[] {
  const list: Mission[] = []
  for (const wish of wishes) {
    if (wish.state === 'active') {
      const share = dailyShare(wish)
      const days = remainingDays(wish.targetDate)
      list.push({
        id: `share-${wish.id}`,
        kind: 'share',
        title: share ? `${share.toLocaleString('ko-KR')}원 모으기` : '저금하기',
        detail: days ? `${days}일 남음` : '기간 없음',
        xp: XP.share,
        state: 'todo',
        wishId: wish.id,
        wishName: wish.name,
      })
    }
    if (wish.state === 'waiting') {
      list.push({
        id: `wait-${wish.id}`,
        kind: 'wait',
        title: '하루 더 기다리기',
        detail: '목표 달성',
        xp: XP.wait,
        state: 'todo',
        wishId: wish.id,
        wishName: wish.name,
      })
    }
  }
  list.push({
    id: 'carryover',
    kind: 'carryover',
    title: `${SAMPLE_CARRYOVER.toLocaleString('ko-KR')}원 저금하기`,
    detail: '어제 남은 예산',
    xp: XP.carryover,
    state: 'todo',
  })
  list.push({
    id: 'log',
    kind: 'log',
    title: '진행 확인',
    detail: '오늘 앱 열기',
    xp: XP.log,
    state: 'done',
  })
  return list.map((mission) => ({ ...mission, state: done[mission.id] ?? mission.state }))
}

export const claimableXp = (missions: Mission[]) =>
  missions.filter((mission) => mission.state === 'done').reduce((sum, mission) => sum + mission.xp, 0)

/** 결정적 의사난수. 위시 seed로 같은 행성 무늬를 항상 다시 그린다. */
export function rng(seed: number) {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}
