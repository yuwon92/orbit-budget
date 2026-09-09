import { ChevronRight, Plus } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import {
  dailyShare,
  keptDays,
  orbitLevelOf,
  progress as progressOf,
  remainingDays,
  stageOf,
} from '@orbit/wish-core/wish'
import type { Wish, WishEvent } from '@orbit/wish-core/types'
import { PixelPlanet } from '../components/PixelPlanet'
import { OrbitMap } from '../components/OrbitMap'
import { type Mission } from '../missions'
import { STAGE_NAMES } from '../lib/labels'
import { pad2 } from '../lib/format'

export function HubScreen({ wishes, active, events, today, missions, pendingXp, slots, slotsUsed, level, onSelect, onAdd, onRun, onClaimOne, onClaimAll, onOpenQuests }: {
  wishes: Wish[]
  active: Wish | null
  events: WishEvent[]
  today: string
  missions: Mission[]
  pendingXp: number
  slots: number
  slotsUsed: number
  level: number
  onSelect: (id: string) => void
  onAdd: () => void
  onRun: (mission: Mission) => void
  onClaimOne: (mission: Mission) => void
  onClaimAll: () => void
  onOpenQuests: () => void
}) {
  if (!active) {
    return (
      <main className="hub-screen empty">
        <PixelPlanet progress={6} seed={3} size={140} float />
        <span className="pixel-label">EMPTY ORBIT</span>
        <h1>우주가 아직 조용하다</h1>
        <p>첫 소원을 빌고 궤도를 하나 열어 보자.</p>
        <button className="primary-button" onClick={onAdd}><Plus size={18} /> 새 소원 빌기</button>
      </main>
    )
  }

  const progress = progressOf(active)
  const days = remainingDays(active, today)
  const share = dailyShare(active, events, today)
  const done = missions.filter((mission) => mission.state !== 'todo').length

  return (
    <main className="hub-screen">
      <header className="hub-greeting">
        <h1>내 궤도</h1>
      </header>

      <section className="hub-stage">
        <OrbitMap
          wishes={wishes}
          activeId={active.id}
          onSelect={onSelect}
          onAdd={onAdd}
          slots={slots}
        />
        <div className="stage-caption">
          <span className="pixel-label">{orbitLevelOf(progress)}단계 · {STAGE_NAMES[stageOf(progress)]}</span>
          <h2>{active.name}</h2>
          <p className="stage-numbers">
            <strong>{progress}%</strong>
            <span>{money(active.savedAmount)} / {money(active.targetAmount)}원</span>
          </p>
          <p className="stage-meta">
            <span>하루 몫 {share ? `${money(share)}원` : '—'}</span>
            <i />
            <span>{days ? `${days}일 남음` : '기간 없음'}</span>
            <i />
            <span>지킨 날 {keptDays(events, active.id)}일</span>
          </p>
        </div>
      </section>

      <section className="mission-panel">
        <div className="panel-head">
          <div>
            <span className="pixel-label">TODAY'S MISSIONS</span>
            <h2>오늘의 미션 {done} / {missions.length}</h2>
          </div>
          <button className="link-button" onClick={onOpenQuests}>퀘스트 로그 <ChevronRight size={15} /></button>
        </div>

        <ul className="mission-list">
          {missions.map((mission) => (
            <li key={mission.id} className={`mission ${mission.state}`}>
              <span className="mission-mark" aria-hidden="true" />
              <div className="mission-text">
                <strong>{mission.title}</strong>
                <span className="mission-sub">
                  {mission.wishName && <span className="mission-wish">{mission.wishName}</span>}
                  {mission.detail}
                </span>
              </div>
              <span className="mission-xp">{mission.skipped ? '—' : `+${mission.xp} XP`}</span>
              {mission.state === 'todo' && <button className="mission-go" onClick={() => onRun(mission)}>수행</button>}
              {mission.state === 'claimable' && (
                <button className="mission-go claim" onClick={() => onClaimOne(mission)}>+{mission.xp} 받기</button>
              )}
              {mission.state === 'claimed' && <span className="mission-state">{mission.skipped ? '쉬어감' : '수령 완료'}</span>}
            </li>
          ))}
        </ul>

        <button className="claim-button" onClick={onClaimAll} disabled={!pendingXp}>
          {pendingXp ? `CLAIM +${pendingXp} XP` : '수령할 보상 없음'}
        </button>
        <p className="claim-hint">Lv.{pad2(level)} 관측자 · 궤도 슬롯 {slotsUsed} / {slots}</p>
      </section>
    </main>
  )
}
