import { useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { money } from '@orbit/budget-core/format'

interface DepositSheetProps {
  wishName: string
  dailyShare: number
  availableAmount: number
  onClose: () => void
  onDeposit: (amount: number) => void
  onSkip: () => void
}

export function DepositSheet({ wishName, dailyShare, availableAmount, onClose, onDeposit, onSkip }: DepositSheetProps) {
  const [amount, setAmount] = useState(dailyShare)
  const step = 1_000

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="deposit-sheet" role="dialog" aria-modal="true" aria-labelledby="deposit-title">
        <div className="sheet-handle" />
        <header className="sheet-header">
          <div><span className="pixel-label">TODAY'S SHARE</span><h2 id="deposit-title">{wishName}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        </header>

        <div className="amount-stepper">
          <button onClick={() => setAmount(Math.max(0, amount - step))} aria-label="천 원 줄이기"><Minus size={19} /></button>
          <div className="amount-input-wrap">
            <input
              className="amount-input"
              inputMode="numeric"
              aria-label="모을 금액"
              value={money(amount)}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '')
                setAmount(digits ? Math.min(availableAmount, Number(digits)) : 0)
              }}
            />
            <span>원</span>
          </div>
          <button onClick={() => setAmount(Math.min(availableAmount, amount + step))} aria-label="천 원 늘리기"><Plus size={19} /></button>
        </div>
        <div className="amount-meta"><span>오늘 몫 {money(dailyShare)}원</span><span>가능 {money(availableAmount)}원</span></div>
        <input className="amount-range" type="range" min="0" max={Math.max(availableAmount, 1)} step="1" value={Math.min(amount, availableAmount)} onChange={(event) => setAmount(Number(event.target.value))} />

        <button className="primary-button full" disabled={amount <= 0 || amount > availableAmount} onClick={() => onDeposit(amount)}>이만큼 모으기</button>
        <button className="quiet-button full" onClick={onSkip}>오늘 쉬어가기</button>
      </section>
    </div>
  )
}
