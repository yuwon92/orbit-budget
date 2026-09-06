import { useMemo } from 'react'
import { buildBlocks, GRID } from '../planet'

interface PixelPlanetProps {
  progress: number
  seed: number
  size?: number
  dim?: boolean
  float?: boolean
}

export function PixelPlanet({ progress, seed, size = 160, dim = false, float = false }: PixelPlanetProps) {
  const blocks = useMemo(() => buildBlocks(progress, seed), [progress, seed])
  return (
    <svg
      className={`pixel-planet${float ? ' floating' : ''}${dim ? ' dim' : ''}`}
      width={size}
      height={size}
      viewBox={`0 0 ${GRID} ${GRID}`}
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
