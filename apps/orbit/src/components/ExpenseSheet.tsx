import { useState } from 'react'
import { CalendarDays, Pencil, Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { reserveSpentAmount } from '../lib/budget'
import { db } from '../lib/db'
import { money } from '../lib/format'
import { useCategories } from '../lib/hooks'
import { useSheetFocus, useSheetViewport } from '../lib/sheet'
import type { Category, Transaction } from '../lib/types'
import type { QuickPreset } from './QuickAddOrbs'
import { CategoryPlanet } from './CategoryPlanet'
import { CategoryForm } from './CategorySettings'

/**
 * transaction이 있으면 수정, 없으면 새 거래 추가.
 * preset은 홈 퀵 슬롯 구슬에서 넘어온 카테고리·단가로, 금액칸만 고쳐 저장하면 된다.
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
  const categoryList = useCategories()
  const categories = categoryList ?? []
  // 카테고리 편집 모드와, 위에 띄울 추가·수정 시트
  const [editMode, setEditMode] = useState(false)
  const [formFor, setFormFor] = useState<Category | 'new' | null>(null)
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
  const [fromReserve, setFromReserve] = useState(editing?.fromReserve ?? false)
  const [saving, setSaving] = useState(false)
  const amountRef = useSheetFocus<HTMLInputElement>()
  useSheetViewport()

  // 예비비는 달마다 따로 있다. 고른 날짜가 속한 달의 예비비를 본다.
  const month = date.slice(0, 7)
  const reserveInfo = useLiveQuery(async () => {
    const [settings, monthTx] = await Promise.all([
      db.monthSettings.get(month),
      db.transactions.where('date').startsWith(month).toArray(),
    ])
    // 수정 중인 거래는 빼고 센다 — 이 거래를 넣기 전 남은 예비비를 보여준다
    const others = editing ? monthTx.filter((t) => t.id !== editing.id) : monthTx
    const reserve = settings?.reserveAmount ?? 0
    return { reserve, remaining: reserve - reserveSpentAmount(others, month) }
  }, [month, editing?.id])
  // 예비비가 없는 달에도 토글은 보인다 — 숨기면 기능이 없는 줄 안다. 대신 켤 수 없게 막고,
  // 이미 예비비로 기록된 거래는 끌 수 있게 남긴다.
  const hasReserve = (reserveInfo?.reserve ?? 0) > 0
  const reserveLocked = !hasReserve && !fromReserve
  const usingReserve = type === 'expense' && fromReserve

  // 고르지 않으면 그대로 미분류로 저장한다. 첫 카테고리를 임의로 채우지 않는다.
  // 편집 중 고른 카테고리를 지웠으면 선택도 풀린다 — 없는 카테고리로 저장하지 않게
  const selected = categoryList && selectedId && !categoryList.some((c) => c.id === selectedId) ? null : selectedId
  const formatted = amount ? money(Number(amount)) : '0'
  const canSave = Number(amount) > 0

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const data = {
      date,
      amount: Number(amount),
      type,
      // 예비비 지출은 카테고리 없이 기록한다. 카테고리 카드 진행률에 잡히지 않게.
      categoryId: type === 'expense' && !usingReserve ? selected : null,
      fromReserve: usingReserve,
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

  return (<>
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="expense-sheet">
        <div className="sheet-top">
          <div className="sheet-handle" />
          <header>
            <div>
              <p className="eyebrow">{editing ? 'EDIT TRANSACTION' : 'NEW TRANSACTION'}</p>
              <h2>{type === 'expense' ? '지출' : '수입'} {editing ? '수정' : '추가'}</h2>
            </div>
            <button className="icon-button" onClick={close} aria-label="닫기"><X size={20} /></button>
          </header>
        </div>
        <div className="type-toggle">
          <button className={type === 'expense' ? 'active' : ''} onClick={() => setType('expense')}>지출</button>
          <button className={type === 'income' ? 'active' : ''} onClick={() => setType('income')}>수입</button>
        </div>
        <label className="amount-input">
          <span>금액</span>
          <div>
            <input
              ref={amountRef}
              inputMode="numeric"
              value={formatted}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            />
            <strong>원</strong>
          </div>
        </label>
        {type === 'expense' && !usingReserve && <>
          <div className="field-label category-label">
            <span>카테고리 <em className="field-optional">고르지 않으면 미분류</em></span>
            <button className="text-button" onClick={() => setEditMode(!editMode)}>{editMode ? '완료' : '편집'}</button>
          </div>
          <div className={`category-pills${editMode ? ' editing' : ''}`}>
            {categories.map((c) => (
              // 평소엔 선택, 한 번 더 누르면 선택이 풀린다(미분류로 되돌릴 방법이 이것뿐이다).
              // 편집 모드에서는 누르면 수정 시트가 열린다.
              <button
                key={c.id}
                className={selected === c.id ? 'selected' : ''}
                aria-pressed={editMode ? undefined : selected === c.id}
                onClick={() => editMode ? setFormFor(c) : setSelectedId(selected === c.id ? null : c.id)}
              >
                <CategoryPlanet color={c.color} />{c.name}
                {editMode && <Pencil size={12} className="pill-edit" aria-label="수정" />}
              </button>
            ))}
            <button className="add-pill" onClick={() => setFormFor('new')}><Plus size={15} />추가</button>
          </div>
        </>}
        {type === 'expense' && <button className="fixed-toggle reserve-toggle" onClick={() => setFromReserve(!fromReserve)} aria-pressed={fromReserve} disabled={reserveLocked}>
          <div>
            <strong>예비비에서 사용</strong>
            <small>{hasReserve
              ? `남은 예비비 ${money(reserveInfo?.remaining ?? 0)} / ${money(reserveInfo?.reserve ?? 0)}원`
              : '이번 달 예비비 없음'}</small>
          </div>
          <i className={`toggle ${fromReserve ? 'on' : ''}`}><b /></i>
        </button>}
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
    {/* 지출 시트 바깥에 띄운다. 배경의 backdrop-filter가 안쪽 fixed 요소의 기준을 바꿔서 안에 두면 시트가 엉뚱한 곳에 뜬다 */}
    {formFor && <CategoryForm
      category={formFor === 'new' ? null : formFor}
      close={() => setFormFor(null)}
      // 새로 만든 카테고리는 바로 고른다
      onSaved={(id) => formFor === 'new' && setSelectedId(id)}
    />}
  </>)
}
