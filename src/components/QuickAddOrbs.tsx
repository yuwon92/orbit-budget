import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { inQuickSlot, quickAddAmount, quickSlotCategories } from '../lib/budget'
import { db, moveQuickSlot, setQuickSlot } from '../lib/db'
import { money } from '../lib/format'
import { useCategories } from '../lib/hooks'
import { CategoryPlanet } from './CategoryPlanet'

export interface QuickPreset {
  categoryId: string
  amount?: number // 단가가 없는 카테고리는 금액을 비워 시트를 연다
}

/**
 * 홈 히어로 카드 아래 퀵 슬롯 줄.
 * 교통은 누르면 편도 요금이 바로 오늘 지출로 들어가고(왕복이면 두 번 누른다),
 * 횟수는 지출 시트를 그 카테고리·단가로 채워서 연다.
 * 교통을 잘못 눌렀으면 잠시 표시되는 알림에서 방금 추가한 거래를 취소할 수 있다.
 * 편집에서 어떤 카테고리를 띄울지와 구슬이 놓이는 순서를 바꾼다.
 */
export function QuickAddOrbs({
  openPreset,
  goCategories,
}: {
  openPreset: (preset: QuickPreset) => void
  goCategories: () => void
}) {
  const categoryResult = useCategories()
  const categories = categoryResult ?? []
  const [editingSlots, setEditingSlots] = useState(false)
  const [undo, setUndo] = useState<{ transactionId: string; categoryName: string; amount: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!editingSlots) return
    const closeEditor = (e: KeyboardEvent) => e.key === 'Escape' && setEditingSlots(false)
    window.addEventListener('keydown', closeEditor)
    return () => window.removeEventListener('keydown', closeEditor)
  }, [editingSlots])

  const slots = quickSlotCategories(categories)
  const orbs = slots.map((category) => ({ category, amount: quickAddAmount(category.budgetRule) }))
  // 편집 목록은 표시 중인 슬롯을 실제 구슬 순서대로 위에 두고, 숨긴 카테고리를 뒤에 붙인다.
  const editList = [...slots, ...categories.filter((c) => !inQuickSlot(c))]

  if (categoryResult === undefined) return null

  const addNow = async (categoryId: string, categoryName: string, amount: number) => {
    const transactionId = crypto.randomUUID()
    await db.transactions.add({
      id: transactionId,
      date: format(new Date(), 'yyyy-MM-dd'),
      amount,
      type: 'expense',
      categoryId,
      memo: '',
      isPlanned: false,
      createdAt: Date.now(),
    })
    setUndo({ transactionId, categoryName, amount })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setUndo(null), 5000)
  }

  const undoAdd = async () => {
    if (!undo) return
    const { transactionId } = undo
    setUndo(null)
    clearTimeout(timer.current)
    await db.transactions.delete(transactionId)
  }

  return (
    <>
      <section className="quick-section" aria-labelledby="quick-section-title">
        <header className="quick-section-head">
          <h2 id="quick-section-title">퀵 슬롯</h2>
          {categories.length > 0 && <button
            className="quick-edit-button"
            aria-expanded={editingSlots}
            aria-controls="quick-slot-editor"
            onClick={() => setEditingSlots(!editingSlots)}
          >{editingSlots ? '완료' : '편집'}</button>}
        </header>

        {editingSlots && <div className="quick-slot-editor" id="quick-slot-editor">
          <p>홈에 표시할 카테고리를 선택하고, 화살표로 순서를 바꾸세요.</p>
          <ul className="quick-slot-list">
            {editList.map((category) => {
              const active = inQuickSlot(category)
              const index = slots.findIndex((c) => c.id === category.id)
              return <li key={category.id}>
                <button aria-pressed={active} onClick={() => setQuickSlot(categories, category, !active)}>
                  <span className="quick-toggle-planet"><span className="orb" style={{ '--category-color': category.color } as CSSProperties}/></span>
                  <strong>{category.name}</strong>
                  <span className="quick-toggle-state"><i className={active ? 'on' : ''}/>{active ? '표시 중' : '숨김'}</span>
                </button>
                {active && <span className="quick-slot-move">
                  <button
                    disabled={index === 0}
                    onClick={() => moveQuickSlot(categories, category.id, -1)}
                    aria-label={`${category.name} 앞으로 옮기기`}
                  ><ChevronUp size={17}/></button>
                  <button
                    disabled={index === slots.length - 1}
                    onClick={() => moveQuickSlot(categories, category.id, 1)}
                    aria-label={`${category.name} 뒤로 옮기기`}
                  ><ChevronDown size={17}/></button>
                </span>}
              </li>
            })}
          </ul>
        </div>}

        {orbs.length > 0 && <div className="quick-add" role="group" aria-label="빠른 거래 기록">
          {orbs.map(({ category, amount }) => {
            // 교통만 한 번 눌러 바로 기록한다. 나머지는 시트를 열어 금액을 확인·수정한다.
            const oneTap = category.budgetRule?.kind === 'commute' && amount !== null
            const actionLabel = oneTap
              ? `${category.name} ${money(amount)}원 즉시 기록`
              : amount === null
                ? `${category.name} 금액 입력 열기`
                : `${category.name} ${money(amount)}원 입력 열기`
            return (
              <button
                className="quick-orb"
                key={category.id}
                onClick={() =>
                  oneTap
                    ? addNow(category.id, category.name, amount)
                    : openPreset({ categoryId: category.id, amount: amount ?? undefined })
                }
                aria-label={actionLabel}
              >
                <CategoryPlanet color={category.color} />
                <span className="quick-orb-copy">
                  <strong>{category.name}</strong>
                  <small>{amount === null ? '직접 입력' : `${money(amount)}원`}</small>
                </span>
              </button>
            )
          })}
        </div>}

        {orbs.length === 0 && !editingSlots && <div className="quick-empty">
          <strong>{categories.length > 0 ? '퀵 슬롯이 비어 있어요' : '먼저 카테고리를 만들어 주세요'}</strong>
          <p>{categories.length > 0 ? '자주 쓰는 카테고리를 홈에 추가할 수 있어요.' : '카테고리를 만든 뒤 퀵 슬롯에 추가할 수 있어요.'}</p>
          <button onClick={categories.length > 0 ? () => setEditingSlots(true) : goCategories}>
            {categories.length > 0 ? '퀵 슬롯 설정' : '카테고리 관리'}
          </button>
        </div>}
      </section>
      {undo && <div className="quick-undo-toast">
        <span role="status" aria-live="polite">{undo.categoryName} {money(undo.amount)}원 기록됨</span>
        <button onClick={undoAdd} aria-label={`${undo.categoryName} ${money(undo.amount)}원 기록 실행 취소`}>실행 취소</button>
      </div>}
    </>
  )
}
