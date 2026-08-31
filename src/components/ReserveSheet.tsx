import { useState } from 'react'
import { X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { db } from '../lib/db'
import { money } from '../lib/format'

/**
 * 이번 달 예비비 입력. 예비비는 오늘 예산 계산에서 미리 떼어두는 금액이라
 * 달마다 따로 저장한다(MonthSettings).
 */
export function ReserveSheet({ month, current, close }: { month: string; current: number; close: () => void }) {
  const [amount, setAmount] = useState(current ? String(current) : '')
  const [saving, setSaving] = useState(false)
  const value = Number(amount) || 0

  const save = async () => {
    if (saving) return
    setSaving(true)
    await db.monthSettings.put({ yearMonth: month, reserveAmount: value })
    close()
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="expense-sheet">
        <div className="sheet-handle" />
        <header>
          <div>
            <p className="eyebrow">RESERVE</p>
            <h2>{format(parseISO(`${month}-01`), 'yyyy년 M월')} 예비비</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="닫기"><X size={20} /></button>
        </header>
        <div className="form-fields">
          <label className="form-field">
            <span>예비비</span>
            <div className="budget-input">
              <input
                autoFocus
                inputMode="numeric"
                value={amount ? money(value) : ''}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
              />
              <strong>원</strong>
            </div>
          </label>
          <p className="field-note">
            비상금이나 아직 계획하지 않은 지출에 대비해 떼어두는 금액이에요.
            이 금액을 뺀 나머지로 오늘 예산을 계산해요. 0이면 떼어두지 않아요.
          </p>
        </div>
        <button className="save-button" onClick={save} disabled={saving}>
          {value > 0 ? `${money(value)}원 저장` : '예비비 없이 저장'}
        </button>
      </section>
    </div>
  )
}
