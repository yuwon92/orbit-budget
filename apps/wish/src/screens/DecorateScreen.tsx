import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import {
  CATEGORIES,
  ITEMS,
  ITEM_IDS,
  RARITIES,
  equippedMap,
  isMandatory,
  itemsOfCategory,
  type ItemCategory,
  type ItemId,
} from '@orbit/wish-core/items'
import type { Equipped, OwnedItem } from '@orbit/wish-core/types'
import { ItemSheet } from '../components/Sheets'
import { PixelPlanet } from '../components/PixelPlanet'
import { UniversePreview } from '../components/UniversePreview'
import { CATEGORY_LABELS, ITEM_LABELS, RARITY_DOTS, RARITY_LABELS, SOURCE_LABELS } from '../lib/items'
import { PREVIEW_PROGRESS, PREVIEW_SEED, previewProps } from '../lib/preview'
import { levelOfItem } from '../lib/rewards'

/** 관측소 하위 화면. 탭 뷰 전체를 대체하고 하단 탭은 그대로 둔다 */
export function DecorateScreen({ owned, equipped, stardust, onEquip, onUnequip, onBuy, onShop, back }: {
  owned: OwnedItem[]
  equipped: Equipped[]
  stardust: number
  onEquip: (category: ItemCategory, itemId: ItemId) => void
  onUnequip: (category: ItemCategory) => void
  /** 상점 전용 아이템은 꾸미기에서 연 시트에서 바로 산다. 화면을 옮길 이유가 없다 */
  onBuy: (itemId: ItemId) => void
  onShop: () => void
  back: () => void
}) {
  const [category, setCategory] = useState<ItemCategory>('planetColor')
  // 미보유 아이템을 누르면 여는 시트. 큰 미리보기와 획득 방법이 여기 있다
  const [detail, setDetail] = useState<ItemId | null>(null)
  const items = equippedMap(equipped)
  const ownedIds = new Set(owned.map((item) => item.itemId))
  const current = items[category]
  const sortedItemIds = itemsOfCategory(category).sort((a, b) => {
    const rarity = RARITIES.indexOf(ITEMS[a].rarity) - RARITIES.indexOf(ITEMS[b].rarity)
    return rarity || ITEM_LABELS[a].name.localeCompare(ITEM_LABELS[b].name, 'ko-KR')
  })

  return (
    <main className="obs-sub">
      <header className="screen-head">
        <button className="back-button" onClick={back}><ChevronLeft size={15} /> 관측소</button>
        <span className="pixel-label">DECORATE</span>
        <div className="sub-head-title">
          <h1>꾸미기</h1>
          <button className="sub-head-jump" onClick={onShop} aria-label="상점으로 이동">🛒</button>
        </div>
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
          {current && !isMandatory(category)
            ? <button className="ghost-button" onClick={() => onUnequip(category)}>해제</button>
            : <span className="panel-count">{isMandatory(category) ? '필수 장착' : '장착 없음'}</span>}
        </div>
        <p className="panel-note">{CATEGORY_LABELS[category].detail}</p>

        <div className="item-grid">
          {sortedItemIds.map((itemId) => {
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
                // 보유한 것은 한 번에 갈아 끼운다. 미보유는 시트를 열어 큰 미리보기와
                // 획득 방법을 답한다 — 눌러도 아무 일이 없으면 왜 안 되는지 알 수 없다.
                // 장착한 것을 다시 누르면 해제하되, 필수 자리는 그대로 둔다.
                onClick={() => {
                  if (!isOwned) {
                    setDetail(itemId)
                    return
                  }
                  if (isEquipped) {
                    if (!isMandatory(category)) onUnequip(category)
                    return
                  }
                  onEquip(category, itemId)
                }}
              >
                <span className="item-thumb">
                  <PixelPlanet {...previewProps(items, itemId, 56)} dim={!isOwned} />
                </span>
                <strong>{label.name}</strong>
                <span className="item-rarity">
                  <i style={{ background: RARITY_DOTS[def.rarity] }} aria-hidden="true" />
                  {RARITY_LABELS[def.rarity]}
                </span>
                <small>{isEquipped ? '장착 중' : isOwned ? label.detail : sourceHint(itemId)}</small>
              </button>
            )
          })}
        </div>
      </section>

      {detail !== null && (
        <ItemSheet
          itemId={detail}
          items={items}
          owned={ownedIds.has(detail)}
          stardust={stardust}
          onBuy={onBuy}
          onEquip={onEquip}
          onUnequip={onUnequip}
          onClose={() => setDetail(null)}
        />
      )}
    </main>
  )
}

/**
 * 미보유 칸에 붙는 한 줄. 「어디서 얻는가」를 격자에서 바로 답한다.
 * 상점 전용은 값, 레벨 전용은 레벨. 상자·지역은 아직 획득처 이름만.
 */
function sourceHint(itemId: ItemId): string {
  const def = ITEMS[itemId]
  if (def.source === 'shop') return `상점 ✨ ${(def.price ?? 0).toLocaleString('ko-KR')}`
  const level = levelOfItem(itemId)
  return level !== undefined ? `Lv.${level} 보상` : `${SOURCE_LABELS[def.source]} 전용`
}
