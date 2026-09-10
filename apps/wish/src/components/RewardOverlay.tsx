import { useEffect, useRef, type CSSProperties } from 'react'
import { PixelPlanet } from './PixelPlanet'
import { pad2 } from '../lib/format'

export type Reward =
  | { kind: 'levelup'; from: number; to: number; title: string; unlock: string | null }
  | { kind: 'complete'; name: string; seed: number; xp: number; date: string }
  | { kind: 'title'; name: string; detail: string; icon: string }
  | { kind: 'levelReward'; level: number; dust: number; itemName?: string }

/**
 * 레벨업·완주 연출. 픽셀 버스트 → 문구 → 보상 순으로 짧게 끝낸다. (가이드 12장)
 *
 * 큰 글자에는 `LV.`의 마침표를 넣지 않는다 — Mona12는 12px 비트맵이라 36px로 키우면
 * 1픽셀짜리 마침표가 3×3 블록이 되고 글자 사이에 뜬 점처럼 보인다. 11px
 * `.pixel-label`에서는 문장부호로 읽히므로 그쪽은 `LV.` 그대로 둔다.
 */
export function RewardOverlay({ reward, onClose }: { reward: Reward; onClose: () => void }) {
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
          <PixelPlanet progress={100} seed={reward.seed} size={132} float />
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
