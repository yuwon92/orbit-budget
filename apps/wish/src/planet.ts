import { rng, stageOf } from '@orbit/wish-core/wish'
import type { PlanetStage } from '@orbit/wish-core/types'

// 4px 격자 위에 사각 블록만 찍는다. 그러데이션 없이 노랑 4단으로 명암을 만든다.
const HIGHLIGHT = '#FFF1AC'
const LIGHT = '#FFD43B'
const MID = '#FFB126'
const DARK = '#EA8A00'
export const GRID = 32

export interface Block { x: number; y: number; w: number; h: number; fill: string; key: string }

const RADIUS: Record<PlanetStage, number> = {
  seed: 0, moon: 4.6, planet: 7.6, ring: 8.4, satellites: 8.4, system: 8.4,
}

export function buildBlocks(progress: number, seed: number): Block[] {
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

  // 표면 무늬. seed가 같으면 항상 같은 자리에 찍힌다.
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
        put(x, y, MID)
      }
    }
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

  if (stage === 'ring' || stage === 'satellites' || stage === 'system') {
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

  if (stage === 'satellites' || stage === 'system') {
    // 위성은 고리 위에 얹는다.
    for (const t of [0.35, 2.5, 4.3]) {
      const point = ringPoint(t)
      put(point.x, point.y, LIGHT)
      put(point.x + 1, point.y, MID)
      put(point.x, point.y + 1, MID)
      put(point.x + 1, point.y + 1, DARK)
    }
  }

  if (stage === 'system') {
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

function toBlocks(cells: Map<string, string>): Block[] {
  return [...cells].map(([key, fill]) => {
    const [x, y] = key.split(':').map(Number)
    return { x, y, w: 1, h: 1, fill, key }
  })
}

