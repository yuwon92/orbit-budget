import { rng, stageOf } from '@orbit/wish-core/wish'
import type { PlanetStage } from '@orbit/wish-core/types'
import type { PlanetPalette } from './cosmetics'

// 4px 격자 위에 사각 블록만 찍는다. 그러데이션 없이 노랑 4단으로 명암을 만든다.
export const DEFAULT_PLANET_PALETTE: PlanetPalette = {
  highlight: '#FFF1AC', light: '#FFD43B', mid: '#FFB126', dark: '#EA8A00',
}
export const GRID = 32

export interface Block { x: number; y: number; w: number; h: number; fill: string; key: string }

const RADIUS: Record<PlanetStage, number> = {
  seed: 0, moon: 4.6, planet: 7.6, ring: 8.4, satellites: 8.4, system: 8.4,
}

/** 진행 단계별 행성 반지름. 고리 프리셋이 앞뒤를 가르는 기준으로 쓴다. */
export function planetRadius(progress: number): number {
  return RADIUS[stageOf(progress)]
}

/** 행성 무늬. 몸통 명암·반지름을 함께 봐야 해서 좌표표가 아니라 여기서 그린다 */
export const PATTERN_IDS = [
  'planet-pattern-crater',
  'planet-pattern-stripe',
  'planet-pattern-crystal',
  'planet-pattern-swirl',
] as const
export type PatternId = (typeof PATTERN_IDS)[number]

export interface PlanetBuildOptions {
  palette?: PlanetPalette
  /** 카탈로그에 없는 값이면 크레이터로 그린다 — 기본 무늬가 카탈로그의 기본값이다 */
  patternId?: string
  includeLegacyRing?: boolean
  includeLegacySatellites?: boolean
  includeLegacyCompletionStars?: boolean
}

const ringPoint = (t: number) => {
  const dx = Math.cos(t) * 13
  const dy = Math.sin(t) * 4.4
  const tilt = -0.2
  return {
    x: Math.round(16 + dx * Math.cos(tilt) - dy * Math.sin(tilt)),
    y: Math.round(16 + dx * Math.sin(tilt) + dy * Math.cos(tilt)),
  }
}

/** 위성 3개는 고리 위에 얹는다. 고리 프리셋을 쓸 때도 같은 자리에 다시 그린다. */
function putSatellites(put: (x: number, y: number, fill: string) => void, palette: PlanetPalette) {
  for (const t of [0.35, 2.5, 4.3]) {
    const point = ringPoint(t)
    put(point.x, point.y, palette.light)
    put(point.x + 1, point.y, palette.mid)
    put(point.x, point.y + 1, palette.mid)
    put(point.x + 1, point.y + 1, palette.dark)
  }
}

/**
 * 위성만 따로 뽑는다. 고리 프리셋은 buildBlocks 뒤에 그려서 기존 위성을 덮어 버리므로
 * 위성대·성계 단계 표시가 사라지지 않게 고리 위 레이어로 다시 올린다.
 */
export function buildSatelliteBlocks(palette: PlanetPalette = DEFAULT_PLANET_PALETTE): Block[] {
  const cells = new Map<string, string>()
  putSatellites((x, y, fill) => {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return
    cells.set(`${x}:${y}`, fill)
  }, palette)
  return [...cells].map(([key, fill]) => {
    const [x, y] = key.split(':').map(Number)
    return { x, y, w: 1, h: 1, fill, key: `satellite:${key}` }
  })
}

export function buildBlocks(progress: number, seed: number, options: PlanetBuildOptions = {}): Block[] {
  const { highlight: HIGHLIGHT, light: LIGHT, mid: MID, dark: DARK } = options.palette ?? DEFAULT_PLANET_PALETTE
  const includeLegacyRing = options.includeLegacyRing ?? true
  const includeLegacySatellites = options.includeLegacySatellites ?? true
  const includeLegacyCompletionStars = options.includeLegacyCompletionStars ?? true
  const stage = stageOf(progress)
  const random = rng(seed * 977 + 13)
  const cells = new Map<string, string>()
  const put = (x: number, y: number, fill: string) => {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return
    cells.set(`${x}:${y}`, fill)
  }

  if (stage === 'seed') {
    // 티끌 단계. 아직 뭉치지 않은 먼지 블록만 흩어 둔다.
    const count = 7 + Math.round(progress / 3)
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2
      const distance = 2 + random() * 6
      const x = Math.round(16 + Math.cos(angle) * distance)
      const y = Math.round(16 + Math.sin(angle) * distance)
      const fill = random() > 0.66 ? MID : random() > 0.4 ? LIGHT : HIGHLIGHT
      put(x, y, fill)
      put(x + 1, y, fill)
      put(x, y + 1, fill)
      put(x + 1, y + 1, fill)
    }
    return toBlocks(cells)
  }

  const radius = RADIUS[stage]
  const lightX = 16 - radius * 0.38
  const lightY = 16 - radius * 0.38

  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const dx = x + 0.5 - 16
      const dy = y + 0.5 - 16
      if (Math.hypot(dx, dy) > radius) continue
      const lit = Math.hypot(x + 0.5 - lightX, y + 0.5 - lightY) / radius
      const fill = lit < 0.42 ? HIGHLIGHT : lit < 0.86 ? LIGHT : lit < 1.24 ? MID : DARK
      put(x, y, fill)
    }
  }

  // 몸통 위 한 칸을 한 단 어둡게 한다. 무늬가 명암을 지우지 않고 얹히게 하는 유일한
  // 방법이다 — 고정 색으로 칠하면 구면이 평평해진다.
  const shade = (x: number, y: number) => {
    const current = cells.get(`${x}:${y}`)
    const next = current === HIGHLIGHT ? LIGHT : current === LIGHT ? MID : current === MID ? DARK : undefined
    if (next) cells.set(`${x}:${y}`, next)
  }

  // 표면 무늬. seed가 같으면 항상 같은 자리에 찍힌다.
  putPattern(options.patternId, put, shade, {
    radius, stage, random, highlight: HIGHLIGHT, mid: MID, dark: DARK,
  })

  if (includeLegacyRing && (stage === 'ring' || stage === 'satellites' || stage === 'system')) {
    // 고리는 각도를 촘촘히 훑어 그린다. 행성 뒤로 도는 절반은 가려서 깊이를 만든다.
    for (let t = 0; t < Math.PI * 2; t += 0.02) {
      const point = ringPoint(t)
      const behind = Math.sin(t) < 0
      const inside = Math.hypot(point.x + 0.5 - 16, point.y + 0.5 - 16) < radius - 0.5
      if (behind && inside) continue
      // 행성 앞을 지나는 구간은 밝게 빼서 고리가 몸통에 묻히지 않게 한다.
      put(point.x, point.y, behind ? DARK : inside ? HIGHLIGHT : MID)
    }
  }

  if (includeLegacySatellites && (stage === 'satellites' || stage === 'system')) {
    putSatellites(put, options.palette ?? DEFAULT_PLANET_PALETTE)
  }

  if (includeLegacyCompletionStars && stage === 'system') {
    // 완주한 행성 주변에 픽셀 별을 띄운다.
    const stars = [[6, 4], [26, 4], [4, 27], [29, 20]]
    for (const [sx, sy] of stars) {
      put(sx, sy, LIGHT)
      put(sx - 1, sy, HIGHLIGHT)
      put(sx + 1, sy, HIGHLIGHT)
      put(sx, sy - 1, HIGHLIGHT)
      put(sx, sy + 1, HIGHLIGHT)
    }
  }

  return toBlocks(cells)
}

interface PatternContext {
  radius: number
  stage: PlanetStage
  /** buildBlocks의 난수열을 이어 쓴다. 같은 씨앗이면 무늬 자리가 항상 같다 */
  random: () => number
  highlight: string
  mid: string
  dark: string
}

/**
 * 무늬는 몸통 위에만 얹는다. 가장자리 한 칸(`radius - 0.6`)은 어느 무늬도 건드리지
 * 않는다 — 실루엣이 갉히면 32px에서 행성이 찌그러져 보인다.
 */
function putPattern(
  patternId: string | undefined,
  put: (x: number, y: number, fill: string) => void,
  shade: (x: number, y: number) => void,
  context: PatternContext,
) {
  if (patternId === 'planet-pattern-stripe') return putStripes(shade, context)
  if (patternId === 'planet-pattern-crystal') return putCrystals(put, context)
  if (patternId === 'planet-pattern-swirl') return putSwirl(shade, context)
  return putCraters(put, context)
}

function putCraters(put: (x: number, y: number, fill: string) => void, context: PatternContext) {
  const { radius, stage, random, mid } = context
  const craters = stage === 'moon' ? 2 : 4
  for (let i = 0; i < craters; i += 1) {
    const angle = random() * Math.PI * 2
    const distance = random() * radius * 0.62
    const cx = Math.round(16 + Math.cos(angle) * distance)
    const cy = Math.round(16 + Math.sin(angle) * distance)
    const size = 1 + Math.round(random() * 1.6)
    for (let y = cy; y < cy + size; y += 1) {
      for (let x = cx; x < cx + size; x += 1) {
        if (Math.hypot(x + 0.5 - 16, y + 0.5 - 16) > radius - 0.6) continue
        put(x, y, mid)
      }
    }
  }
}

/**
 * 위도 줄무늬. 아래에 있는 색을 한 단 어둡게 하는 방식이라 몸통 명암이 그대로 남는다.
 *
 * 씨앗을 쓰지 않는다 — 줄 간격이 위시마다 달라지면 같은 아이템으로 보이지 않는다.
 * 가운데 줄은 항상 적도를 지난다.
 */
function putStripes(shade: (x: number, y: number) => void, context: PatternContext) {
  const { radius } = context
  const gap = radius < 6 ? 3 : 4
  for (let y = 0; y < GRID; y += 1) {
    // 적도(y = 16)에서 gap 칸마다 한 줄. 중심에서의 거리로 재면 반 칸씩 어긋난
    // 두 줄이 같은 띠에 함께 들어와 줄이 두 겹이 된다
    if ((y - 16) % gap !== 0) continue
    const dy = y + 0.5 - 16
    for (let x = 0; x < GRID; x += 1) {
      const dx = x + 0.5 - 16
      if (Math.hypot(dx, dy) > radius - 0.6) continue
      shade(x, y)
    }
  }
}

/**
 * 소용돌이. 중심에서 두 바퀴 도는 나선을 한 단씩 어둡게 한다. 줄무늬처럼 아래 색을
 * 낮추는 방식이라 구면 명암이 남는다.
 *
 * 씨앗을 쓰지 않는다 — 감는 방향이 위시마다 달라지면 같은 아이템으로 보이지 않는다.
 * y를 0.85로 눌러 정면에서 본 원반처럼 기울인다.
 */
function putSwirl(shade: (x: number, y: number) => void, context: PatternContext) {
  const { radius } = context
  const turns = radius < 6 ? 1.5 : 2
  const span = Math.PI * 2 * turns
  for (let t = 0.6; t < span; t += 0.04) {
    const reach = (t / span) * (radius - 1.2)
    shade(Math.round(16 + Math.cos(t) * reach), Math.round(16 + Math.sin(t) * reach * 0.85))
  }
}

/** 결정. 중심에서 벗어난 마름모 셋. 안쪽은 MID, 테두리 한 칸은 DARK로 각을 세운다. */
function putCrystals(put: (x: number, y: number, fill: string) => void, context: PatternContext) {
  const { radius, stage, random, highlight, mid, dark } = context
  const facets = stage === 'moon' ? 2 : 3
  for (let i = 0; i < facets; i += 1) {
    const angle = random() * Math.PI * 2
    const distance = random() * radius * 0.45
    const cx = 16 + Math.cos(angle) * distance
    const cy = 16 + Math.sin(angle) * distance
    const size = Math.max(1.6, radius * 0.4)
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        if (Math.hypot(x + 0.5 - 16, y + 0.5 - 16) > radius - 0.6) continue
        const reach = Math.abs(x + 0.5 - cx) + Math.abs(y + 0.5 - cy)
        if (reach > size) continue
        put(x, y, reach > size - 1 ? dark : i === 0 ? highlight : mid)
      }
    }
  }
}

function toBlocks(cells: Map<string, string>): Block[] {
  return [...cells].map(([key, fill]) => {
    const [x, y] = key.split(':').map(Number)
    return { x, y, w: 1, h: 1, fill, key }
  })
}

