import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import { activeRecurringForCategory, budgetFromRule } from '../lib/budget'
import { CATEGORY_PALETTE, db } from '../lib/db'
import { money } from '../lib/format'
import { useCategories } from '../lib/hooks'
import { useSheetFocus, useSheetViewport } from '../lib/sheet'
import type { BudgetRule, Category, Frequency } from '../lib/types'
import { CategoryPlanet } from './CategoryPlanet'

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

const METHODS: { id: BudgetRule['kind']; label: string }[] = [
  { id: 'manual', label: '직접 입력' },
  { id: 'perUse', label: '횟수' },
  { id: 'commute', label: '교통' },
  { id: 'recurringSum', label: '구독 합계' },
]

/** [1,2,3,4,5] -> "월~금", [1,3,5] -> "월·수·금". 연속 3개 이상이면 물결표로 줄인다. */
function formatWeekdays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b)
  const runs: number[][] = []
  for (const day of sorted) {
    const last = runs[runs.length - 1]
    if (last && day === last[last.length - 1] + 1) last.push(day)
    else runs.push([day])
  }
  return runs
    .map((run) =>
      run.length >= 3
        ? `${WEEKDAY_NAMES[run[0]]}~${WEEKDAY_NAMES[run[run.length - 1]]}`
        : run.map((d) => WEEKDAY_NAMES[d]).join('·'),
    )
    .join('·')
}

/** 주기를 사람이 읽는 문구로. 단위는 횟수형이면 "회", 교통형이면 "일". */
function describeFrequency(freq: Frequency, unit: '회' | '일'): string {
  if (freq.mode === 'perWeek') return `주 ${freq.timesPerWeek}${unit}`
  const days = formatWeekdays(freq.weekdays)
  return freq.timesPerDay > 1 ? `${days} 하루 ${freq.timesPerDay}회` : days
}

/** 카테고리 목록에 붙는 짧은 꼬리표. 직접 입력이면 붙이지 않는다. */
function describeRule(rule: BudgetRule | undefined, ruleCount: number): string | null {
  if (!rule || rule.kind === 'manual') return null
  switch (rule.kind) {
    case 'perUse':
      return `한 번에 ${money(rule.unitAmount)}원 ${describeFrequency(rule.freq, '회')}`
    case 'commute':
      return `편도 ${money(rule.fare)}원${rule.roundTrip ? ' 왕복' : ''} ${describeFrequency(rule.freq, '일')}`
    case 'recurringSum':
      return `반복 거래 ${ruleCount}건 합계`
  }
}

function CategoryForm({ category, close }: { category: Category | null; close: () => void }) {
  const month = format(new Date(), 'yyyy-MM')
  const rules = useLiveQuery(() => db.recurringRules.toArray(), []) ?? []
  const saved = category?.budgetRule
  const savedFreq = saved && (saved.kind === 'perUse' || saved.kind === 'commute') ? saved.freq : null

  const [name, setName] = useState(category?.name ?? '')
  const [color, setColor] = useState(category?.color ?? CATEGORY_PALETTE[0])
  const [isFixed, setIsFixed] = useState(category?.isFixed ?? false)
  const [kind, setKind] = useState<BudgetRule['kind']>(saved?.kind ?? 'manual')
  const [budget, setBudget] = useState(category?.monthlyBudget ? String(category.monthlyBudget) : '')
  const [unitAmount, setUnitAmount] = useState(
    saved?.kind === 'perUse' ? String(saved.unitAmount) : saved?.kind === 'commute' ? String(saved.fare) : '',
  )
  const [roundTrip, setRoundTrip] = useState(saved?.kind === 'commute' ? saved.roundTrip : true)
  // 주 횟수와 요일은 각각 따로 들고 있어서, 주기를 오갔다 와도 골라둔 값이 남는다.
  const [freqMode, setFreqMode] = useState<Frequency['mode']>(savedFreq?.mode ?? 'perWeek')
  const [timesPerWeek, setTimesPerWeek] = useState(
    savedFreq?.mode === 'perWeek' ? String(savedFreq.timesPerWeek) : '',
  )
  const [weekdays, setWeekdays] = useState<number[]>(
    savedFreq?.mode === 'weekdays' ? savedFreq.weekdays : [],
  )
  const [timesPerDay, setTimesPerDay] = useState(
    savedFreq?.mode === 'weekdays' ? String(savedFreq.timesPerDay) : '1',
  )
  // 폼이 길어서 좁은 화면에서는 키보드를 바로 띄우지 않는다.
  const nameRef = useSheetFocus<HTMLInputElement>({ onMobile: false })
  useSheetViewport()

  // 목록과 합계는 같은 함수에서 나와야 서로 어긋나지 않는다.
  const catRules = useMemo(
    () => (category ? activeRecurringForCategory(rules, category.id, month) : []),
    [rules, category, month],
  )
  const recurringSum = catRules.reduce((sum, r) => sum + r.amount, 0)

  const freq: Frequency =
    freqMode === 'perWeek'
      ? { mode: 'perWeek', timesPerWeek: Number(timesPerWeek) || 0 }
      : { mode: 'weekdays', weekdays, timesPerDay: Number(timesPerDay) || 0 }

  const rule: BudgetRule =
    kind === 'perUse'
      ? { kind: 'perUse', unitAmount: Number(unitAmount) || 0, freq }
      : kind === 'commute'
        ? { kind: 'commute', fare: Number(unitAmount) || 0, roundTrip, freq }
        : kind === 'recurringSum'
          ? { kind: 'recurringSum' }
          : { kind: 'manual' }

  const computed = budgetFromRule(rule, month, recurringSum)
  const monthlyBudget = kind === 'manual' ? Number(budget) || 0 : computed ?? 0

  const usesFrequency = kind === 'perUse' || kind === 'commute'
  const needsWeekdays = usesFrequency && freqMode === 'weekdays'
  const missingWeekdays = needsWeekdays && weekdays.length === 0
  const canSave = name.trim().length > 0 && !missingWeekdays

  const basis = usesFrequency
    ? [
        kind === 'perUse'
          ? `한 번에 ${money(Number(unitAmount) || 0)}원`
          : `편도 ${money(Number(unitAmount) || 0)}원${roundTrip ? ' 왕복' : ''}`,
        describeFrequency(freq, kind === 'perUse' ? '회' : '일'),
      ].join(' · ')
    : ''

  const toggleWeekday = (day: number) =>
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)))

  const save = async () => {
    if (!canSave) return
    const data = { name: name.trim(), monthlyBudget, color, isFixed, budgetRule: rule }
    if (category) {
      await db.categories.update(category.id, data)
    } else {
      const existing = await db.categories.toArray()
      const sortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1
      await db.categories.add({ id: crypto.randomUUID(), sortOrder, ...data })
    }
    close()
  }

  const remove = async () => {
    if (!category) return
    if (!window.confirm(`'${category.name}' 카테고리를 삭제할까요?\n이 카테고리의 거래는 미분류로 바뀌어요.`)) return
    await db.transaction('rw', db.categories, db.transactions, async () => {
      await db.transactions.where('categoryId').equals(category.id).modify({ categoryId: null })
      await db.categories.delete(category.id)
    })
    close()
  }

  const numberField = (value: string, set: (v: string) => void, suffix: string, placeholder: string) => (
    <div className="budget-input">
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 2))}
        placeholder={placeholder}
      />
      <strong>{suffix}</strong>
    </div>
  )

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="expense-sheet">
        <div className="sheet-top">
          <div className="sheet-handle" />
          <header>
            <div>
              <p className="eyebrow">CATEGORY</p>
              <h2>{category ? '카테고리 수정' : '카테고리 추가'}</h2>
            </div>
            <button className="icon-button" onClick={close} aria-label="닫기"><X size={20} /></button>
          </header>
        </div>
        <div className="form-fields">
          <label className="form-field">
            <span>이름</span>
            <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 식비" />
          </label>

          <div className="form-field">
            <span>예산 정하는 방법</span>
            <div className="filter-pills method-pills">
              {METHODS.map((m) => (
                <button key={m.id} className={kind === m.id ? 'selected' : ''} onClick={() => setKind(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {kind === 'manual' && (
            <label className="form-field">
              <span>월 예산</span>
              <div className="budget-input">
                <input
                  inputMode="numeric"
                  value={budget ? money(Number(budget)) : ''}
                  onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))}
                  placeholder="0이면 예산 미설정"
                />
                <strong>원</strong>
              </div>
            </label>
          )}

          {usesFrequency && (
            <>
              <label className="form-field">
                <span>{kind === 'perUse' ? '한 번에 얼마' : '편도 요금'}</span>
                <div className="budget-input">
                  <input
                    inputMode="numeric"
                    value={unitAmount ? money(Number(unitAmount)) : ''}
                    onChange={(e) => setUnitAmount(e.target.value.replace(/\D/g, ''))}
                    placeholder="0"
                  />
                  <strong>원</strong>
                </div>
              </label>
              <div className="form-field">
                <span>얼마나 자주</span>
                <div className="type-toggle freq-toggle">
                  <button className={freqMode === 'perWeek' ? 'active' : ''} onClick={() => setFreqMode('perWeek')}>
                    {kind === 'perUse' ? '주 횟수로' : '주 며칠로'}
                  </button>
                  <button className={freqMode === 'weekdays' ? 'active' : ''} onClick={() => setFreqMode('weekdays')}>
                    요일로
                  </button>
                </div>
                {freqMode === 'perWeek' ? (
                  <div className="freq-body">
                    {kind === 'perUse'
                      ? numberField(timesPerWeek, setTimesPerWeek, '회', '주 몇 회')
                      : numberField(timesPerWeek, setTimesPerWeek, '일', '주 며칠')}
                  </div>
                ) : (
                  <div className="freq-body">
                    <div className="weekday-row">
                      {WEEKDAY_NAMES.map((label, i) => (
                        <button
                          key={label}
                          className={weekdays.includes(i) ? 'selected' : ''}
                          onClick={() => toggleWeekday(i)}
                          aria-pressed={weekdays.includes(i)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {kind === 'perUse' && (
                      <label className="inline-field">
                        <span>하루 몇 회</span>
                        {numberField(timesPerDay, setTimesPerDay, '회', '1')}
                      </label>
                    )}
                    {missingWeekdays && <p className="field-note">요일을 하나 이상 골라주세요.</p>}
                  </div>
                )}
              </div>
              {kind === 'commute' && (
                <button className="fixed-toggle" onClick={() => setRoundTrip(!roundTrip)}>
                  <div>
                    <strong>왕복으로 계산</strong>
                    <small>편도 요금을 하루 두 번으로 칩니다.</small>
                  </div>
                  <i className={`toggle ${roundTrip ? 'on' : ''}`}><b /></i>
                </button>
              )}
            </>
          )}

          {kind === 'recurringSum' && (
            <div className="form-field">
              <span>이 카테고리의 반복 지출</span>
              {catRules.length === 0 ? (
                <p className="field-note">
                  {category
                    ? '이 카테고리로 지정된 반복 거래가 없어요. 설정 → 반복 거래에서 추가하면 예산이 저절로 잡혀요.'
                    : '카테고리를 먼저 저장한 뒤, 반복 거래에서 이 카테고리를 지정하세요.'}
                </p>
              ) : (
                <div className="rule-sum-list">
                  {catRules.map((r) => (
                    <div key={r.id}>
                      <span>{r.name}</span>
                      <strong>{money(r.amount)}원</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {kind !== 'manual' && (
            <div className="calc-result">
              <strong>월 예산 {money(monthlyBudget)}원</strong>
              {basis && <small>{basis}</small>}
              {kind === 'recurringSum' && <small>반복 거래를 고치면 이 예산도 따라 바뀌어요.</small>}
            </div>
          )}

          <div className="form-field">
            <span>색상</span>
            <div className="swatch-row">
              {CATEGORY_PALETTE.map((c) => (
                <button
                  key={c}
                  className={`swatch ${color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`색상 ${c}`}
                />
              ))}
            </div>
          </div>
          <button className="fixed-toggle" onClick={() => setIsFixed(!isFixed)}>
            <div>
              <strong>고정비</strong>
              <small>매달 나가는 지출이에요. 자유 예산 계산에서 미리 빼둬요.</small>
            </div>
            <i className={`toggle ${isFixed ? 'on' : ''}`}><b /></i>
          </button>
        </div>
        <button className="save-button" onClick={save} disabled={!canSave}>
          {!name.trim() ? '이름을 입력하세요' : missingWeekdays ? '요일을 골라주세요' : '저장'}
        </button>
        {category && <button className="delete-button" onClick={remove}>카테고리 삭제</button>}
      </section>
    </div>
  )
}

export function CategorySettings({ back }: { back: () => void }) {
  const categories = useCategories()
  const rules = useLiveQuery(() => db.recurringRules.toArray(), []) ?? []
  const month = format(new Date(), 'yyyy-MM')
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  return (
    <div className="view">
      <div className="page-heading">
        <div>
          <button className="back-button" onClick={back}><ChevronLeft size={16} /> 설정</button>
          <h1>카테고리 관리</h1>
          <p>카테고리별 월 예산과 색상을 설정하세요.</p>
        </div>
        <button className="outline-button" onClick={() => setEditing('new')}><Plus size={17} /> 카테고리 추가</button>
      </div>
      <section className="settings-card category-manage">
        {categories?.map((c) => {
          const tail = describeRule(c.budgetRule, activeRecurringForCategory(rules, c.id, month).length)
          return (
            <button className="setting-row" key={c.id} onClick={() => setEditing(c)}>
              <CategoryPlanet color={c.color} />
              <div>
                <strong>
                  {c.name}
                  {c.isFixed && <em className="fixed-chip">고정비</em>}
                </strong>
                <small>
                  {c.monthlyBudget > 0 ? `월 예산 ${money(c.monthlyBudget)}원` : '예산 미설정'}
                  {tail && ` · ${tail}`}
                </small>
              </div>
              <ChevronRight size={18} />
            </button>
          )
        })}
        {categories && categories.length === 0 && (
          <p className="empty-note">카테고리가 없어요. 첫 카테고리를 추가해보세요.</p>
        )}
      </section>
      {editing && <CategoryForm category={editing === 'new' ? null : editing} close={() => setEditing(null)} />}
    </div>
  )
}
