import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Minus, Plus, X } from 'lucide-react'
import { dailyShare, dayStatus, progress, vaultTotal } from '@orbit/wish-core/wish'
import type { Wish } from '@orbit/wish-core/types'
import { deposit, listWishEvents, listWishes, skipDay } from '../lib/wish'
import { money } from '../lib/format'
import { useSheetFocus, useSheetViewport } from '../lib/sheet'

/** Orbit 홈에서는 게임 표현 없이 오늘 저금할 위시만 간결하게 보여준다. */
export function WishSavings({ today, availableAmount, monthSaved }: {
  today: string
  availableAmount: number
  monthSaved: number
}) {
  const wishes = useLiveQuery(listWishes, [])
  const events = useLiveQuery(listWishEvents, [])
  const [selected, setSelected] = useState<Wish | null>(null)
  const eligible = useMemo(
    () => (wishes ?? []).filter((wish) => wish.status === 'active' && wish.targetDate !== null),
    [wishes],
  )

  // 로딩 중이거나 홈에 올릴 위시가 없으면 관련 UI 전체를 감춘다.
  if (wishes === undefined || events === undefined || eligible.length === 0) return null

  return (
    <section className="wish-savings-section">
      <div className="wish-savings-head">
        <div>
          <p className="eyebrow">WISH SAVINGS</p>
          <h2>위시 저금</h2>
        </div>
        <p><span>이번 달 {money(monthSaved)}원</span><i /><span>저금통 {money(vaultTotal(wishes))}원</span></p>
      </div>
      <div className="wish-savings-row">
        {eligible.map((wish) => {
          const share = dailyShare(wish, events, today)
          const status = dayStatus(wish, events, today)
          const percent = progress(wish)
          return (
            <button key={wish.id} className="wish-saving-card" onClick={() => setSelected(wish)}>
              <span className="wish-saving-copy">
                <strong>{wish.name}</strong>
                <small>{status === 'none' ? `오늘 ${money(share)}원` : '오늘 기록 있음 · 더 모으기'}</small>
              </span>
              <span className="wish-saving-number">{percent}%</span>
              <span className="wish-saving-progress"><i style={{ width: `${percent}%` }} /></span>
            </button>
          )
        })}
      </div>
      {selected && (
        <WishSavingSheet
          wish={selected}
          today={today}
          events={events}
          availableAmount={Math.max(0, availableAmount)}
          close={() => setSelected(null)}
        />
      )}
    </section>
  )
}

function WishSavingSheet({ wish, today, events, availableAmount, close }: {
  wish: Wish
  today: string
  events: Awaited<ReturnType<typeof listWishEvents>>
  availableAmount: number
  close: () => void
}) {
  const share = dailyShare(wish, events, today)
  const capacity = Math.min(availableAmount, Math.max(0, wish.targetAmount - wish.savedAmount))
  const [amount, setAmount] = useState(Math.min(share || 5_000, capacity))
  const [saving, setSaving] = useState(false)
  const amountRef = useSheetFocus<HTMLInputElement>({ onMobile: false })
  useSheetViewport()

  const save = async () => {
    if (saving || amount <= 0 || amount > capacity) return
    setSaving(true)
    await deposit(wish.id, amount, today)
    close()
  }

  const skip = async () => {
    if (saving) return
    setSaving(true)
    await skipDay(wish.id, today)
    close()
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="expense-sheet wish-saving-sheet" role="dialog" aria-modal="true" aria-labelledby="wish-saving-title">
        <div className="sheet-handle" />
        <header>
          <div><p className="eyebrow">WISH SAVINGS</p><h2 id="wish-saving-title">{wish.name}</h2></div>
          <button className="icon-button" onClick={close} aria-label="닫기"><X size={20} /></button>
        </header>
        <div className="wish-saving-stepper">
          <button onClick={() => setAmount(Math.max(0, amount - 1_000))} aria-label="천 원 줄이기"><Minus size={18} /></button>
          <label>
            <span>저금할 금액</span>
            <div><input ref={amountRef} inputMode="numeric" value={money(amount)} onChange={(event) => {
              const digits = event.target.value.replace(/[^0-9]/g, '')
              setAmount(digits ? Math.min(capacity, Number(digits)) : 0)
            }} /><strong>원</strong></div>
          </label>
          <button onClick={() => setAmount(Math.min(capacity, amount + 1_000))} aria-label="천 원 늘리기"><Plus size={18} /></button>
        </div>
        <div className="wish-saving-meta">
          <span>오늘 하루 몫 <strong>{money(share)}원</strong></span>
          <span>남은 자유비용 <strong>{money(availableAmount)}원</strong></span>
        </div>
        <button className="save-button" disabled={saving || amount <= 0 || amount > capacity} onClick={save}>이만큼 모으기</button>
        <button className="wish-skip-button" disabled={saving} onClick={skip}>오늘은 못 모아요</button>
      </section>
    </div>
  )
}
