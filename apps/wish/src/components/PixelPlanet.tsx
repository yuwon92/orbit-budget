import { useMemo } from 'react'
import { stageOf } from '@orbit/wish-core/wish'
import { buildCosmeticBlocks, buildRingBlocks } from '../cosmeticBlocks'
import {
  BACKGROUND_PRESETS,
  COMPLETION_EFFECT_PRESETS,
  DECORATION_PRESETS,
  PALETTE_PRESETS,
  RING_PRESETS,
  presetById,
} from '../cosmetics'
import { buildBlocks, buildSatelliteBlocks, DEFAULT_PLANET_PALETTE, GRID, planetRadius } from '../planet'

export interface PixelPlanetProps {
  progress: number
  seed: number
  size?: number
  dim?: boolean
  float?: boolean
  /**
   * 행성 몸통에 맞춰 여백을 잘라낸다. 기본 격자는 고리·위성 자리를 비워 둬서
   * 몸통이 상자의 절반만 채운다 — 로고처럼 작게 놓을 때 옆 아이콘보다 작아 보인다.
   */
  crop?: boolean
  paletteId?: string
  ringId?: string
  decorationId?: string
  backgroundId?: string
  completionEffectId?: string
}

export function PixelPlanet({
  progress,
  seed,
  size = 160,
  dim = false,
  float = false,
  crop = false,
  paletteId,
  ringId,
  decorationId,
  backgroundId,
  completionEffectId,
}: PixelPlanetProps) {
  const blocks = useMemo(() => {
    const palettePreset = presetById(PALETTE_PRESETS, paletteId)
    const ringPreset = presetById(RING_PRESETS, ringId)
    const decorationPreset = presetById(DECORATION_PRESETS, decorationId)
    const backgroundPreset = presetById(BACKGROUND_PRESETS, backgroundId)
    const completionPreset = presetById(COMPLETION_EFFECT_PRESETS, completionEffectId)
    const palette = palettePreset?.colors ?? DEFAULT_PLANET_PALETTE
    const stage = stageOf(progress)
    const hasRing = stage === 'ring' || stage === 'satellites' || stage === 'system'
    const hasDecoration = stage === 'satellites' || stage === 'system'
    const completed = stage === 'system'

    const background = backgroundPreset
      ? buildCosmeticBlocks(backgroundPreset, palette, 'background')
      : []
    const planet = buildBlocks(progress, seed, {
      palette,
      includeLegacyRing: !ringPreset,
      // 고리 프리셋을 쓰면 위성은 고리 뒤로 밀리므로 아래에서 다시 올린다.
      includeLegacySatellites: !ringPreset,
      includeLegacyCompletionStars: !backgroundPreset && !completionPreset,
    })
    const ring = ringPreset && hasRing ? buildRingBlocks(ringPreset, palette, planetRadius(progress), 'ring') : []
    const satellites = ringPreset && hasDecoration ? buildSatelliteBlocks(palette) : []
    const decoration = decorationPreset && hasDecoration
      ? buildCosmeticBlocks(decorationPreset, palette, 'decoration')
      : []
    const completion = completionPreset && completed
      ? buildCosmeticBlocks(completionPreset, palette, 'completion')
      : []

    return [...background, ...planet, ...ring, ...satellites, ...decoration, ...completion]
  }, [backgroundId, completionEffectId, decorationId, paletteId, progress, ringId, seed])
  return (
    <svg
      className={`pixel-planet${float ? ' floating' : ''}${dim ? ' dim' : ''}`}
      width={size}
      height={size}
      viewBox={crop ? '7 7 18 18' : `0 0 ${GRID} ${GRID}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`행성 진행률 ${Math.round(progress)}%`}
    >
      {blocks.map((block) => (
        <rect key={block.key} x={block.x} y={block.y} width={block.w} height={block.h} fill={block.fill} />
      ))}
    </svg>
  )
}

/** 행성을 둘러싼 궤도 진행률. 네모 픽셀이 시계 방향으로 채워진다. */
export function OrbitRing({ progress, size = 260, dots = 28 }: { progress: number; size?: number; dots?: number }) {
  const filled = Math.round((Math.min(100, progress) / 100) * dots)
  const radius = 46
  return (
    <svg className="orbit-ring" width={size} height={size} viewBox="0 0 100 100" shapeRendering="crispEdges" aria-hidden="true">
      {Array.from({ length: dots }, (_, index) => {
        const angle = (index / dots) * Math.PI * 2 - Math.PI / 2
        const x = 50 + Math.cos(angle) * radius
        const y = 50 + Math.sin(angle) * radius
        const on = index < filled
        return (
          <rect
            key={index}
            className={on ? 'orbit-dot on' : 'orbit-dot'}
            x={x - (on ? 2 : 1.2)}
            y={y - (on ? 2 : 1.2)}
            width={on ? 4 : 2.4}
            height={on ? 4 : 2.4}
          />
        )
      })}
    </svg>
  )
}
