import { GRID, type Block } from './planet'
import type { CosmeticFill, PixelPreset, PlanetPalette, RingPreset } from './cosmetics'

// 고정색은 자기 색이 있는 프리셋만 갖는다. 없는 값을 찍으라고 하면 팔레트 중간톤으로
// 떨어뜨린다 — 색이 undefined로 나가면 그 칸이 검게 찍힌다.
const colorOf = (preset: PixelPreset, palette: PlanetPalette, fill: CosmeticFill) => {
  if (fill === 'accent' || fill === 'soft' || fill === 'ink') return preset[fill] ?? palette.mid
  return palette[fill]
}

/** 프리셋 좌표를 실제 SVG 블록으로 바꾼다. 정의 파일에는 렌더링 로직을 두지 않는다. */
export function buildCosmeticBlocks(preset: PixelPreset, palette: PlanetPalette, layer: string): Block[] {
  const blocks: Block[] = []

  // 연결선을 먼저 깔고 그 위에 별을 올린다.
  for (const [index, line] of (preset.lines ?? []).entries()) {
    const fill = colorOf(preset, palette, line.fill)
    for (const [step, point] of steppedLine(line.x1, line.y1, line.x2, line.y2).entries()) {
      blocks.push({ x: point.x, y: point.y, w: 1, h: 1, fill, key: `${layer}:${preset.id}:line${index}:${step}` })
    }
  }

  for (const [index, pixel] of preset.pixels.entries()) {
    blocks.push({
      x: pixel.x,
      y: pixel.y,
      w: pixel.w ?? 1,
      h: pixel.h ?? 1,
      fill: colorOf(preset, palette, pixel.fill),
      key: `${layer}:${preset.id}:${index}`,
    })
  }

  return blocks
}

/** 대각선을 정수 격자 위 계단으로 만든다. 안티에일리어싱 없이 1px 블록만 남는다. */
function steppedLine(x1: number, y1: number, x2: number, y2: number) {
  const points: { x: number; y: number }[] = []
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))
  for (let step = 0; step <= steps; step += 1) {
    const ratio = steps === 0 ? 0 : step / steps
    points.push({ x: Math.round(x1 + (x2 - x1) * ratio), y: Math.round(y1 + (y2 - y1) * ratio) })
  }
  return points
}

/**
 * 고리 프리셋을 블록으로 바꾼다. 행성 뒤로 도는 절반은 어둡게, 앞을 지나는 구간은
 * 밝게 빼서 몸통에 묻히지 않게 한다. planetRadius는 진행 단계에서 온다.
 */
export function buildRingBlocks(
  preset: RingPreset,
  palette: PlanetPalette,
  planetRadius: number,
  layer: string,
): Block[] {
  const cells = new Map<string, string>()
  const put = (x: number, y: number, fill: string) => {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return
    cells.set(`${x}:${y}`, fill)
  }

  for (const band of preset.bands) {
    const period = band.dash ? band.dash.on + band.dash.off : 0
    for (let t = 0; t < Math.PI * 2; t += 0.02) {
      const degrees = (t * 180) / Math.PI
      const segment = period ? Math.floor(degrees / period) : 0
      if (band.dash && degrees % period > band.dash.on) continue

      const dx = Math.cos(t) * band.rx
      const dy = Math.sin(t) * band.ry
      const x = Math.round(16 + dx * Math.cos(band.tilt) - dy * Math.sin(band.tilt))
      const y = Math.round(16 + dx * Math.sin(band.tilt) + dy * Math.cos(band.tilt))
      const behind = Math.sin(t) < 0
      const inside = Math.hypot(x + 0.5 - 16, y + 0.5 - 16) < planetRadius - 0.5
      if (behind && inside) continue

      const fill = behind ? palette.dark : inside ? palette.highlight : palette.mid
      put(x, y, fill)
      // 파편은 조각마다 한 칸씩 두껍게 해서 덩어리로 읽히게 한다.
      if (band.chunky && segment % 2 === 0 && !inside) put(x, y + 1, behind ? palette.dark : palette.mid)
    }
  }

  return [...cells].map(([key, fill]) => {
    const [x, y] = key.split(':').map(Number)
    return { x, y, w: 1, h: 1, fill, key: `${layer}:${preset.id}:${key}` }
  })
}
