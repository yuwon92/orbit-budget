import { Gift } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import { ITEMS, type ItemId } from '@orbit/wish-core/items'
import { LEVEL_REWARDS } from '@orbit/wish-core/reward'
import { PixelPlanet } from './PixelPlanet'
import { ITEM_LABELS, RARITY_DOTS, RARITY_LABELS } from '../lib/items'
import { summarizeReward, titleOfLevel } from '../lib/rewards'
import { previewProps, type EquippedItems } from '../lib/preview'
import { pad2 } from '../lib/format'

/**
 * 레벨 보상 한 건을 받는 카드. 관측소 홈과 미수령 목록 화면이 같은 것을 쓴다 —
 * 두 곳에 따로 두면 선택형 그리드가 갈라진다.
 *
 * 선택형은 고른 뒤에만 버튼이 열린다(§5 「선택을 완료할 때 수령 처리」).
 */
export function LevelRewardCard({ level, items, pick, onPick, onClaim }: {
  level: number
  items: EquippedItems
  pick?: ItemId
  onPick: (itemId: ItemId) => void
  onClaim: () => void
}) {
  const reward = LEVEL_REWARDS[level]
  if (!reward) return null
  const ready = !reward.choice || pick !== undefined

  return (
    <div className="reward-claim">
      <div className="reward-claim-head">
        <div>
          <span className="pixel-label">LV. {pad2(level)}</span>
          <strong>{titleOfLevel(level)}</strong>
        </div>
        <span className="panel-count">별가루 {money(reward.dust)}</span>
      </div>
      <p className="panel-note">{summarizeReward(reward)}</p>

      {reward.choice && (
        <div className="item-grid">
          {reward.choice.of.map((itemId) => {
            const def = ITEMS[itemId]
            const label = ITEM_LABELS[itemId]
            return (
              <button
                key={itemId}
                type="button"
                className={`item-cell${pick === itemId ? ' equipped' : ''}`}
                aria-pressed={pick === itemId}
                onClick={() => onPick(itemId)}
              >
                <span className="item-thumb">
                  <PixelPlanet {...previewProps(items, itemId, 56)} />
                </span>
                <strong>{label.name}</strong>
                <span className="item-rarity">
                  <i style={{ background: RARITY_DOTS[def.rarity] }} aria-hidden="true" />
                  {RARITY_LABELS[def.rarity]}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <button className="primary-button full" disabled={!ready} onClick={onClaim}>
        <Gift size={16} /> {ready ? '보상 받기' : '하나 고르기'}
      </button>
    </div>
  )
}
