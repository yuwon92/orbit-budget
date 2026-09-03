import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ArrowRight, Check, CircleDollarSign, ShieldCheck, Tags, X } from 'lucide-react'
import { format } from 'date-fns'
import { monthlyFreeAmount } from '../lib/budget'
import { db } from '../lib/db'
import { money } from '../lib/format'
import { useSheetViewport } from '../lib/sheet'
import { CategoryPlanet } from './CategoryPlanet'

const STEP_COPY = [
  { icon: CircleDollarSign, eyebrow: 'STEP 1', title: '이번 달 수입', desc: '월급이나 용돈처럼 이번 달에 쓸 수 있는 돈을 알려주세요.' },
  { icon: Tags, eyebrow: 'STEP 2', title: '카테고리 예산', desc: '먼저 떼어둘 생활비를 항목별로 나눠주세요.' },
  { icon: ShieldCheck, eyebrow: 'STEP 3', title: '예비비와 확인', desc: '남겨둘 돈을 정하고 이번 달 계획을 확인하세요.' },
] as const

export function Onboarding({ close, finish }: { close: () => void; finish: () => void }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const month = today.slice(0, 7)
  const setup = useLiveQuery(async () => {
    const [categories, transactions, monthSettings] = await Promise.all([
      db.categories.toArray(),
      db.transactions.where('date').startsWith(month).toArray(),
      db.monthSettings.get(month),
    ])
    return {
      categories: categories.sort((a, b) => a.sortOrder - b.sortOrder),
      transactions,
      reserve: monthSettings?.reserveAmount ?? 0,
    }
  }, [month])
  const [step, setStep] = useState(0)
  const [income, setIncome] = useState('')
  const [budgets, setBudgets] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<string[]>([])
  const [reserve, setReserve] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [saving, setSaving] = useState(false)
  useSheetViewport()

  useEffect(() => {
    if (!setup || initialized) return
    setBudgets(Object.fromEntries(setup.categories.map((category) => [
      category.id,
      category.monthlyBudget > 0 ? String(category.monthlyBudget) : '',
    ])))
    setReserve(setup.reserve > 0 ? String(setup.reserve) : '')
    setInitialized(true)
  }, [setup, initialized])

  const existingIncome = useMemo(
    () => setup?.transactions
      .filter((transaction) => transaction.type === 'income')
      .reduce((sum, transaction) => sum + transaction.amount, 0) ?? 0,
    [setup],
  )
  const addedIncome = Number(income) || 0
  const reserveAmount = Number(reserve) || 0
  const draftCategories = useMemo(() => (setup?.categories ?? []).map((category) => ({
    ...category,
    monthlyBudget: Number(budgets[category.id]) || 0,
  })), [setup, budgets])
  const totalBudget = draftCategories.reduce((sum, category) => sum + category.monthlyBudget, 0)
  const previewTransactions = useMemo(() => {
    if (!setup || addedIncome === 0) return setup?.transactions ?? []
    return [...setup.transactions, {
      id: 'onboarding-preview',
      date: today,
      amount: addedIncome,
      type: 'income' as const,
      categoryId: null,
      memo: '이번 달 수입',
      isPlanned: false,
      createdAt: 0,
    }]
  }, [setup, addedIncome, today])
  const freeAmount = monthlyFreeAmount(previewTransactions, draftCategories, today, reserveAmount)
  const current = STEP_COPY[step]
  const CurrentIcon = current.icon

  const updateBudget = (categoryId: string, value: string) => {
    setBudgets((currentBudgets) => ({ ...currentBudgets, [categoryId]: value.replace(/\D/g, '') }))
    setTouched((currentTouched) => currentTouched.includes(categoryId)
      ? currentTouched
      : [...currentTouched, categoryId])
  }

  const save = async () => {
    if (!setup || saving) return
    setSaving(true)
    try {
      await db.transaction('rw', db.transactions, db.categories, db.monthSettings, async () => {
        if (addedIncome > 0) {
          await db.transactions.add({
            id: crypto.randomUUID(),
            date: today,
            amount: addedIncome,
            type: 'income',
            categoryId: null,
            memo: '이번 달 수입',
            isPlanned: false,
            createdAt: Date.now(),
          })
        }
        await Promise.all(touched.map((categoryId) => db.categories.update(categoryId, {
          monthlyBudget: Number(budgets[categoryId]) || 0,
          budgetRule: { kind: 'manual' },
        })))
        await db.monthSettings.put({ yearMonth: month, reserveAmount })
      })
      finish()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <header className="onboarding-header">
          <div className="onboarding-brand"><span className="logo-orbit"><i /></span><strong>orbit 시작하기</strong></div>
          <button className="icon-button" onClick={close} aria-label="나중에 설정하기"><X size={20} /></button>
        </header>

        <div className="onboarding-progress" aria-label={`${step + 1}/3 단계`}>
          {STEP_COPY.map((item, index) => <i key={item.eyebrow} className={index <= step ? 'active' : ''} />)}
        </div>

        {!setup || !initialized ? <div className="onboarding-loading">예산 정보를 불러오는 중이에요.</div> : <>
          <div className="onboarding-title">
            <span><CurrentIcon size={22} /></span>
            <div><p className="eyebrow">{current.eyebrow}</p><h1 id="onboarding-title">{current.title}</h1><p>{current.desc}</p></div>
          </div>

          <div className="onboarding-body">
            {step === 0 && <>
              {existingIncome > 0 && <div className="onboarding-existing"><span>이미 기록된 이번 달 수입</span><strong>{money(existingIncome)}원</strong></div>}
              <label className="onboarding-money-field">
                <span>{existingIncome > 0 ? '추가할 수입' : '이번 달 수입'}</span>
                <div><input inputMode="numeric" value={income ? money(addedIncome) : ''} onChange={(event) => setIncome(event.target.value.replace(/\D/g, ''))} placeholder="0" /><strong>원</strong></div>
              </label>
              <p className="onboarding-help">매달 같은 날 들어오는 수입은 설정의 반복 거래에서 자동으로 기록할 수 있어요.</p>
            </>}

            {step === 1 && <>
              <div className="onboarding-category-list">
                {setup.categories.map((category) => <label key={category.id}>
                  <span className="onboarding-category-name"><CategoryPlanet color={category.color} /><strong>{category.name}</strong></span>
                  <span className="onboarding-inline-money"><input aria-label={`${category.name} 월 예산`} inputMode="numeric" value={budgets[category.id] ? money(Number(budgets[category.id])) : ''} onChange={(event) => updateBudget(category.id, event.target.value)} placeholder="0" /><b>원</b></span>
                </label>)}
              </div>
              <p className="onboarding-help">여기서 입력한 금액은 직접 입력 예산으로 저장돼요. 횟수·교통 계산은 카테고리 관리에서 더 자세히 설정할 수 있어요.</p>
            </>}

            {step === 2 && <>
              <label className="onboarding-money-field compact">
                <span>이번 달 예비비 <em>선택</em></span>
                <div><input inputMode="numeric" value={reserve ? money(reserveAmount) : ''} onChange={(event) => setReserve(event.target.value.replace(/\D/g, ''))} placeholder="0" /><strong>원</strong></div>
              </label>
              <p className="onboarding-help">비상금이나 아직 계획하지 않은 지출을 위해 미리 남겨두는 돈이에요.</p>
              <div className="onboarding-summary">
                <div><span>이번 달 수입</span><strong>{money(existingIncome + addedIncome)}원</strong></div>
                <div><span>카테고리 예산</span><strong>− {money(totalBudget)}원</strong></div>
                <div><span>예비비</span><strong>− {money(reserveAmount)}원</strong></div>
                <div className="onboarding-free"><span>남은 자유비용</span><strong className={freeAmount < 0 ? 'negative' : ''}>{money(freeAmount)}원</strong></div>
              </div>
              <div className="onboarding-next-guide"><Check size={16} /><p><strong>앞으로는 지출할 때만 기록하세요.</strong><span>+ 버튼이나 홈의 퀵 슬롯을 사용하면 남은 금액이 바로 반영돼요.</span></p></div>
            </>}
          </div>
        </>}

        <footer className="onboarding-actions">
          {step > 0 ? <button className="onboarding-back" onClick={() => setStep(step - 1)}><ArrowLeft size={17} /> 이전</button> : <button className="onboarding-later" onClick={close}>나중에</button>}
          {step < 2
            ? <button className="onboarding-next" onClick={() => setStep(step + 1)} disabled={!setup}><span>{step === 0 && existingIncome + addedIncome === 0 ? '수입 없이 다음' : '다음'}</span><ArrowRight size={17} /></button>
            : <button className="onboarding-next" onClick={save} disabled={!setup || saving}>{saving ? '저장 중…' : '예산 설정 완료'} <Check size={17} /></button>}
        </footer>
      </section>
    </div>
  )
}
