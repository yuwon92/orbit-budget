import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import { CATEGORIES, ITEMS, equippedMap, type ItemCategory, type ItemId } from '@orbit/wish-core/items'
import { shopItems } from '@orbit/wish-core/shop'
import type { Equipped, OwnedItem } from '@orbit/wish-core/types'
import { PixelPlanet } from '../components/PixelPlanet'
import { PurchaseSheet } from '../components/Sheets'
import { CATEGORY_LABELS, ITEM_LABELS, RARITY_DOTS, RARITY_LABELS } from '../lib/items'

/** 상점 미리보기도 꾸미기와 같은 성계 기준이다. 단계가 다르면 같은 아이템이 달라 보인다 */
const PREVIEW_PROGRESS = 100
const PREVIEW_SEED = 7

type Filter = ItemCategory | 'all'

/** 관측소 하위 화면. 탭 뷰 전체를 대체하고 하단 탭은 그대로 둔다 */
export function ShopScreen({ owned, equipped, stardust, onBuy, back }: {
  owned: OwnedItem[]
  equipped: Equipped[]
  stardust: number
  onBuy: (itemId: ItemId) => void
  back: () => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [confirming, setConfirming] = useState<ItemId | null>(null)
  const items = equippedMap(equipped)
  const entries = shopItems(owned.map((item) => item.itemId))
  const shown = filter === 'all' ? entries : entries.filter((entry) => ITEMS[entry.itemId].category === filter)

  /** 그 아이템까지 얹은 미리보기. 장착 상태를 바탕으로 해당 칸만 갈아 끼운다 */
  const planetProps = (itemId: ItemId, size: number) => {
    const category = ITEMS[itemId].category
    return {
      progress: PREVIEW_PROGRESS,
      seed: PREVIEW_SEED,
      size,
      planetColorId: category === 'planetColor' ? itemId : items.planetColor,
      planetPatternId: category === 'planetPattern' ? itemId : items.planetPattern,
      ringId: category === 'ring' ? itemId : items.ring,
      backgroundId: category === 'background' ? itemId : items.background,
      companionId: category === 'companion' ? itemId : items.companion,
      effectId: category === 'effect' ? itemId : items.effect,
    }
  }

  return (
    <main className="obs-sub">
      <header className="screen-head">
        <button className="back-button" onClick={back}><ChevronLeft size={15} /> 관측소</button>
        <span className="pixel-label">SHOP</span>
        <h1>상점</h1>
      </header>

      <p className="shop-balance">
        <span className="res-icon" aria-hidden="true">✨</span>
        <strong>{money(stardust)}</strong>
        <span>보유 별가루</span>
      </p>

      <div className="category-tabs" role="tablist" aria-label="상품 분류">
        <button
          role="tab"
          aria-selected={filter === 'all'}
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          전체
        </button>
        {CATEGORIES.map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            className={filter === value ? 'active' : ''}
            onClick={() => setFilter(value)}
          >
            {CATEGORY_LABELS[value].name}
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="panel-head">
          <div><span className="pixel-label">FOR SALE</span><h2>판매 중</h2></div>
          <span className="panel-count">{shown.length}종</span>
        </div>
        <p className="panel-note">상자·레벨 전용 아이템은 상점에 없음 · 전체 목록은 꾸미기</p>

        {shown.length === 0
          ? <p className="shop-empty">이 분류에 판매 상품 없음</p>
          : (
            <div className="item-grid">
              {shown.map((entry) => {
                const def = ITEMS[entry.itemId]
                const label = ITEM_LABELS[entry.itemId]
                const poor = !entry.owned && stardust < entry.price
                return (
                  <button
                    key={entry.itemId}
                    type="button"
                    className={`item-cell${entry.owned ? ' locked' : ''}`}
                    disabled={entry.owned}
                    onClick={() => setConfirming(entry.itemId)}
                  >
                    <span className="item-thumb">
                      <PixelPlanet {...planetProps(entry.itemId, 56)} dim={entry.owned} />
                    </span>
                    <strong>{label.name}</strong>
                    <span className="item-rarity">
                      <i style={{ background: RARITY_DOTS[def.rarity] }} aria-hidden="true" />
                      {RARITY_LABELS[def.rarity]}
                    </span>
                    {entry.owned
                      ? <small>보유 중</small>
                      : <small className={poor ? 'short' : undefined}>✨ {money(entry.price)}</small>}
                  </button>
                )
              })}
            </div>
          )}
      </section>

      {confirming !== null && (
        <PurchaseSheet
          name={ITEM_LABELS[confirming].name}
          detail={`${CATEGORY_LABELS[ITEMS[confirming].category].name} · ${RARITY_LABELS[ITEMS[confirming].rarity]}`}
          price={ITEMS[confirming].price ?? 0}
          balance={stardust}
          planet={planetProps(confirming, 124)}
          onClose={() => setConfirming(null)}
          onBuy={() => { onBuy(confirming); setConfirming(null) }}
        />
      )}
    </main>
  )
}
