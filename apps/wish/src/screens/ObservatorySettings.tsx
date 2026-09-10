import { ChevronLeft, Moon, Sun } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import { sinceLabel, type BudgetView } from '../lib/budget'
import type { Reward } from '../components/RewardOverlay'

/**
 * 개발 빌드에서만 채워지는 도구. 전부 optional이라 프로덕션에서는 undefined로 들어오고
 * 아래 `import.meta.env.DEV &&` 블록이 접히며 통째로 빠진다.
 */
export interface DevSettings {
  onTestDust?: () => void
  devXp?: number
  /** 0을 주면 되돌린다 */
  onDevXp?: (amount: number) => void
  onPreviewReward?: (reward: Reward) => void
  onPreviewTitle?: () => void
  sampleRewards?: { label: string; reward: Reward }[]
}

/** 관측소 하위 화면. 탭 뷰 전체를 대체하고 하단 탭은 그대로 둔다 */
export function ObservatorySettings({
  budget, dark, onThemeChange, back,
  onTestDust, devXp, onDevXp, onPreviewReward, onPreviewTitle, sampleRewards,
}: {
  budget: BudgetView | null
  dark: boolean
  onThemeChange: (value: boolean) => void
  back: () => void
} & DevSettings) {
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
          {import.meta.env.DEV && onTestDust && (
            <div className="setting-row">
              <div>
                <strong>개발용 별가루</strong>
                <span>상점 확인용 · 프로덕션 빌드에서 빠짐</span>
              </div>
              <button className="ghost-button" onClick={onTestDust}>+500</button>
            </div>
          )}
          {import.meta.env.DEV && onDevXp && (
            <div className="setting-row">
              <div>
                <strong>개발용 XP</strong>
                <span>
                  {devXp ? `가산 ${devXp.toLocaleString('ko-KR')} · ` : ''}
                  레벨 보상·레벨업 연출 확인용
                </span>
              </div>
              <div className="dev-chips">
                <button className="ghost-button" onClick={() => onDevXp(100)}>+100</button>
                <button className="ghost-button" onClick={() => onDevXp(1_000)}>+1,000</button>
                <button className="ghost-button" onClick={() => onDevXp(0)} disabled={!devXp}>되돌리기</button>
              </div>
            </div>
          )}
          {import.meta.env.DEV && onPreviewReward && sampleRewards && (
            <div className="setting-row">
              <div>
                <strong>연출 미리보기</strong>
                <span>저장 없이 오버레이만 띄움</span>
              </div>
              <div className="dev-chips">
                {sampleRewards.map((sample) => (
                  <button
                    key={sample.label}
                    className="ghost-button"
                    onClick={() => onPreviewReward(sample.reward)}
                  >
                    {sample.label}
                  </button>
                ))}
                {onPreviewTitle && (
                  <button className="ghost-button" onClick={onPreviewTitle}>칭호</button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
