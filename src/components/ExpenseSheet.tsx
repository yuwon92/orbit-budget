import { useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '../lib/db'
import { money } from '../lib/format'
import { useCategories } from '../lib/hooks'
import type { Transaction } from '../lib/types'
import type { QuickPreset } from './QuickAddOrbs'
import { CategoryPlanet } from './CategoryPlanet'

/**
 * transaction이 있으면 수정, 없으면 새 거래 추가.
 * preset은 홈 빠른 기록 구슬에서 넘어온 카테고리·단가로, 금액칸만 고쳐 저장하면 된다.
 */
export function ExpenseSheet({
  transaction,
  preset,
  initialDate,
  close,
}: {
  transaction?: Transaction | null
  preset?: QuickPreset
  initialDate?: string
  close: () => void
}) {
  const categories = useCategories() ?? []
  const editing = transaction ?? null
  const [type, setType] = useState<'expense' | 'income'>(editing?.type ?? 'expense')
  const [amount, setAmount] = useState(
    editing ? String(editing.amount) : preset?.amount ? String(preset.amount) : '',
  )
  const [selectedId, setSelectedId] = useState<string | null>(
    editing?.categoryId ?? preset?.categoryId ?? null,
  )
  const [date, setDate] = useState(() => editing?.date ?? initialDate ?? format(new Date(), 'yyyy-MM-dd'))
  const [memo, setMemo] = useState(editing?.memo ?? '')
  const [saving, setSaving] = useState(false)

  const selected = selectedId ?? categories[0]?.id ?? null
  const formatted = amount ? money(Number(amount)) : '0'
  const canSave = Number(amount) > 0 && (type === 'income' || selected !== null)

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const data = {
      date,
      amount: Number(amount),
      type,
      categoryId: type === 'expense' ? selected : null,
      memo: memo.trim(),
      // 미래 날짜면 예정 거래로 둔다.
      isPlanned: date > format(new Date(), 'yyyy-MM-dd'),
    }
    if (editing) {
      // createdAt과 recurringRuleId는 그대로 둔다 (정렬 기준과 반복 규칙 연결 유지).
      await db.transactions.update(editing.id, data)
    } else {
      await db.transactions.add({ id: crypto.randomUUID(), createdAt: Date.now(), ...data })
    }
    close()
  }

  const remove = async () => {
    if (!editing) return
    if (!window.confirm(`이 ${editing.type === 'income' ? '수입' : '지출'} 내역을 삭제할까요?`)) return
    await db.transactions.delete(editing.id)
    close()
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="expense-sheet">
        <div className="sheet-handle" />
        <header>
          <div>
            <p className="eyebrow">{editing ? 'EDIT TRANSACTION' : 'NEW TRANSACTION'}</p>
            <h2>{type === 'expense' ? '지출' : '수입'} {editing ? '수정' : '추가'}</h2>
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
            <input
              autoFocus
              inputMode="numeric"
              value={formatted}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            />
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
        {editing?.recurringRuleId && <p className="field-note sheet-note">
          반복 거래에서 자동으로 만들어진 내역이에요. 여기서 고친 값은 이 달에만 적용되고,
          반복 규칙을 수정하면 아직 안 지난 예정 내역은 규칙대로 다시 만들어져요.
        </p>}
        <button className="save-button" onClick={save} disabled={!canSave || saving}>
          {canSave ? `${formatted}원 저장` : '금액을 입력하세요'}
        </button>
        {editing && <button className="delete-button" onClick={remove}>내역 삭제</button>}
      </section>
    </div>
  )
}
