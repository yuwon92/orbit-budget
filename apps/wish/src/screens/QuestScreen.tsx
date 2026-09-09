import { ChevronRight, Plus, WalletCards } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import { dailyShare, dayStatus, progress as progressOf, remainingDays } from '@orbit/wish-core/wish'
import { XP } from '@orbit/wish-core/xp'
import type { Wish, WishEvent } from '@orbit/wish-core/types'
import { PixelPlanet } from '../components/PixelPlanet'
import { PixelBar } from '../components/PixelBar'
import { pad2 } from '../lib/format'

export function QuestScreen({ wishes, slotsUsed, orbitNumbers, events, today, slots, onCollect, onAddOrbit, onAddList, onEdit, onResolve, onFocus }: {
  wishes: Wish[]
  orbitNumbers: ReadonlyMap<string, number>
  events: WishEvent[]
  today: string
  slots: number
  slotsUsed: number
  onCollect: (wish: Wish) => void
  onAddOrbit: () => void
  onAddList: () => void
  onEdit: (wish: Wish) => void
  onResolve: (wish: Wish) => void
  onFocus: (wish: Wish) => void
}) {
  const orbitWishes = wishes.filter((wish) => wish.targetDate)
  const listWishes = wishes.filter((wish) => !wish.targetDate)

  return (
    <main className="quest-screen">
      <header className="screen-head">
        <span className="pixel-label">QUEST LOG</span>
        <h1>진행 중인 궤도</h1>
        <p>{slotsUsed} / {slots} 슬롯 사용 중</p>
      </header>

      <ul className="quest-list">
        {orbitWishes.map((wish) => {
          const progress = progressOf(wish)
          const share = dailyShare(wish, events, today)
          const days = remainingDays(wish, today)
          const todayDone = dayStatus(wish, events, today) !== 'none'
          return (
            <li key={wish.id} className={`quest-card state-${wish.status}`}>
              <div className="quest-body">
                <div className="quest-card-head">
                  <div className="quest-heading">
                    <span className="pixel-label">ORBIT {pad2(orbitNumbers.get(wish.id) ?? 1)}</span>
                    <div className="quest-title-row">
                      <h2>{wish.name}</h2>
                      <button className="quest-edit" onClick={() => onEdit(wish)} aria-label={`${wish.name} 수정하기`}><span aria-hidden="true">✎</span></button>
                    </div>
                  </div>
                  <button className="quest-planet" onClick={() => onFocus(wish)} aria-label={`${wish.name} 허브에서 보기`}>
                    <PixelPlanet progress={progress} seed={wish.seed} size={64} />
                  </button>
                </div>
                <PixelBar ratio={progress / 100} segments={12} />
                <p className="quest-numbers">
                  <strong>{money(wish.savedAmount)}</strong>
                  <span>/ {money(wish.targetAmount)}원</span>
                  <em>{progress}%</em>
                </p>
                <p className="quest-meta">
                  {wish.status === 'ready' ? (
                    <span className="flag ready">목표 도달</span>
                  ) : wish.status === 'waiting' ? (
                    <span className="flag waiting">기다리는 중 · 하루 +{XP.wait} XP</span>
                  ) : (
                    <>
                      <span className={todayDone ? 'flag done' : 'flag todo'}>{todayDone ? '오늘 몫 완료' : '오늘 몫 미완료'}</span>
                      <i />
                      <span>하루 {share ? `${money(share)}원` : '—'}</span>
                      <i />
                      <span>{days ? `${days}일 남음` : '기간 없음'}</span>
                    </>
                  )}
                </p>
                <div className="quest-actions">
                  {wish.status === 'ready' || wish.status === 'waiting' ? (
                    <button className="primary-button" onClick={() => onResolve(wish)}><WalletCards size={17} /> {wish.status === 'ready' ? '다음 선택하기' : '구매·정리 선택'}</button>
                  ) : (
                    <button className="primary-button" disabled={todayDone} onClick={() => onCollect(wish)}>
                      {todayDone ? '오늘 몫 완료' : '오늘 모으기'}
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}

        {Array.from({ length: Math.max(0, 3 - slotsUsed) }, (_, index) => {
          const slotNumber = slotsUsed + index + 1
          const locked = slotNumber > slots
          return (
            <li key={`slot-${slotNumber}`} className={`quest-slot${locked ? ' locked' : ''}`}>
              {locked ? (
                <>
                  <span className="pixel-lock-icon" aria-hidden="true">🔒</span>
                  <strong>슬롯 {slotNumber} 잠김</strong>
                  <span>{slotNumber === 2 ? 'Lv.2 또는 완주 1개' : 'Lv.4 또는 완주 3개'}</span>
                </>
              ) : (
                <button onClick={onAddOrbit}><Plus size={18} /> 슬롯 {slotNumber} · 새 궤도 열기</button>
              )}
            </li>
          )
        })}
      </ul>

      <section className="wish-list-section">
        <header className="wish-list-head">
          <div>
            <span className="pixel-label">WISH LIST</span>
            <h2>기간 없는 위시</h2>
          </div>
          <button onClick={onAddList}><Plus size={17} /> 위시 추가</button>
        </header>

        {listWishes.length ? (
          <ul className="plain-wish-list">
            {listWishes.map((wish) => (
              <li key={wish.id}>
                <button onClick={() => onEdit(wish)}>
                  <span><strong>{wish.name}</strong><small>목표 금액</small></span>
                  <b>{money(wish.targetAmount)}원</b>
                  <ChevronRight size={17} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <button className="empty-wish-list" onClick={onAddList}>
            <Plus size={18} /> 언젠가 이루고 싶은 위시 추가
          </button>
        )}
      </section>
    </main>
  )
}
