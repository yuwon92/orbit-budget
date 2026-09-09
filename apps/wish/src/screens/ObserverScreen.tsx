import { Moon, Sun } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import { UNLOCKS, earnedTitles, levelFromXp, observerStats } from '@orbit/wish-core/xp'
import { OrbitRing, PixelPlanet } from '../components/PixelPlanet'
import { PixelBar } from '../components/PixelBar'
import { TITLES } from '../lib/labels'
import { pad2 } from '../lib/format'
import { sinceLabel, type BudgetView } from '../lib/budget'

export function ObserverScreen({ level, totalXp, pendingXp, stats, titles, budget, dark, onThemeChange }: {
  level: ReturnType<typeof levelFromXp>
  totalXp: number
  pendingXp: number
  stats: ReturnType<typeof observerStats>
  titles: ReturnType<typeof earnedTitles>
  budget: BudgetView | null
  dark: boolean
  onThemeChange: (value: boolean) => void
}) {
  const earned = new Set(titles)

  return (
    <main className="observer-screen">
      <header className="screen-head">
        <span className="pixel-label">OBSERVER</span>
        <h1>관측자 Lv.{pad2(level.level)}</h1>
      </header>

      <section className="observer-card">
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

      <section className="panel">
        <div className="panel-head"><div><span className="pixel-label">SETTINGS</span><h2>관측소 설정</h2></div></div>
        <div className="setting-list">
          <div className="setting-row">
            <div><strong>화면 테마</strong><span>밝은 우주 / 꿈속의 밤</span></div>
            <div className="theme-choice">
              <button className={!dark ? 'active' : ''} onClick={() => onThemeChange(false)}><Sun size={16} /> 라이트</button>
              <button className={dark ? 'active' : ''} onClick={() => onThemeChange(true)}><Moon size={16} /> 다크</button>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>예산 연결</strong>
              <span>
                {!budget
                  ? '예산 확인 중'
                  : budget.snapshot && !budget.stale
                    ? `남은 자유비용 ${money(budget.snapshot.freeAmount)}원`
                    : budget.snapshot
                      ? `마지막 확인 ${sinceLabel(budget.snapshot.calculatedAt)} · ${money(budget.snapshot.freeAmount)}원`
                      : 'Orbit 예산을 읽지 못했다'}
              </span>
            </div>
            <span className={`connection-state${budget?.snapshot && !budget.stale ? '' : ' off'}`}>
              <i /> {budget?.snapshot && !budget.stale ? '연결됨' : '연결 안 됨'}
            </span>
          </div>
          <div className="setting-row">
            <div><strong>프로토타입</strong></div>
            <span className="version-label">WISH 0.1</span>
          </div>
        </div>
      </section>
    </main>
  )
}
