import { ChevronRight } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import { UNLOCKS, earnedTitles, levelFromXp, observerStats } from '@orbit/wish-core/xp'
import { OrbitRing, PixelPlanet } from '../components/PixelPlanet'
import { PixelBar } from '../components/PixelBar'
import { TITLES } from '../lib/labels'
import { pad2 } from '../lib/format'
import { type BudgetView } from '../lib/budget'
import { ObservatorySettings } from './ObservatorySettings'

/**
 * 관측소 하위 화면. 바텀시트가 아니라 .wl-content 안에서 탭 뷰 전체를
 * 대체한다(Orbit의 settingsSub와 같은 방식). 하단 탭과 HUD는 그대로 둔다 —
 * 모바일에서 .wl-nav는 셸의 flex 아이템이라 숨기면 스크롤 위치가 튄다.
 */
export type ObsSub = 'settings' | null

export function ObservatoryScreen({ level, totalXp, pendingXp, stats, titles, budget, dark, onThemeChange, sub, onSub }: {
  level: ReturnType<typeof levelFromXp>
  totalXp: number
  pendingXp: number
  stats: ReturnType<typeof observerStats>
  titles: ReturnType<typeof earnedTitles>
  budget: BudgetView | null
  dark: boolean
  onThemeChange: (value: boolean) => void
  sub: ObsSub
  onSub: (sub: ObsSub) => void
}) {
  if (sub === 'settings') {
    return <ObservatorySettings budget={budget} dark={dark} onThemeChange={onThemeChange} back={() => onSub(null)} />
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
            <OrbitRing progress={level.ratio * 100} size={150} dots={20} />
            <PixelPlanet progress={Math.min(99, level.level * 14)} seed={7} size={78} float />
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
          <button onClick={() => onSub('settings')}>
            <span><strong>설정</strong><small>화면 테마 · 예산 연결</small></span>
            <ChevronRight size={17} />
          </button>
        </li>
      </ul>
    </main>
  )
}
