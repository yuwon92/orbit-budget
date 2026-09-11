import { useEffect, useRef, type CSSProperties } from 'react'
import type { ItemId, Rarity } from '@orbit/wish-core/items'
import { PixelPlanet } from './PixelPlanet'
import { pad2 } from '../lib/format'
import { RARITY_LABELS } from '../lib/items'
import { previewProps, type EquippedItems, type WishSkin } from '../lib/preview'

export type Reward =
  | { kind: 'levelup'; from: number; to: number; title: string; unlock: string | null }
  | { kind: 'complete'; name: string; seed: number; xp: number; date: string }
  | { kind: 'title'; name: string; detail: string; icon: string }
  | { kind: 'levelReward'; level: number; dust: number; itemName?: string }
  /** 상자 개봉. 결과는 이미 저장됐고 여기서는 보여 주기만 한다(§8) */
  | {
      kind: 'box'
      boxName: string
      itemId: ItemId
      itemName: string
      rarity: Rarity
      /** 지금 장착 상태. 뽑힌 아이템만 갈아 끼워 그린다 */
      items: EquippedItems
      duplicate: boolean
      dust: number
    }

/**
 * 레벨업·완주 연출. 픽셀 버스트 → 문구 → 보상 순으로 짧게 끝낸다. (가이드 12장)
 *
 * 큰 글자에는 `LV.`의 마침표를 넣지 않는다 — Mona12는 12px 비트맵이라 36px로 키우면
 * 1픽셀짜리 마침표가 3×3 블록이 되고 글자 사이에 뜬 점처럼 보인다. 11px
 * `.pixel-label`에서는 문장부호로 읽히므로 그쪽은 `LV.` 그대로 둔다.
 */
export function RewardOverlay({ reward, skin, onClose }: { reward: Reward; skin: WishSkin; onClose: () => void }) {
  const close = useRef(onClose)
  close.current = onClose

  // 연출 하나당 타이머 하나. 부모가 다시 그려져도 다시 시작하지 않는다.
  useEffect(() => {
    const timer = window.setTimeout(() => close.current(), reward.kind === 'complete' ? 4400 : 3400)
    return () => window.clearTimeout(timer)
  }, [reward])

  return (
    <div className="reward-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="burst" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--a': `${index * 30}deg` } as CSSProperties} />)}
      </div>

      {reward.kind === 'levelup' ? (
        <div className="reward-body">
          <span className="reward-spark" aria-hidden="true">✦</span>
          <p className="reward-title">LEVEL UP</p>
          <p className="reward-jump">
            <span>LV {pad2(reward.from)}</span>
            <em>↓</em>
            <span className="to">LV {pad2(reward.to)}</span>
          </p>
          <p className="reward-name">{reward.title}</p>
          {reward.unlock && <p className="reward-unlock">NEW ORBIT UNLOCKED · {reward.unlock}</p>}
        </div>
      ) : reward.kind === 'levelReward' ? (
        <div className="reward-body">
          <span className="reward-spark" aria-hidden="true">✦</span>
          <p className="reward-title compact">REWARD CLAIMED</p>
          <p className="reward-jump"><span className="to">LV {pad2(reward.level)}</span></p>
          <p className="reward-sub">+{reward.dust.toLocaleString('ko-KR')} 별가루</p>
          {reward.itemName && <p className="reward-unlock">{reward.itemName} 획득</p>}
        </div>
      ) : reward.kind === 'box' ? (
        <div className="reward-body">
          <PixelPlanet {...previewProps(reward.items, reward.itemId, 132)} />
          <p className="reward-title compact">{reward.duplicate ? 'DUPLICATE' : 'BOX OPENED'}</p>
          <p className="reward-jump"><span className="to">{reward.itemName}</span></p>
          <p className="reward-sub">{reward.boxName} · {RARITY_LABELS[reward.rarity]}</p>
          <p className="reward-unlock">
            {reward.duplicate
              ? `이미 보유 · 별가루 +${reward.dust.toLocaleString('ko-KR')}`
              : '꾸미기에 추가'}
          </p>
        </div>
      ) : reward.kind === 'title' ? (
        <div className="reward-body">
          <span className="reward-icon" aria-hidden="true">{reward.icon}</span>
          <p className="reward-title compact">TITLE EARNED</p>
          <p className="reward-jump"><span className="to">{reward.name}</span></p>
          <p className="reward-sub">{reward.detail}</p>
          <p className="reward-unlock">관측소에 칭호 추가</p>
        </div>
      ) : (
        <div className="reward-body">
          <PixelPlanet progress={100} seed={reward.seed} size={132} float {...skin} />
          <p className="reward-title">WISH COMPLETED</p>
          <p className="reward-name">{reward.name}</p>
          <p className="reward-sub">소원이 이루어졌다 · {reward.date.replaceAll('-', '.')}</p>
          <p className="reward-unlock">+{reward.xp.toLocaleString('ko-KR')} XP · 도감에 별 하나 추가</p>
        </div>
      )}
      <button className="reward-dismiss">화면을 누르면 닫힘</button>
    </div>
  )
}
