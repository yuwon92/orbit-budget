import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { OrbitRing, PixelPlanet } from './PixelPlanet'
import { progress as progressOf } from '@orbit/wish-core/wish'
import type { Wish } from '@orbit/wish-core/types'

interface OrbitMapProps {
  wishes: Wish[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  slots: number
}

/** 허브 중앙의 행성 맵. 가운데가 지금 보는 위시, 바깥 궤도가 나머지 슬롯. */
export function OrbitMap({ wishes, activeId, onSelect, onAdd, slots }: OrbitMapProps) {
  const active = wishes.find((wish) => wish.id === activeId) ?? wishes[0]
  const others = wishes.filter((wish) => wish.id !== active?.id)
  const satellites: { key: string; node: ReactNode; onClick?: () => void; locked?: boolean }[] = [
    ...others.map((wish) => ({
      key: wish.id,
      onClick: () => onSelect(wish.id),
      node: (
        <>
          <PixelPlanet progress={progressOf(wish)} seed={wish.seed} size={44} />
          <span>{wish.name}</span>
        </>
      ),
    })),
  ]
  if (wishes.length < 3) {
    const locked = wishes.length >= slots
    satellites.push({
      key: 'add',
      onClick: locked ? undefined : onAdd,
      locked,
      node: (
        <>
          <span className="slot-mark">{locked ? <span className="pixel-lock-icon" aria-hidden="true">🔒</span> : <Plus size={18} />}</span>
          <span>{locked ? '잠긴 슬롯' : '빈 궤도'}</span>
        </>
      ),
    })
  }

  return (
    <div className="orbit-map">
      <span className="map-star one" />
      <span className="map-star two" />
      <span className="map-star three" />
      <div className="map-core">
        {active && <OrbitRing progress={progressOf(active)} />}
        {active && <PixelPlanet progress={progressOf(active)} seed={active.seed} size={132} float />}
      </div>
      <div className="map-satellites">
        {satellites.map((item, index) => (
          <button
            key={item.key}
            className={`map-satellite pos-${index + 1}${item.locked ? ' locked' : ''}`}
            onClick={item.onClick}
            disabled={!item.onClick}
          >
            {item.node}
          </button>
        ))}
      </div>
    </div>
  )
}
