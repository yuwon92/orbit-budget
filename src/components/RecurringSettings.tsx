import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '../lib/db'
import { money } from '../lib/format'
import { useCategories } from '../lib/hooks'
import { deleteRule, materializeRecurring, resyncRuleForMonth } from '../lib/recurring'
import type { RecurringRule } from '../lib/types'
import { CategoryPlanet } from './CategoryPlanet'

const todayStr = () => format(new Date(), 'yyyy-MM-dd')

function RuleForm({ rule, close }: { rule: RecurringRule | null; close: () => void }) {
  const categories = useCategories() ?? []
  const [type, setType] = useState<'expense' | 'income'>(rule?.type ?? 'expense')
  const [name, setName] = useState(rule?.name ?? '')
  const [amount, setAmount] = useState(rule?.amount ? String(rule.amount) : '')
  const [day, setDay] = useState(rule ? String(rule.dayOfMonth) : '')
  const [categoryId, setCategoryId] = useState<string | null>(rule?.categoryId ?? null)
  const [startDate, setStartDate] = useState(rule?.startDate ?? todayStr())
  const [endDate, setEndDate] = useState(rule?.endDate ?? '')
  const [saving, setSaving] = useState(false)

  const selected = categoryId ?? categories[0]?.id ?? null
  const dayNum = Number(day)
  const canSave = name.trim().length > 0 && Number(amount) > 0 && dayNum >= 1 && dayNum <= 31

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const data = {
      name: name.trim(),
      amount: Number(amount),
      type,
      categoryId: type === 'expense' ? selected : null,
      dayOfMonth: dayNum,
      startDate,
      endDate: endDate || null,
    }
    if (rule) {
      await db.recurringRules.update(rule.id, data)
      await resyncRuleForMonth(rule.id, todayStr())
    } else {
      await db.recurringRules.add({ id: crypto.randomUUID(), lastGeneratedMonth: null, ...data })
      await materializeRecurring(todayStr())
    }
    close()
  }

  const remove = async () => {
    if (!rule) return
    if (!window.confirm(`'${rule.name}' 반복 거래를 삭제할까요?\n이번 달의 아직 안 지난 예정 거래도 함께 지워져요.`)) return
    await deleteRule(rule.id, todayStr())
    close()
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="expense-sheet">
        <div className="sheet-handle" />
        <header>
          <div>
            <p className="eyebrow">RECURRING</p>
            <h2>{rule ? '반복 거래 수정' : '반복 거래 추가'}</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="닫기"><X size={20} /></button>
        </header>
        <div className="type-toggle">
          <button className={type === 'expense' ? 'active' : ''} onClick={() => setType('expense')}>지출</button>
          <button className={type === 'income' ? 'active' : ''} onClick={() => setType('income')}>수입</button>
        </div>
        <div className="form-fields">
          <label className="form-field">
            <span>이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 넷플릭스, 용돈" autoFocus />
          </label>
          <div className="field-pair">
            <label className="form-field">
              <span>금액</span>
              <div className="budget-input">
                <input inputMode="numeric" value={amount ? money(Number(amount)) : ''} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0" />
                <strong>원</strong>
              </div>
            </label>
            <label className="form-field">
              <span>매달 며칠</span>
              <div className="budget-input">
                <input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="1~31" />
                <strong>일</strong>
              </div>
            </label>
          </div>
          {type === 'expense' && <div className="form-field">
            <span>카테고리</span>
            <div className="category-pills">
              {categories.map((c) => (
                <button key={c.id} className={selected === c.id ? 'selected' : ''} onClick={() => setCategoryId(c.id)}>
                  <CategoryPlanet color={c.color} />{c.name}
                </button>
              ))}
            </div>
          </div>}
          <div className="field-pair">
            <label className="form-field">
              <span>시작일</span>
              <input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
            </label>
            <label className="form-field">
              <span>종료일 (선택)</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>
        </div>
        <button className="save-button" onClick={save} disabled={!canSave || saving}>저장</button>
        {rule && <button className="delete-button" onClick={remove}>반복 거래 삭제</button>}
      </section>
    </div>
  )
}

export function RecurringSettings({ back }: { back: () => void }) {
  const categories = useCategories() ?? []
  const rules = useLiveQuery(
    async () => (await db.recurringRules.toArray()).sort((a, b) => a.dayOfMonth - b.dayOfMonth),
    [],
  )
  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null)
  const catMap = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="view">
      <div className="page-heading">
        <div>
          <button className="back-button" onClick={back}><ChevronLeft size={16} /> 설정</button>
          <h1>반복 거래</h1>
          <p>매달 정해진 날짜에 예정 거래가 자동으로 만들어져요.</p>
        </div>
        <button className="outline-button" onClick={() => setEditing('new')}><Plus size={17} /> 반복 거래 추가</button>
      </div>
      <section className="settings-card category-manage">
        {rules?.map((rule) => {
          const cat = rule.categoryId ? catMap.get(rule.categoryId) : undefined
          const income = rule.type === 'income'
          return (
            <button className="setting-row" key={rule.id} onClick={() => setEditing(rule)}>
              <CategoryPlanet color={income ? '#83dad8' : cat?.color ?? '#a8aebb'} />
              <div>
                <strong>{rule.name}{income && <em className="income-chip">수입</em>}</strong>
                <small>매달 {rule.dayOfMonth}일 · {money(rule.amount)}원{!income && ` · ${cat?.name ?? '미분류'}`}</small>
              </div>
              <ChevronRight size={18} />
            </button>
          )
        })}
        {rules && rules.length === 0 && (
          <p className="empty-note">반복 거래가 없어요. 구독료나 정기 수입을 등록해보세요.</p>
        )}
      </section>
      {editing && <RuleForm rule={editing === 'new' ? null : editing} close={() => setEditing(null)} />}
    </div>
  )
}
