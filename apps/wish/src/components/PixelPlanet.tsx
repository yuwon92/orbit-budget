import { useMemo } from 'react'
import { stageOf } from '@orbit/wish-core/wish'
import { buildCosmeticBlocks, buildRingBlocks } from '../cosmeticBlocks'
import {
  BACKGROUND_PRESETS,
  COMPANION_PRESETS,
  EFFECT_PRESETS,
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
  /**
   * 장착 아이템 id. 카테고리마다 하나씩 받는다 — 객체 하나로 묶으면 매 렌더마다
   * 새 객체라 useMemo가 항상 다시 돈다. 값을 주지 않으면 그 층은 그리지 않는다.
   */
  planetColorId?: string
  planetPatternId?: string
  ringId?: string
  backgroundId?: string
  companionId?: string
  effectId?: string
}

export function PixelPlanet({
  progress,
  seed,
  size = 160,
  dim = false,
  float = false,
  crop = false,
  planetColorId,
  planetPatternId,
  ringId,
  backgroundId,
  companionId,
  effectId,
}: PixelPlanetProps) {
  const blocks = useMemo(() => {
    const palettePreset = presetById(PALETTE_PRESETS, planetColorId)
    const ringPreset = presetById(RING_PRESETS, ringId)
    const companionPreset = presetById(COMPANION_PRESETS, companionId)
    const backgroundPreset = presetById(BACKGROUND_PRESETS, backgroundId)
    const effectPreset = presetById(EFFECT_PRESETS, effectId)
    const palette = palettePreset?.colors ?? DEFAULT_PLANET_PALETTE
    const stage = stageOf(progress)
    const hasRing = stage === 'ring' || stage === 'satellites' || stage === 'system'
    const hasCompanion = stage === 'satellites' || stage === 'system'
    const completed = stage === 'system'

    const background = backgroundPreset
      ? buildCosmeticBlocks(backgroundPreset, palette, 'background')
      : []
    const planet = buildBlocks(progress, seed, {
      palette,
      patternId: planetPatternId,
      includeLegacyRing: !ringPreset,
      // 고리 프리셋을 쓰면 위성은 고리 뒤로 밀리므로 아래에서 다시 올린다.
      includeLegacySatellites: !ringPreset,
      // 배경 프리셋이 완주 별 자리(모서리)를 쓴다. 둘을 겹치면 별이 배경에 묻히므로
      // 배경이나 효과가 있으면 완주 표시는 효과 아이템에 넘긴다.
      includeLegacyCompletionStars: !backgroundPreset && !effectPreset,
    })
    const ring = ringPreset && hasRing ? buildRingBlocks(ringPreset, palette, planetRadius(progress), 'ring') : []
    const satellites = ringPreset && hasCompanion ? buildSatelliteBlocks(palette) : []
    const companion = companionPreset && hasCompanion
      ? buildCosmeticBlocks(companionPreset, palette, 'companion')
      : []
    const effect = effectPreset && completed
      ? buildCosmeticBlocks(effectPreset, palette, 'effect')
      : []

    return [...background, ...planet, ...ring, ...satellites, ...companion, ...effect]
  }, [backgroundId, companionId, effectId, planetColorId, planetPatternId, progress, ringId, seed])
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
