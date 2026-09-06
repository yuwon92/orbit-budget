import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import { weekdayCountInMonth } from '../lib/budget'
import { db } from '../lib/db'
import { formatWeekdays, money, WEEKDAY_NAMES } from '../lib/format'
import { useCategories } from '../lib/hooks'
import { useSheetFocus, useSheetViewport } from '../lib/sheet'
import { deleteRule, materializeRecurring, resyncRuleForMonth, syncRuleBudgets } from '../lib/recurring'
import type { RecurringRule } from '../lib/types'
import { CategoryPlanet } from './CategoryPlanet'

const todayStr = () => format(new Date(), 'yyyy-MM-dd')

/** 목록 한 줄에 붙는 주기 문구. 주기가 없는 예전 규칙은 월 단위로 본다. */
function describeCycle(rule: Pick<RecurringRule, 'interval' | 'dayOfMonth' | 'weekdays'>): string {
  if (rule.interval !== 'weekly') return `매달 ${rule.dayOfMonth}일`
  const days = rule.weekdays ?? []
  // 하나면 "매주 화요일", 여러 개면 "매주 월·수·금"
  return days.length === 1 ? `매주 ${formatWeekdays(days)}요일` : `매주 ${formatWeekdays(days)}`
}

function RuleForm({ rule, close }: { rule: RecurringRule | null; close: () => void }) {
  const categories = useCategories() ?? []
  const [type, setType] = useState<'expense' | 'income'>(rule?.type ?? 'expense')
  const [name, setName] = useState(rule?.name ?? '')
  const [amount, setAmount] = useState(rule?.amount ? String(rule.amount) : '')
  // 주기를 오갈 수 있으므로 날짜와 요일은 따로 들고 있는다.
  const [cycle, setCycle] = useState<'monthly' | 'weekly'>(rule?.interval ?? 'monthly')
  const [day, setDay] = useState(rule ? String(rule.dayOfMonth) : '')
  const [weekdays, setWeekdays] = useState<number[]>(rule?.weekdays ?? [])
  const [categoryId, setCategoryId] = useState<string | null>(rule?.categoryId ?? null)
  const [startDate, setStartDate] = useState(rule?.startDate ?? todayStr())
  const [endDate, setEndDate] = useState(rule?.endDate ?? '')
  const [saving, setSaving] = useState(false)
  // 폼이 길어서 좁은 화면에서는 키보드를 바로 띄우지 않는다.
  const nameRef = useSheetFocus<HTMLInputElement>({ onMobile: false })
  useSheetViewport()

  const selected = categoryId ?? categories[0]?.id ?? null
  const dayNum = Number(day)
  const validDay = dayNum >= 1 && dayNum <= 31
  // 주 단위는 고른 요일 수와 달에 따라 횟수가 갈린다. 이번 달 기준으로 몇 번인지 미리 알려준다.
  const weeklyCount = weekdayCountInMonth(weekdays, todayStr().slice(0, 7))
  const toggleWeekday = (day: number) =>
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)))
  const canSave =
    name.trim().length > 0 && Number(amount) > 0 && (cycle === 'weekly' ? weekdays.length > 0 : validDay)

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const data = {
      name: name.trim(),
      amount: Number(amount),
      type,
      categoryId: type === 'expense' ? selected : null,
      interval: cycle,
      // 주 단위는 며칠을 안 쓰지만, 주기를 월 단위로 되돌릴 때를 위해 자리는 남겨둔다.
      dayOfMonth: validDay ? dayNum : 1,
      weekdays: cycle === 'weekly' ? weekdays : undefined,
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
    // 구독 합계로 예산을 잡아둔 카테고리가 있으면 바로 반영한다.
    await syncRuleBudgets(todayStr().slice(0, 7))
    close()
  }

  const remove = async () => {
    if (!rule) return
    if (!window.confirm(`'${rule.name}' 반복 거래를 삭제할까요?\n이번 달의 아직 안 지난 예정 거래도 함께 지워져요.`)) return
    await deleteRule(rule.id, todayStr())
    await syncRuleBudgets(todayStr().slice(0, 7))
    close()
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="expense-sheet">
        <div className="sheet-top">
          <div className="sheet-handle" />
          <header>
            <div>
              <p className="eyebrow">RECURRING</p>
              <h2>{rule ? '반복 거래 수정' : '반복 거래 추가'}</h2>
            </div>
            <button className="icon-button" onClick={close} aria-label="닫기"><X size={20} /></button>
          </header>
        </div>
        <div className="type-toggle">
          <button className={type === 'expense' ? 'active' : ''} onClick={() => setType('expense')}>지출</button>
          <button className={type === 'income' ? 'active' : ''} onClick={() => setType('income')}>수입</button>
        </div>
        <div className="form-fields">
          <label className="form-field">
            <span>이름</span>
            <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 넷플릭스, 용돈" />
          </label>
          <div className="form-field">
            <span>반복 주기</span>
            <div className="type-toggle freq-toggle">
              <button className={cycle === 'monthly' ? 'active' : ''} onClick={() => setCycle('monthly')}>월 단위</button>
              <button className={cycle === 'weekly' ? 'active' : ''} onClick={() => setCycle('weekly')}>주 단위</button>
            </div>
          </div>
          <div className="field-pair">
            <label className="form-field">
              <span>금액</span>
              <div className="budget-input">
                <input inputMode="numeric" value={amount ? money(Number(amount)) : ''} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0" />
                <strong>원</strong>
              </div>
            </label>
            {cycle === 'monthly' && <label className="form-field">
              <span>매달 며칠</span>
              <div className="budget-input">
                <input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="1~31" />
                <strong>일</strong>
              </div>
            </label>}
          </div>
          {cycle === 'weekly' && <div className="form-field">
            <span>매주 무슨 요일</span>
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
            {weekdays.length > 0 && <p className="field-note">
              이번 달에는 {weeklyCount}번, 모두 {money(Number(amount) * weeklyCount)}원이 나가요.
            </p>}
          </div>}
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
    // 월 단위를 날짜순으로 먼저, 주 단위를 요일순으로 뒤에.
    async () =>
      (await db.recurringRules.toArray()).sort((a, b) => {
        const byCycle = Number(a.interval === 'weekly') - Number(b.interval === 'weekly')
        if (byCycle !== 0) return byCycle
        return a.interval === 'weekly'
          ? (a.weekdays?.[0] ?? 0) - (b.weekdays?.[0] ?? 0)
          : a.dayOfMonth - b.dayOfMonth
      }),
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
          <p>매달 정해진 날짜나 매주 정해진 요일에 예정 거래가 자동으로 만들어져요.</p>
        </div>
        <button className="outline-button" onClick={() => setEditing('new')}><Plus size={17} /> 반복 거래 추가</button>
      </div>
      <section className="settings-card category-manage">
        {rules?.map((rule) => {
          const cat = rule.categoryId ? catMap.get(rule.categoryId) : undefined
          const income = rule.type === 'income'
          return (
            <button className="setting-row" key={rule.id} onClick={() => setEditing(rule)}>
              <CategoryPlanet color={income ? '#83dad8' : cat?.color ?? '#9aa3b4'} />
              <div>
                <strong>{rule.name}{income && <em className="income-chip">수입</em>}</strong>
                <small>{describeCycle(rule)} · {money(rule.amount)}원{!income && ` · ${cat?.name ?? '미분류'}`}</small>
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
