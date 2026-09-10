import { ChevronRight } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import { UNLOCKS, earnedTitles, levelFromXp, observerStats } from '@orbit/wish-core/xp'
import type { ItemCategory, ItemId } from '@orbit/wish-core/items'
import type { Equipped, OwnedItem } from '@orbit/wish-core/types'
import { UniversePreview } from '../components/UniversePreview'
import { PixelBar } from '../components/PixelBar'
import { TITLES } from '../lib/labels'
import { pad2 } from '../lib/format'
import { type BudgetView } from '../lib/budget'
import { DecorateScreen } from './DecorateScreen'
import { ObservatorySettings } from './ObservatorySettings'
import { ShopScreen } from './ShopScreen'

/**
 * 관측소 하위 화면. 바텀시트가 아니라 .wl-content 안에서 탭 뷰 전체를
 * 대체한다(Orbit의 settingsSub와 같은 방식). 하단 탭과 HUD는 그대로 둔다 —
 * 모바일에서 .wl-nav는 셸의 flex 아이템이라 숨기면 스크롤 위치가 튄다.
 */
export type ObsSub = 'decorate' | 'shop' | 'settings' | null

export function ObservatoryScreen({
  level, totalXp, pendingXp, stats, titles, budget, dark, onThemeChange,
  owned, equipped, onEquip, onUnequip, stardust, onBuy, onTestDust, sub, onSub,
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
  /** 개발 빌드에서만 들어온다. 설정 화면의 별가루 버튼 */
  onTestDust?: () => void
  sub: ObsSub
  onSub: (sub: ObsSub) => void
}) {
  if (sub === 'decorate') {
    return (
      <DecorateScreen
        owned={owned}
        equipped={equipped}
        onEquip={onEquip}
        onUnequip={onUnequip}
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
        onTestDust={onTestDust}
        back={() => onSub(null)}
      />
    )
  }

  const earned = new Set(titles)
  const next = UNLOCKS.find((item) => item.level > level.level)

  return (
    <main className="observatory-screen">
      <header className="screen-head">
        <span className="pixel-label">OBSERVATORY</span>
        <h1>관측소 Lv.{pad2(level.level)}</h1>
      </header>

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
            <p className="observer-xp-sub">
              {next ? `다음 보상 Lv.${pad2(next.level)} ${next.name}` : '해금 전부 완료'}
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><span className="pixel-label">UNLOCKS</span><h2>궤도 해금</h2></div></div>
        <ul className="unlock-track">
          {UNLOCKS.map((item) => {
            const open = level.level >= item.level
            return (
              <li key={item.level} className={open ? 'open' : 'closed'}>
                <span className="pixel-label">LV. {pad2(item.level)}</span>
                <strong>{item.name}</strong>
                <span>{open ? '해금됨' : item.detail}</span>
              </li>
            )
          })}
        </ul>
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

      <ul className="obs-links">
        <li>
          <button onClick={() => onSub('decorate')}>
            <span><strong>꾸미기</strong><small>행성 색 · 무늬 · 링 · 배경 · 동료 · 효과</small></span>
            <ChevronRight size={17} />
          </button>
        </li>
        <li>
          <button onClick={() => onSub('shop')}>
            <span><strong>상점</strong><small>별가루 {stardust.toLocaleString('ko-KR')} · 꾸미기 아이템 구매</small></span>
            <ChevronRight size={17} />
          </button>
        </li>
        <li>
          <button onClick={() => onSub('settings')}>
            <span><strong>설정</strong><small>화면 테마 · 예산 연결</small></span>
            <ChevronRight size={17} />
          </button>
        </li>
      </ul>
    </main>
  )
}
