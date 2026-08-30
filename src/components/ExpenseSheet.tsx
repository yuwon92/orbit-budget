import { useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '../lib/db'
import { money } from '../lib/format'
import { useCategories } from '../lib/hooks'
import { CategoryPlanet } from './CategoryPlanet'

export function ExpenseSheet({ close }: { close: () => void }) {
  const categories = useCategories() ?? []
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const selected = selectedId ?? categories[0]?.id ?? null
  const formatted = amount ? money(Number(amount)) : '0'
  const canSave = Number(amount) > 0 && (type === 'income' || selected !== null)

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    await db.transactions.add({
      id: crypto.randomUUID(),
      date,
      amount: Number(amount),
      type,
      categoryId: type === 'expense' ? selected : null,
      memo: memo.trim(),
      // 미래 날짜로 입력하면 예정 거래로 저장한다.
      isPlanned: date > format(new Date(), 'yyyy-MM-dd'),
      createdAt: Date.now(),
    })
    close()
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="expense-sheet">
        <div className="sheet-handle" />
        <header>
          <div>
            <p className="eyebrow">NEW TRANSACTION</p>
            <h2>{type === 'expense' ? '지출 추가' : '수입 추가'}</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="닫기"><X size={20} /></button>
        </header>
        <div className="type-toggle">
          <button className={type === 'expense' ? 'active' : ''} onClick={() => setType('expense')}>지출</button>
          <button className={type === 'income' ? 'active' : ''} onClick={() => setType('income')}>수입</button>
        </div>
        <label className="amount-input">
          <span>금액</span>
          <div>
            <input autoFocus inputMode="numeric" value={formatted} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
            <strong>원</strong>
          </div>
        </label>
        {type === 'expense' && <>
          <div className="field-label">카테고리</div>
          <div className="category-pills">
            {categories.map((c) => (
              <button key={c.id} className={selected === c.id ? 'selected' : ''} onClick={() => setSelectedId(c.id)}>
                <CategoryPlanet color={c.color} />{c.name}
              </button>
            ))}
          </div>
        </>}
        <div className="simple-fields">
          <label className="date-field">
            <CalendarDays size={18} />
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <label>
            <input placeholder="메모 추가 (선택)" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>
        </div>
        <button className="save-button" onClick={save} disabled={!canSave || saving}>
          {canSave ? `${formatted}원 저장` : '금액을 입력하세요'}
        </button>
      </section>
    </div>
  )
}
