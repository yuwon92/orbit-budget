import { ChevronLeft, Moon, Sun } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import { sinceLabel, type BudgetView } from '../lib/budget'

/** 관측소 하위 화면. 탭 뷰 전체를 대체하고 하단 탭은 그대로 둔다 */
export function ObservatorySettings({ budget, dark, onThemeChange, back }: {
  budget: BudgetView | null
  dark: boolean
  onThemeChange: (value: boolean) => void
  back: () => void
}) {
  return (
    <main className="obs-sub">
      <header className="screen-head">
        <button className="back-button" onClick={back}><ChevronLeft size={15} /> 관측소</button>
        <span className="pixel-label">SETTINGS</span>
        <h1>설정</h1>
      </header>

      <section className="panel">
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
