import { useState } from 'react'
import { money } from '@orbit/budget-core/format'
import { earnedTitles, levelFromXp, observerStats } from '@orbit/wish-core/xp'
import { MAX_REWARD_LEVEL, nextMajorReward } from '@orbit/wish-core/reward'
import { ITEM_IDS, equippedMap, type ItemCategory, type ItemId } from '@orbit/wish-core/items'
import type { BoxOpen, Equipped, OwnedBox, OwnedItem } from '@orbit/wish-core/types'
import type { BoxType } from '@orbit/wish-core/reward'
import { LevelRewardCard } from '../components/LevelRewardCard'
import { LevelRoadmapSheet } from '../components/Sheets'
import { UniversePreview } from '../components/UniversePreview'
import { PixelBar } from '../components/PixelBar'
import { TITLES } from '../lib/labels'
import { pad2 } from '../lib/format'
import { type BudgetView } from '../lib/budget'
import { summarizeReward, titleOfLevel } from '../lib/rewards'
import { DecorateScreen } from './DecorateScreen'
import { LevelRewardScreen } from './LevelRewardScreen'
import { ObservatorySettings, type DevSettings } from './ObservatorySettings'
import { ShopScreen } from './ShopScreen'

/**
 * 관측소 하위 화면. 바텀시트가 아니라 .wl-content 안에서 탭 뷰 전체를
 * 대체한다(Orbit의 settingsSub와 같은 방식). 하단 탭과 HUD는 그대로 둔다 —
 * 모바일에서 .wl-nav는 셸의 flex 아이템이라 숨기면 스크롤 위치가 튄다.
 */
export type ObsSub = 'rewards' | 'decorate' | 'shop' | 'settings' | null

export function ObservatoryScreen({
  level, totalXp, pendingXp, stats, titles, budget, dark, onThemeChange,
  owned, equipped, onEquip, onUnequip, stardust, onBuy,
  boxes, boxOpens, onOpenBox, onBuyBox,
  unclaimedRewards, onClaimReward, sub, onSub, ...dev
}: {
  level: ReturnType<typeof levelFromXp>
  totalXp: number
  pendingXp: number
  stats: ReturnType<typeof observerStats>
  titles: ReturnType<typeof earnedTitles>
  budget: BudgetView | null
  dark: boolean
  onThemeChange: (value: boolean) => void
  owned: OwnedItem[]
  equipped: Equipped[]
  onEquip: (category: ItemCategory, itemId: ItemId) => void
  onUnequip: (category: ItemCategory) => void
  stardust: number
  onBuy: (itemId: ItemId) => void
  boxes: OwnedBox[]
  boxOpens: BoxOpen[]
  onOpenBox: (boxId: string) => void
  onBuyBox: (type: BoxType) => void
  unclaimedRewards: number[]
  onClaimReward: (level: number, selectedItemId?: ItemId) => void
  sub: ObsSub
  onSub: (sub: ObsSub) => void
} & DevSettings) {
  // 홈 카드의 선택형 보상에서 고른 값. 수령하면 비운다 — 다음 레벨 카드가 앞의
  // 선택을 물려받으면 엉뚱한 아이템이 골라진 채로 보인다
  const [pick, setPick] = useState<ItemId | undefined>(undefined)
  // 앞으로의 보상표. 카드 하나는 바로 다음 것만 말해 줘서 그 앞이 안 보인다
  const [roadmap, setRoadmap] = useState(false)

  if (sub === 'rewards') {
    return (
      <LevelRewardScreen
        unclaimed={unclaimedRewards}
        equipped={equipped}
        onClaim={onClaimReward}
        back={() => onSub(null)}
      />
    )
  }
  if (sub === 'decorate') {
    return (
      <DecorateScreen
        owned={owned}
        equipped={equipped}
        stardust={stardust}
        onBuy={onBuy}
        onEquip={onEquip}
        onUnequip={onUnequip}
        onShop={() => onSub('shop')}
        back={() => onSub(null)}
      />
    )
  }
  if (sub === 'shop') {
    return (
      <ShopScreen
        owned={owned}
        equipped={equipped}
        stardust={stardust}
        onBuy={onBuy}
        onEquip={onEquip}
        onUnequip={onUnequip}
        boxes={boxes}
        boxOpens={boxOpens}
        onOpenBox={onOpenBox}
        onBuyBox={onBuyBox}
        onDecorate={() => onSub('decorate')}
        back={() => onSub(null)}
      />
    )
  }
  if (sub === 'settings') {
    return (
      <ObservatorySettings
        budget={budget}
        dark={dark}
        onThemeChange={onThemeChange}
        back={() => onSub(null)}
        {...dev}
      />
    )
  }

  const earned = new Set(titles)
  const upcoming = nextMajorReward(level.level)
  const nextClaim = unclaimedRewards[0]
  const items = equippedMap(equipped)
  const unopenedBoxes = boxes.filter((box) => box.openedAt === null).length

  return (
    <main className="observatory-screen">
      <header className="screen-head">
        <span className="pixel-label">OBSERVATORY</span>
        <h1>관측소 Lv.{pad2(level.level)}</h1>
      </header>

      {/* 꾸미기·상점은 관측소의 주 내용이라 제목 바로 밑에 둔다. 화면 맨 아래
          목록 줄에 있을 때는 스크롤을 끝까지 내려야 보였다 */}
      <nav className="obs-shortcuts" aria-label="관측소 바로가기">
        <button onClick={() => onSub('decorate')}>
          <span className="obs-shortcut-icon" aria-hidden="true">🎨</span>
          <strong>꾸미기</strong>
          <small>보유 {owned.length} / {ITEM_IDS.length}</small>
        </button>
        {/* 상자도 상점 안에 있다. 미개봉이 있으면 잔액 대신 그것부터 알린다 —
            같은 곳으로 가는 문을 둘로 두지 않는다 */}
        <button onClick={() => onSub('shop')}>
          <span className="obs-shortcut-icon" aria-hidden="true">🛒</span>
          <strong>상점</strong>
          <small>
            {unopenedBoxes
              ? `미개봉 상자 ${unopenedBoxes}장`
              : `별가루 ${stardust.toLocaleString('ko-KR')}`}
          </small>
        </button>
        <button onClick={() => onSub('settings')}>
          <span className="obs-shortcut-icon" aria-hidden="true">🔧</span>
          <strong>설정</strong>
          <small>테마 · 예산 연결</small>
        </button>
      </nav>

      <section className="panel">
        <div className="panel-head"><div><span className="pixel-label">MY UNIVERSE</span><h2>나의 우주</h2></div></div>
        <div className="observer-card">
          <div className="observer-planet">
            <UniversePreview
              equipped={equipped}
              progress={Math.min(99, level.level * 14)}
              seed={7}
              size={78}
              ring={level.ratio * 100}
              float
            />
          </div>
          <div className="observer-xp">
            <PixelBar ratio={level.ratio} segments={16} />
            <p className="observer-xp-numbers">
              <strong>{level.into.toLocaleString('ko-KR')}</strong>
              <span>/ {level.max ? '—' : level.need.toLocaleString('ko-KR')} XP</span>
            </p>
            <p className="observer-xp-sub">
              누적 {totalXp.toLocaleString('ko-KR')} · 다음 레벨까지 {level.max ? 0 : level.need - level.into}
              {pendingXp > 0 && ` · 미수령 ${pendingXp}`}
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><span className="pixel-label">REWARDS</span><h2>레벨 보상</h2></div>
          {unclaimedRewards.length > 0
            ? <span className="panel-count">미수령 {unclaimedRewards.length}</span>
            : <span className="panel-count">Lv.{pad2(Math.min(level.level, MAX_REWARD_LEVEL))} 까지 수령</span>}
        </div>
        {/* 미수령이 있으면 여기서 바로 받는다. 화면을 옮기지 않는 것이 기본이고,
            둘 이상 밀렸을 때만(§11 소급) 목록 화면을 연다 */}
        {nextClaim !== undefined ? (
          <>
            <LevelRewardCard
              level={nextClaim}
              items={items}
              pick={pick}
              onPick={setPick}
              onClaim={() => { onClaimReward(nextClaim, pick); setPick(undefined) }}
            />
            {unclaimedRewards.length > 1 && (
              <button className="reward-more" onClick={() => onSub('rewards')}>
                나머지 {unclaimedRewards.length - 1}개 ›
              </button>
            )}
            <button className="reward-more" onClick={() => setRoadmap(true)}>앞으로의 보상 ›</button>
          </>
        ) : upcoming ? (
          // 누르면 Lv.20까지의 표가 열린다. 카드 하나로는 지금 모으는 XP가 무엇으로
          // 돌아오는지 그 앞을 볼 수 없다
          <button className="reward-next" onClick={() => setRoadmap(true)}>
            <span className="pixel-label">LV. {pad2(upcoming.level)}</span>
            <strong>{titleOfLevel(upcoming.level)}</strong>
            <span>{summarizeReward(upcoming)}</span>
            <small>앞으로의 보상 전부 보기 ›</small>
          </button>
        ) : (
          <p className="shop-empty">Lv.{MAX_REWARD_LEVEL} 보상까지 전부 수령</p>
        )}
      </section>

      <section className="stat-grid">
        <div><span>지킨 날</span><strong>{stats.keptDays}일</strong><small>전체 기록</small></div>
        <div><span>현재 연속</span><strong>{stats.streak}일</strong><small>최장 {stats.bestStreak}일</small></div>
        <div>
          <span>넘긴 예산</span>
          <strong>{stats.carryovers ? `${stats.carryovers}회` : '—'}</strong>
          <small>{stats.carryovers ? `${money(stats.carryoverAmount)}원` : '아직 없음'}</small>
        </div>
        <div>
          <span>누적 저금</span>
          <strong>{money(stats.lifetimeDeposit)}원</strong>
          <small>완주 {stats.completed}개 · 더 기다림 {stats.waits}회</small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><span className="pixel-label">TITLES</span><h2>칭호</h2></div>
          <span className="panel-count">{earned.size} / {TITLES.length}</span>
        </div>
        <div className="badge-grid">
          {TITLES.map((title) => (
            <div key={title.id} className={`badge ${earned.has(title.id) ? 'earned' : 'locked'}`}>
              <span className="badge-icon" aria-hidden="true">{title.icon}</span>
              <strong>{title.name}</strong>
              <span>{title.detail}</span>
            </div>
          ))}
        </div>
      </section>

      {roadmap && (
        <LevelRoadmapSheet level={level.level} totalXp={totalXp} onClose={() => setRoadmap(false)} />
      )}
    </main>
  )
}
