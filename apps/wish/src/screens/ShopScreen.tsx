import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import {
  BOX_ODDS,
  BOX_WEEKLY_LIMIT,
  PITY_LIMIT,
  boxPool,
  boxPriceOf,
  boxRarities,
  boxesBoughtThisWeek,
  pityCount,
} from '@orbit/wish-core/box'
import { CATEGORIES, ITEMS, equippedMap, type ItemCategory, type ItemId, type Rarity } from '@orbit/wish-core/items'
import type { BoxType } from '@orbit/wish-core/reward'
import { shopItems } from '@orbit/wish-core/shop'
import type { BoxOpen, Equipped, OwnedBox, OwnedItem } from '@orbit/wish-core/types'
import { PixelPlanet } from '../components/PixelPlanet'
import { ItemSheet } from '../components/Sheets'
import { CATEGORY_LABELS, ITEM_LABELS, RARITY_DOTS, RARITY_LABELS } from '../lib/items'
import { BOX_DETAILS, BOX_LABELS, BOX_ORDER } from '../lib/rewards'
import { previewProps } from '../lib/preview'

type Filter = ItemCategory | 'all'

/**
 * 관측소 하위 화면. 탭 뷰 전체를 대체하고 하단 탭은 그대로 둔다.
 *
 * 상자도 여기 있다. 사는 곳과 여는 곳이 갈리면 「상자」를 찾아 화면을 둘 뒤져야
 * 하고, 미개봉 한두 장 때문에 화면을 따로 두면 평소에는 늘 비어 있다.
 */
export function ShopScreen({
  owned, equipped, stardust, onBuy, onEquip, onUnequip,
  boxes, boxOpens, onOpenBox, onBuyBox, onDecorate, back,
}: {
  owned: OwnedItem[]
  equipped: Equipped[]
  stardust: number
  onBuy: (itemId: ItemId) => void
  onEquip: (category: ItemCategory, itemId: ItemId) => void
  onUnequip: (category: ItemCategory) => void
  boxes: OwnedBox[]
  boxOpens: BoxOpen[]
  onOpenBox: (boxId: string) => void
  onBuyBox: (type: BoxType) => void
  onDecorate: () => void
  back: () => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [confirming, setConfirming] = useState<ItemId | null>(null)
  const items = equippedMap(equipped)
  const ownedIds = new Set(owned.map((item) => item.itemId))
  const entries = shopItems(owned.map((item) => item.itemId))
  const shown = filter === 'all' ? entries : entries.filter((entry) => ITEMS[entry.itemId].category === filter)

  // 열지 않은 것만 센다. 먼저 받은 것부터 열어 주므로 어느 장인지는 차이가 없다
  const unopened = boxes.filter((box) => box.openedAt === null)
  const boxPrice = boxPriceOf('normal') ?? 0
  const boxPoor = stardust < boxPrice
  // 한도는 상점에서 산 것만 센다. 판정은 buyBox가 트랜잭션 안에서 다시 한다
  const boughtThisWeek = boxesBoughtThisWeek(boxes, Date.now())
  const boxCapped = boughtThisWeek >= BOX_WEEKLY_LIMIT
  // 파는 코스믹 박스는 보유가 없어도 늘 카드를 세운다. 나머지는 가진 것만
  const boxCards = BOX_ORDER.filter(
    (type) => type === 'normal' || unopened.some((box) => box.type === type),
  )
  const pity = pityCount([...boxOpens].sort((a, b) => a.openedAt - b.openedAt))

  return (
    <main className="obs-sub">
      <header className="screen-head">
        <button className="back-button" onClick={back}><ChevronLeft size={15} /> 관측소</button>
        <span className="pixel-label">SHOP</span>
        <div className="sub-head-title">
          <h1>상점</h1>
          <button className="sub-head-jump" onClick={onDecorate} aria-label="꾸미기로 이동">🎨</button>
        </div>
      </header>

      <p className="shop-balance">
        <span className="res-icon" aria-hidden="true">✨</span>
        <strong>{money(stardust)}</strong>
        <span>보유 별가루</span>
      </p>

      {/* 분류 필터와 무관한 내용이라 탭 위에 둔다 */}
      <section className="panel">
        <div className="panel-head">
          <div><span className="pixel-label">COSMIC BOX</span><h2>상자</h2></div>
          {unopened.length > 0 && <span className="panel-count">미개봉 {unopened.length}장</span>}
        </div>
        {/* 확률은 열기 전에 늘 보인다(§8). 접어 두지 않는다 — 무엇이 나올지 모르는 채로
            여는 것과 확률을 알고 여는 것은 다른 행동이다 */}
        <p className="panel-note">미보유 우선 지급 · 중복은 별가루 전환</p>
        <div className="box-list">
          {boxCards.map((type) => {
            const mine = unopened
              .filter((box) => box.type === type)
              .sort((a, b) => a.acquiredAt - b.acquiredAt)
            return (
              <article key={type} className="box-card">
                <div className="box-card-head">
                  <span className="box-icon" aria-hidden="true">{BOX_DETAILS[type].icon}</span>
                  <div>
                    <strong>{BOX_LABELS[type]}</strong>
                    {BOX_DETAILS[type].detail && <span>{BOX_DETAILS[type].detail}</span>}
                  </div>
                  <span className="box-count">{mine.length ? `${mine.length}장 보유` : '판매 중'}</span>
                </div>
                <BoxOdds type={type} ownedIds={ownedIds} />
                {type === 'normal' && (
                  <p className="box-pity">{Math.max(1, PITY_LIMIT + 1 - pity)}회 안에 희귀 이상 확정</p>
                )}
                <div className="box-actions">
                  {mine.length > 0 && (
                    <button className="primary-button full" onClick={() => onOpenBox(mine[0].boxId)}>열기</button>
                  )}
                  {type === 'normal' && (
                    <button
                      className={`${mine.length ? 'secondary-button' : 'primary-button'} full`}
                      disabled={boxPoor || boxCapped}
                      onClick={() => onBuyBox('normal')}
                    >
                      {boxCapped
                        ? '이번 주 구매 완료'
                        : boxPoor
                          ? `별가루 ${money(boxPrice - stardust)} 부족`
                          : `별가루 ${money(boxPrice)}개로 구매`}
                    </button>
                  )}
                </div>
                <p className="box-buy-note">
                  {type === 'normal'
                    ? `이번 주 ${boughtThisWeek}/${BOX_WEEKLY_LIMIT} · ${boxCapped
                      ? '월요일 초기화'
                      : `구매 후 잔액 ${money(Math.max(0, stardust - boxPrice))}`}`
                    : '레벨 보상 전용 · 판매하지 않음'}
                </p>
              </article>
            )
          })}
        </div>
      </section>

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
                    className={`item-cell${entry.owned ? ' owned' : ''}`}
                    onClick={() => setConfirming(entry.itemId)}
                  >
                    <span className="item-thumb">
                      <PixelPlanet {...previewProps(items, entry.itemId, 56)} />
                    </span>
                    <strong>{label.name}</strong>
                    <span className="item-rarity">
                      <i style={{ background: RARITY_DOTS[def.rarity] }} aria-hidden="true" />
                      {RARITY_LABELS[def.rarity]}
                    </span>
                    {entry.owned
                      ? <small>{items[ITEMS[entry.itemId].category] === entry.itemId ? '장착 중' : '보유 중'}</small>
                      : <small className={poor ? 'short' : undefined}>✨ {money(entry.price)}</small>}
                  </button>
                )
              })}
            </div>
          )}
      </section>

      {confirming !== null && (
        <ItemSheet
          itemId={confirming}
          items={items}
          owned={ownedIds.has(confirming)}
          stardust={stardust}
          onBuy={onBuy}
          onEquip={onEquip}
          onUnequip={onUnequip}
          onClose={() => setConfirming(null)}
        />
      )}
    </main>
  )
}

/**
 * 등급별 확률 한 줄. 남은 미보유 수를 함께 적는다 — 전부 가진 등급이 뽑히면
 * 중복 전환이 되므로, 확률만 보여 주면 왜 별가루가 나왔는지 읽을 수 없다.
 */
function BoxOdds({ type, ownedIds }: { type: BoxType; ownedIds: Set<string> }) {
  const pool = boxPool(type)
  return (
    <ul className="box-odds">
      {boxRarities(type).map((rarity: Rarity) => {
        const rest = pool.filter((itemId) => ITEMS[itemId].rarity === rarity && !ownedIds.has(itemId))
        return (
          <li key={rarity}>
            <i style={{ background: RARITY_DOTS[rarity] }} aria-hidden="true" />
            <span>{RARITY_LABELS[rarity]}</span>
            <strong>{Math.round(BOX_ODDS[type][rarity] * 100)}%</strong>
            <small>{rest.length ? `미보유 ${rest.length}종` : '전부 보유 · 중복 전환'}</small>
          </li>
        )
      })}
    </ul>
  )
}
