import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { equippedMap, type ItemId } from '@orbit/wish-core/items'
import type { Equipped } from '@orbit/wish-core/types'
import { LevelRewardCard } from '../components/LevelRewardCard'

/**
 * 밀린 레벨 보상 목록. 관측소 홈이 가장 낮은 하나를 직접 받게 해 주므로, 이 화면은
 * **둘 이상 밀렸을 때만** 쓴다 — 기존 사용자가 이미 레벨이 오른 채로 보상 기능을
 * 만나는 경우(§11)다.
 *
 * 「다음 보상 미리보기」는 두지 않는다. 관측소 홈이 그것을 이미 보여 준다.
 */
export function LevelRewardScreen({ unclaimed, equipped, onClaim, back }: {
  /** 미수령 레벨. 낮은 레벨부터 */
  unclaimed: number[]
  equipped: Equipped[]
  onClaim: (level: number, selectedItemId?: ItemId) => void
  back: () => void
}) {
  // 레벨마다 고른 값을 따로 담는다. 하나를 고르고 다른 레벨로 넘어가도 앞의 선택이
  // 남아 있어야 한다
  const [picks, setPicks] = useState<Record<number, ItemId>>({})
  const items = equippedMap(equipped)

  return (
    <main className="obs-sub">
      <header className="screen-head">
        <button className="back-button" onClick={back}><ChevronLeft size={15} /> 관측소</button>
        <span className="pixel-label">LEVEL REWARDS</span>
        <h1>밀린 보상</h1>
      </header>

      {unclaimed.length === 0 ? (
        <p className="shop-empty">받을 보상 없음 · 관측소에서 다음 보상 확인</p>
      ) : (
        <>
          <p className="reward-pending-note">
            미수령 {unclaimed.length}개 · 고르는 보상은 직접 선택해야 수령
          </p>
          <section className="panel reward-claim-list">
            {unclaimed.map((level) => (
              <LevelRewardCard
                key={level}
                level={level}
                items={items}
                pick={picks[level]}
                onPick={(itemId) => setPicks((current) => ({ ...current, [level]: itemId }))}
                onClaim={() => onClaim(level, picks[level])}
              />
            ))}
          </section>
        </>
      )}
    </main>
  )
}
