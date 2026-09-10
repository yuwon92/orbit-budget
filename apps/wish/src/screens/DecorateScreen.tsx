import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import {
  CATEGORIES,
  ITEMS,
  ITEM_IDS,
  equippedMap,
  itemsOfCategory,
  type ItemCategory,
  type ItemId,
} from '@orbit/wish-core/items'
import type { Equipped, OwnedItem } from '@orbit/wish-core/types'
import { PixelPlanet } from '../components/PixelPlanet'
import { UniversePreview } from '../components/UniversePreview'
import { CATEGORY_LABELS, ITEM_LABELS, RARITY_DOTS, RARITY_LABELS, SOURCE_LABELS } from '../lib/items'

/** 미리보기는 성계 단계로 고정한다. 링·동료·효과가 각각 다른 단계부터 나와서
 *  진행 중 단계로 그리면 장착해도 아무 변화가 없는 칸이 생긴다. */
const PREVIEW_PROGRESS = 100
const PREVIEW_SEED = 7

/** 관측소 하위 화면. 탭 뷰 전체를 대체하고 하단 탭은 그대로 둔다 */
export function DecorateScreen({ owned, equipped, onEquip, onUnequip, back }: {
  owned: OwnedItem[]
  equipped: Equipped[]
  onEquip: (category: ItemCategory, itemId: ItemId) => void
  onUnequip: (category: ItemCategory) => void
  back: () => void
}) {
  const [category, setCategory] = useState<ItemCategory>('planetColor')
  const items = equippedMap(equipped)
  const ownedIds = new Set(owned.map((item) => item.itemId))
  const current = items[category]

  return (
    <main className="obs-sub">
      <header className="screen-head">
        <button className="back-button" onClick={back}><ChevronLeft size={15} /> 관측소</button>
        <span className="pixel-label">DECORATE</span>
        <h1>꾸미기</h1>
      </header>

      <div className="decorate-stage">
        <UniversePreview equipped={equipped} progress={PREVIEW_PROGRESS} seed={PREVIEW_SEED} size={136} float />
        <p className="decorate-stage-note">성계 기준 미리보기 · 보유 {ownedIds.size} / {ITEM_IDS.length}</p>
      </div>

      <div className="category-tabs" role="tablist" aria-label="꾸미기 분류">
        {CATEGORIES.map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={category === value}
            className={category === value ? 'active' : ''}
            onClick={() => setCategory(value)}
          >
            {CATEGORY_LABELS[value].name}
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="pixel-label">{category.toUpperCase()}</span>
            <h2>{CATEGORY_LABELS[category].name}</h2>
          </div>
          {current
            ? <button className="ghost-button" onClick={() => onUnequip(category)}>해제</button>
            : <span className="panel-count">장착 없음</span>}
        </div>
        <p className="panel-note">{CATEGORY_LABELS[category].detail}</p>

        <div className="item-grid">
          {itemsOfCategory(category).map((itemId) => {
            const def = ITEMS[itemId]
            const label = ITEM_LABELS[itemId]
            const isOwned = ownedIds.has(itemId)
            const isEquipped = current === itemId
            return (
              <button
                key={itemId}
                type="button"
                className={`item-cell${isEquipped ? ' equipped' : ''}${isOwned ? '' : ' locked'}`}
                aria-pressed={isEquipped}
                disabled={!isOwned}
                // 장착한 것을 다시 누르면 해제한다. 위쪽 해제 버튼까지 올라가지 않아도
                // 되고, 같은 자리에서 켰다 껐다 비교할 수 있다
                onClick={() => (isEquipped ? onUnequip(category) : onEquip(category, itemId))}
              >
                <span className="item-thumb">
                  <PixelPlanet
                    progress={PREVIEW_PROGRESS}
                    seed={PREVIEW_SEED}
                    size={56}
                    dim={!isOwned}
                    planetColorId={category === 'planetColor' ? itemId : items.planetColor}
                    planetPatternId={category === 'planetPattern' ? itemId : items.planetPattern}
                    ringId={category === 'ring' ? itemId : items.ring}
                    backgroundId={category === 'background' ? itemId : items.background}
                    companionId={category === 'companion' ? itemId : items.companion}
                    effectId={category === 'effect' ? itemId : items.effect}
                  />
                </span>
                <strong>{label.name}</strong>
                <span className="item-rarity">
                  <i style={{ background: RARITY_DOTS[def.rarity] }} aria-hidden="true" />
                  {RARITY_LABELS[def.rarity]}
                </span>
                <small>{isEquipped ? '장착 중 · 다시 눌러 해제' : isOwned ? label.detail : `${SOURCE_LABELS[def.source]} 전용`}</small>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}
