import { equippedMap } from '@orbit/wish-core/items'
import type { Equipped } from '@orbit/wish-core/types'
import { OrbitRing, PixelPlanet } from './PixelPlanet'

/**
 * 장착 상태를 합친 나의 우주. 배경 + 행성(색·무늬) + 링 + 동료 + 효과를 한 장으로
 * 그린다. 관측소 홈·꾸미기·상점 미리보기가 같은 것을 쓴다 — 상점에서 본 모습과
 * 장착한 뒤 모습이 다르면 안 된다(스펙 §6).
 *
 * 허브·퀘스트·도감의 위시 행성은 그 위시 고유의 모습이라 여기를 거치지 않는다.
 */
export function UniversePreview({ equipped, progress, seed, size = 132, ring, float = false }: {
  equipped: Equipped[]
  /** 그릴 단계. 링·동료·효과는 각각 고리·위성대·성계 단계부터 나온다 */
  progress: number
  seed: number
  size?: number
  /** 궤도 진행률 고리. 값을 주면 행성 둘레에 함께 그린다 */
  ring?: number
  float?: boolean
}) {
  const items = equippedMap(equipped)
  return (
    <div className="universe-preview">
      {ring !== undefined && <OrbitRing progress={ring} size={Math.round(size * 1.92)} dots={20} />}
      <PixelPlanet
        progress={progress}
        seed={seed}
        size={size}
        float={float}
        planetColorId={items.planetColor}
        planetPatternId={items.planetPattern}
        ringId={items.ring}
        backgroundId={items.background}
        companionId={items.companion}
        effectId={items.effect}
      />
    </div>
  )
}
