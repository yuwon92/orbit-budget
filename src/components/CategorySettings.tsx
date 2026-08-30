import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { CATEGORY_PALETTE, db } from '../lib/db'
import { money } from '../lib/format'
import { useCategories } from '../lib/hooks'
import type { Category } from '../lib/types'
import { CategoryPlanet } from './CategoryPlanet'

function CategoryForm({ category, close }: { category: Category | null; close: () => void }) {
  const [name, setName] = useState(category?.name ?? '')
  const [budget, setBudget] = useState(category?.monthlyBudget ? String(category.monthlyBudget) : '')
  const [color, setColor] = useState(category?.color ?? CATEGORY_PALETTE[0])
  const [isFixed, setIsFixed] = useState(category?.isFixed ?? false)
  const canSave = name.trim().length > 0

  const save = async () => {
    const data = {
      name: name.trim(),
      monthlyBudget: budget ? Number(budget) : 0,
      color,
      isFixed,
    }
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

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="expense-sheet">
        <div className="sheet-handle" />
        <header>
          <div>
            <p className="eyebrow">CATEGORY</p>
            <h2>{category ? '카테고리 수정' : '카테고리 추가'}</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="닫기"><X size={20} /></button>
        </header>
        <div className="form-fields">
          <label className="form-field">
            <span>이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 식비" autoFocus />
          </label>
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
          {canSave ? '저장' : '이름을 입력하세요'}
        </button>
        {category && <button className="delete-button" onClick={remove}>카테고리 삭제</button>}
      </section>
    </div>
  )
}

export function CategorySettings({ back }: { back: () => void }) {
  const categories = useCategories()
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
        {categories?.map((c) => (
          <button className="setting-row" key={c.id} onClick={() => setEditing(c)}>
            <CategoryPlanet color={c.color} />
            <div>
              <strong>
                {c.name}
                {c.isFixed && <em className="fixed-chip">고정비</em>}
              </strong>
              <small>{c.monthlyBudget > 0 ? `월 예산 ${money(c.monthlyBudget)}원` : '예산 미설정'}</small>
            </div>
            <ChevronRight size={18} />
          </button>
        ))}
        {categories && categories.length === 0 && (
          <p className="empty-note">카테고리가 없어요. 첫 카테고리를 추가해보세요.</p>
        )}
      </section>
      {editing && <CategoryForm category={editing === 'new' ? null : editing} close={() => setEditing(null)} />}
    </div>
  )
}
