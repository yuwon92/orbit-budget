import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Clock3, Minus, Plus, ShoppingBag, Sparkles, Trash2, X } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import type { ReleasedLeftover } from '@orbit/budget-core/budget'
import type { Category } from '@orbit/budget-core/types'
import { XP } from '@orbit/wish-core/xp'
import { addDays, canPurchase, daysBetween, purchaseUnlockDate, remainingDays } from '@orbit/wish-core/wish'
import type { Wish } from '@orbit/wish-core/types'
import { ITEMS, isMandatory, type ItemCategory, type ItemId } from '@orbit/wish-core/items'
import { LEVEL_STEPS } from '@orbit/wish-core/xp'
import { LEVEL_REWARDS, MAX_REWARD_LEVEL } from '@orbit/wish-core/reward'
import { useSheetFocus, useSheetViewport } from '../lib/sheet'
import { CATEGORY_LABELS, ITEM_LABELS, RARITY_DOTS, RARITY_LABELS, SOURCE_LABELS } from '../lib/items'
import { previewProps, type EquippedItems } from '../lib/preview'
import { isChoiceItem, levelOfItem, summarizeReward, titleOfLevel } from '../lib/rewards'
import { pad2 } from '../lib/format'
import { PixelPlanet } from './PixelPlanet'

/**
 * 시트 껍데기. 시트를 `document.body`로 올린다.
 *
 * `.wl-content`가 `position: relative; z-index: 1`이라 쌓임 맥락을 만든다. 그 안에서
 * 연 시트는 `z-index: 60`을 줘도 그 맥락 안에서만 60이라, 바깥의 `.wl-hud`(20)보다
 * 아래로 깔린다 — 뒷면을 덮는 어두운 막이 HUD만 비껴가 자유비용·별가루 줄이 혼자
 * 밝게 남았다. App.tsx가 직접 여는 시트들은 `.wl-content` 바깥이라 원래 멀쩡했다.
 */
function SheetPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}

/** 미션 수행 시트. 하루 몫이 프리필된 상태로 열린다. */
export function CollectSheet({ wishName, dailyShare, availableAmount, onClose, onCollect, onSkip }: {
  wishName: string
  dailyShare: number
  availableAmount: number
  onClose: () => void
  onCollect: (amount: number) => void
  onSkip: () => void
}) {
  useSheetViewport()
  const [amount, setAmount] = useState(dailyShare || 5_000)
  const step = 1_000
  const full = dailyShare > 0 && amount >= dailyShare
  const gain = amount <= 0 ? 0 : full ? XP.share : XP.partial

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="wl-sheet" role="dialog" aria-modal="true" aria-labelledby="collect-title">
        <div className="sheet-handle" />
        <header className="sheet-header">
          <div>
            <span className="pixel-label">MISSION · DAILY SHARE</span>
            <h2 id="collect-title">{wishName}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        </header>

        <div className="amount-stepper">
          <button onClick={() => setAmount(Math.max(0, amount - step))} aria-label="천 원 줄이기"><Minus size={19} /></button>
          <div className="amount-input-wrap">
            <input
              className="amount-input"
              inputMode="numeric"
              aria-label="모을 금액"
              value={money(amount)}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
                const digits = event.target.value.replace(/[^0-9]/g, '')
                setAmount(digits ? Math.min(availableAmount, Number(digits)) : 0)
              }}
            />
            <span>원</span>
          </div>
          <button onClick={() => setAmount(Math.min(availableAmount, amount + step))} aria-label="천 원 늘리기"><Plus size={19} /></button>
        </div>

        <input
          className="amount-range"
          type="range"
          min="0"
          max={Math.max(availableAmount, 1)}
          step="1000"
          value={Math.min(amount, availableAmount)}
          onChange={(event) => setAmount(Number(event.target.value))}
        />
        <div className="amount-meta">
          <span>하루 몫 {money(dailyShare)}원</span>
          <span>남은 자유비용 {money(availableAmount)}원</span>
        </div>

        <p className="mission-gain">
          <span className="pixel-label">REWARD</span>
          <strong>+{gain} XP</strong>
          <span>{full ? '하루 몫 전액' : amount > 0 ? '부분 납입' : '금액 없음'}</span>
        </p>

        <button className="primary-button full" disabled={amount <= 0 || amount > availableAmount} onClick={() => onCollect(amount)}>
          이만큼 모으기
        </button>
        <button className="quiet-button full" onClick={onSkip}>오늘은 쉬어가기</button>
      </section>
    </div>
  )
}

/**
 * 어제 남은 예산을 어느 궤도에 넣을지 고르는 시트.
 *
 * 궤도를 고르는 것과 넣는 것을 나눈다 — 한 번 누르면 바로 확정되던 흐름은
 * 되돌릴 수단이 없어 잘못 누르면 그대로 들어간다.
 * 남은 자리(목표 − 모은 금액)보다 많이는 못 넣으므로 궤도마다 실제로 들어갈 금액을 함께 보여준다.
 */
export function CarryoverSheet({ amount, rows, wishes, onClose, onDeposit }: {
  amount: number
  rows: ReleasedLeftover[]
  wishes: Wish[]
  onClose: () => void
  onDeposit: (wishId: string, amount: number) => Promise<void>
}) {
  useSheetViewport()
  const [saving, setSaving] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const targets = wishes
    .filter((wish) => wish.status === 'active')
    .map((wish) => ({ wish, accepted: Math.min(amount, Math.max(0, wish.targetAmount - wish.savedAmount)) }))
  const chosen = targets.find((target) => target.wish.id === picked && target.accepted > 0)

  const submit = async () => {
    if (saving || !chosen) return
    setSaving(true)
    try { await onDeposit(chosen.wish.id, chosen.accepted) } finally { setSaving(false) }
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="wl-sheet" role="dialog" aria-modal="true" aria-labelledby="carryover-title">
        <div className="sheet-handle" />
        <header className="sheet-header">
          <div>
            <span className="pixel-label">MISSION · CARRYOVER</span>
            <h2 id="carryover-title">{money(amount)}원 저금하기</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        </header>

        {rows.length > 0 && (
          <ul className="carryover-source">
            {rows.map((row) => (
              <li key={`${row.categoryId}-${row.to}`}>
                <span>{row.categoryName}</span>
                <b>{money(row.leftover)}원</b>
              </li>
            ))}
            <li className="carryover-total">
              <span>합계</span>
              <b>{money(rows.reduce((sum, row) => sum + row.leftover, 0))}원</b>
            </li>
          </ul>
        )}

        <section className="resolve-cancel carryover-targets">
          {targets.map(({ wish, accepted }) => (
            <button
              key={wish.id}
              className={picked === wish.id ? 'picked' : ''}
              aria-pressed={picked === wish.id}
              disabled={saving || accepted <= 0}
              onClick={() => setPicked(wish.id)}
            >
              <span>
                <strong>{wish.name}</strong>
                <small>{accepted <= 0 ? '자리 없음' : `${money(wish.savedAmount)} / ${money(wish.targetAmount)}원`}</small>
              </span>
              <b>+{money(accepted)}원</b>
            </button>
          ))}
        </section>

        <button className="primary-button full" disabled={!chosen || saving} onClick={submit}>
          {chosen ? `${money(chosen.accepted)}원 저금하기` : '궤도 선택'}
        </button>

        <p className="mission-gain">
          <span className="pixel-label">REWARD</span>
          <strong>+{XP.carryover} XP</strong>
        </p>
      </section>
    </div>
  )
}

/** 목표 도달 뒤 구매·기다리기·정리를 한 자리에서 고르는 시트. */
export function ResolveWishSheet({ wish, today, categories, transferTargets, onClose, onPurchase, onWait, onCancel }: {
  wish: Wish
  today: string
  categories: Category[]
  transferTargets: Wish[]
  onClose: () => void
  onPurchase: (categoryId: string | null) => Promise<void>
  onWait: () => Promise<void>
  onCancel: (targetWishId: string | null) => Promise<void>
}) {
  useSheetViewport()
  const [categoryId, setCategoryId] = useState('')
  const [cancelMode, setCancelMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const unlocked = canPurchase(wish, today)
  const unlockDate = purchaseUnlockDate(wish)
  const daysLeft = Math.max(0, daysBetween(today, unlockDate))

  const run = async (action: () => Promise<void>) => {
    if (saving) return
    setSaving(true)
    try { await action() } finally { setSaving(false) }
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="wl-sheet resolve-sheet" role="dialog" aria-modal="true" aria-labelledby="resolve-title">
        <div className="sheet-handle" />
        <header className="sheet-header">
          <div><span className="pixel-label">ORBIT COMPLETE</span><h2 id="resolve-title">{wish.name}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        </header>
        <p className="resolve-summary"><strong>{money(wish.savedAmount)}원</strong>을 모두 모았다. 이제 어디로 보낼지 고르자.</p>

        {!cancelMode ? (
          <>
            <section className="resolve-option">
              <div><ShoppingBag size={19} /><p><strong>구매하기</strong><span>Orbit에 지출을 남기고 이 궤도를 완주한다.</span></p></div>
              <label>통계 카테고리 <em>선택 안 함이 기본</em>
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">미분류</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <button className="primary-button full" disabled={!unlocked || saving} onClick={() => run(() => onPurchase(categoryId || null))}>
                {unlocked ? '구매하고 완주하기' : `${daysLeft}일 뒤 구매 가능`}
              </button>
              {!unlocked && <small className="resolve-lock">등록일로부터 3일 동안 구매가 잠긴다 · {unlockDate} 해제</small>}
            </section>

            {wish.status === 'ready' && (
              <button className="resolve-choice" disabled={saving} onClick={() => run(onWait)}>
                <Clock3 size={19} /><span><strong>더 기다리기</strong><small>저금은 멈추고, 기다린 하루마다 미션을 이어간다.</small></span>
              </button>
            )}
            <button className="resolve-choice danger-choice" disabled={saving} onClick={() => setCancelMode(true)}>
              <Trash2 size={19} /><span><strong>이 위시 정리하기</strong><small>모은 금액을 다른 위시나 자유비용으로 보낸다.</small></span>
            </button>
          </>
        ) : (
          <section className="resolve-cancel">
            <div><button className="quiet-button" onClick={() => setCancelMode(false)}>← 돌아가기</button><h3>모은 금액을 어디로 보낼까?</h3><p>정리해도 지금까지의 XP는 그대로 남는다.</p></div>
            {transferTargets.map((target) => {
              const room = Math.max(0, target.targetAmount - target.savedAmount)
              return <button key={target.id} disabled={saving || room <= 0} onClick={() => run(() => onCancel(target.id))}>
                <span><strong>{target.name}</strong><small>최대 {money(room)}원 이전</small></span><b>{money(Math.min(room, wish.savedAmount))}원</b>
              </button>
            })}
            <button className="resolve-to-free" disabled={saving} onClick={() => run(() => onCancel(null))}>
              <span><strong>남은 자유비용으로 회수</strong><small>이번 달 자유비용에 전액 더한다.</small></span><b>+{money(wish.savedAmount)}원</b>
            </button>
          </section>
        )}
      </section>
    </div>
  )
}

/** 새 위시 등록과 이름·금액·기간 수정을 겸한다. */
export interface NewWishDraft {
  name: string
  targetAmount: number
  targetDate: string | null
}

export function WishSheet({ today, wish, creationMode = 'list', existingShare, freeAmount, canSchedule, onClose, onCreate, onUpdate, onDelete }: {
  today: string
  wish?: Wish
  creationMode?: 'orbit' | 'list'
  /** 이미 진행 중인 위시들의 하루 몫 합계 */
  existingShare: number
  /** 이번 달 남은 자유비용 */
  freeAmount: number
  /** 기간을 정할 슬롯이 남았는지. 없으면 기간 없는 위시로만 저장한다 */
  canSchedule: boolean
  onClose: () => void
  onCreate?: (draft: NewWishDraft) => void
  onUpdate?: (draft: NewWishDraft) => void
  onDelete?: () => void
}) {
  useSheetViewport()
  const editing = Boolean(wish)
  const nameInputRef = useSheetFocus<HTMLInputElement>()
  const [name, setName] = useState(wish?.name ?? '')
  const [amount, setAmount] = useState(wish ? String(wish.targetAmount) : '')
  const [period, setPeriod] = useState(wish?.targetDate ? String(remainingDays(wish, today) ?? '') : '')
  const [unit, setUnit] = useState<'day' | 'week' | 'month'>('day')
  const [scheduling, setScheduling] = useState(Boolean(wish?.targetDate) || creationMode === 'orbit')

  const targetDate = useMemo(() => {
    if (!scheduling) return null
    const count = Number(period)
    if (!Number.isInteger(count) || count < 1) return null
    if (!wish?.targetDate && unit === 'day' && count < 3) return null
    if (unit === 'month') {
      const date = new Date(`${today}T00:00:00`)
      date.setMonth(date.getMonth() + count)
      date.setDate(date.getDate() - 1)
      return date.toLocaleDateString('sv-SE')
    }
    // 오늘을 1일째로 센다. 3일이면 오늘·내일·모레의 정확히 세 칸이다.
    return addDays(today, count * (unit === 'week' ? 7 : 1) - 1)
  }, [period, scheduling, today, unit, wish?.targetDate])

  const targetAmount = Number(amount)
  const days = targetDate ? Math.max(1, daysBetween(today, targetDate) + 1) : null
  const remainingAmount = Math.max(0, targetAmount - (wish?.savedAmount ?? 0))
  const preview = days && targetAmount > 0 ? Math.floor(remainingAmount / days) : 0
  // 이미 진행 중인 몫 + 지금 만들 몫이 자유비용의 절반을 넘으면 기간 연장을 권한다
  const heavy = preview > 0 && freeAmount > 0 && (existingShare + preview) / freeAmount > 0.5

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    if (targetAmount <= 0) return
    if (wish && targetAmount < wish.savedAmount) return
    if (scheduling && !targetDate) return
    const draft = { name: name.trim(), targetAmount, targetDate }
    if (editing) onUpdate?.(draft)
    else onCreate?.(draft)
  }

  function remove() {
    if (!window.confirm('이 위시를 삭제할까요?\n모은 금액은 남은 자유비용으로 돌아갑니다.')) return
    onDelete?.()
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="wl-sheet" onSubmit={submit}>
        <div className="sheet-handle" />
        <header className="sheet-header">
          <div>
            <span className="pixel-label">{editing ? 'EDIT WISH' : 'NEW WISH'}</span>
            <h2>{editing ? '수정하기' : '새 소원 빌기'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        </header>

        <label>소원 이름<input ref={nameInputRef} value={name} onChange={(event) => setName(event.target.value)} placeholder="오래 생각해 본 것" /></label>
        <label>목표 금액
          <div className="input-with-unit">
            <input
              inputMode="numeric"
              aria-label="목표 금액"
              value={amount ? money(Number(amount)) : ''}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, '').slice(0, 9))}
              placeholder="200,000"
            />
            <span>원</span>
          </div>
        </label>
        {!scheduling && editing && (
          <button
            type="button"
            className="secondary-button full wish-to-orbit"
            disabled={!canSchedule}
            onClick={() => setScheduling(true)}
          >
            {canSchedule ? '궤도에 올리기' : '열린 궤도 슬롯 없음'}
          </button>
        )}

        {scheduling && (
          <>
            <fieldset>
              <legend>목표 기간</legend>
              <div className="period-editor">
                <input
                  inputMode="numeric"
                  aria-label="목표 기간 숫자"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="3일 이상"
                />
                <div className="period-unit-choice" aria-label="기간 단위">
                  {([['day', '일'], ['week', '주'], ['month', '월']] as const).map(([value, label]) => (
                    <button type="button" key={value} className={unit === value ? 'active' : ''} aria-pressed={unit === value} onClick={() => setUnit(value)}>{label}</button>
                  ))}
                </div>
              </div>
            </fieldset>

            <p className="mission-gain">
              <span className="pixel-label">DAILY SHARE</span>
              <strong>{preview ? `${money(preview)}원` : '—'}</strong>
              {days && <span>{days}일 궤도</span>}
            </p>

            {editing && !wish?.targetDate && (
              <button type="button" className="quiet-button full" onClick={() => { setScheduling(false); setPeriod('') }}>
                기간 없이 두기
              </button>
            )}
          </>
        )}

        {scheduling && !editing && heavy && (
          <p className="sheet-warning">
            하루 몫 합계 {money(existingShare + preview)}원 · 남은 자유비용의 절반 초과 · 기간 연장 권장
          </p>
        )}

        {scheduling && !wish?.targetDate && period && !targetDate && <p className="sheet-warning">목표 기간 최소 3일</p>}
        {wish && targetAmount < wish.savedAmount && <p className="sheet-warning">목표 금액 최소 {money(wish.savedAmount)}원 (지금까지 모은 금액)</p>}

        <button
          className="primary-button full"
          type="submit"
          disabled={targetAmount <= 0 || scheduling && !targetDate || Boolean(wish && targetAmount < wish.savedAmount)}
        >
          {editing
            ? scheduling && !wish?.targetDate ? '궤도에 올리기' : '변경사항 저장'
            : creationMode === 'orbit' ? '궤도에 올리기' : '위시에 추가'}
        </button>
        {editing && (
          <section className="edit-wish-danger">
            <button type="button" className="delete-wish-button" onClick={remove}><Trash2 size={16} /> 위시 삭제</button>
          </section>
        )}
      </form>
    </div>
  )
}

/**
 * 아이템 한 장 시트. 상점과 꾸미기가 같은 것을 쓴다.
 *
 * 한 시트가 네 상태를 모두 답한다 — 살 수 있는가 · 어디서 얻는가 · 장착했는가 ·
 * 지금 장착하면 어떻게 보이는가. 상점 전용 시트와 꾸미기 전용 시트를 나누면 같은
 * 아이템을 두 화면에서 다르게 설명하게 된다.
 *
 * **미리보기는 지금 장착한 모습에 이 아이템만 얹은 그림이다.** 아직 사지 않은 것도
 * 크게 볼 수 있어야 살지 말지를 정할 수 있다(스펙 §6 「상점에서 본 모습과 장착한 뒤
 * 모습이 달라선 안 된다」).
 *
 * 구매해도 시트를 닫지 않는다. `owned`가 뒤집히며 버튼이 바로 「장착」으로 바뀐다 —
 * 사고 나서 꾸미기를 다시 찾아 들어가지 않게.
 */
export function ItemSheet({ itemId, items, owned, stardust, onBuy, onEquip, onUnequip, onClose }: {
  itemId: ItemId
  /** 지금 장착 상태. 미리보기와 「장착 중」 판정에 함께 쓴다 */
  items: EquippedItems
  owned: boolean
  stardust: number
  onBuy: (itemId: ItemId) => void
  onEquip: (category: ItemCategory, itemId: ItemId) => void
  onUnequip: (category: ItemCategory) => void
  onClose: () => void
}) {
  useSheetViewport()
  const def = ITEMS[itemId]
  const label = ITEM_LABELS[itemId]
  const category = def.category
  const equipped = items[category] === itemId
  const forSale = def.source === 'shop'
  const price = def.price ?? 0
  const after = stardust - price
  const poor = after < 0
  const level = levelOfItem(itemId)

  return (
    <SheetPortal>
      <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <section className="wl-sheet" role="dialog" aria-modal="true" aria-labelledby="item-title">
          <div className="sheet-handle" />
          <header className="sheet-header">
            <div>
              <span className="pixel-label">{owned ? 'ITEM · OWNED' : forSale ? 'ITEM · FOR SALE' : 'ITEM · LOCKED'}</span>
              <h2 id="item-title">{label.name}</h2>
            </div>
            <button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button>
          </header>

          <div className="purchase-preview">
            <PixelPlanet {...previewProps(items, itemId, 132)} />
            <p className="item-sheet-meta">
              <i style={{ background: RARITY_DOTS[def.rarity] }} aria-hidden="true" />
              {CATEGORY_LABELS[category].name} · {RARITY_LABELS[def.rarity]} · {label.detail}
            </p>
          </div>

          {/* 미보유 + 판매 중이면 값을, 아니면 어디서 얻는지를 답한다 */}
          {!owned && forSale && (
            <ul className="purchase-rows">
              <li><span>보유 별가루</span><strong>{money(stardust)}</strong></li>
              <li><span>가격</span><strong>−{money(price)}</strong></li>
              <li className="total"><span>구매 후 잔액</span><strong>{money(after)}</strong></li>
            </ul>
          )}
          {!owned && !forSale && (
            <p className="item-sheet-source">
              <span className="pixel-label">HOW TO GET</span>
              <strong>
                {level !== undefined
                  ? `Lv.${level} 「${titleOfLevel(level)}」`
                  : SOURCE_LABELS[def.source]}
              </strong>
              <span>
                {level !== undefined
                  ? isChoiceItem(itemId) ? '레벨 보상에서 여러 종 중 하나로 선택' : '레벨 보상으로 확정 지급'
                  : def.source === 'region' ? '신규 지역 해금 뒤 획득' : '상자 개봉으로 확률 획득'}
              </span>
            </p>
          )}

          {owned ? (
            equipped ? (
              <>
                <p className="item-sheet-state">장착 중</p>
                {!isMandatory(category) && (
                  <button className="secondary-button full" onClick={() => onUnequip(category)}>장착 해제</button>
                )}
              </>
            ) : (
              <button className="primary-button full" onClick={() => onEquip(category, itemId)}>
                <Sparkles size={16} /> 장착
              </button>
            )
          ) : forSale ? (
            <button className="primary-button full" disabled={poor} onClick={() => onBuy(itemId)}>
              <ShoppingBag size={16} /> {poor ? `별가루 ${money(-after)} 부족` : `별가루 ${money(price)}개로 구매`}
            </button>
          ) : null}

          <button className="quiet-button full" onClick={onClose}>닫기</button>
        </section>
      </div>
    </SheetPortal>
  )
}

/**
 * 앞으로 받을 레벨 보상표. 관측소의 「다음 보상」 카드를 누르면 열린다.
 *
 * 카드 하나는 바로 다음 보상만 말해 준다 — 지금 모으는 XP가 무엇으로 돌아오는지
 * 보려면 그 앞을 한 번에 볼 수 있어야 한다(§9 보상 미리보기).
 *
 * **이미 지난 레벨은 넣지 않는다.** 받은 것은 보유 목록과 꾸미기에 이미 있고, 여기에
 * 같이 늘어놓으면 스무 줄 중 어디가 지금인지 찾아야 한다.
 *
 * 필요 XP는 `LEVEL_STEPS`의 누적값이다 — 레벨업 판정과 같은 표를 읽어야 화면이
 * 말한 문턱과 실제 문턱이 어긋나지 않는다.
 */
export function LevelRoadmapSheet({ level, totalXp, onClose }: {
  level: number
  totalXp: number
  onClose: () => void
}) {
  useSheetViewport()
  const rows = []
  for (let next = level + 1; next <= MAX_REWARD_LEVEL; next += 1) {
    const reward = LEVEL_REWARDS[next]
    if (reward) rows.push({ reward, need: LEVEL_STEPS[next - 1] ?? 0 })
  }

  return (
    <SheetPortal>
      <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <section className="wl-sheet roadmap-sheet" role="dialog" aria-modal="true" aria-labelledby="roadmap-title">
          <div className="sheet-handle" />
          <header className="sheet-header">
            <div>
              <span className="pixel-label">LEVEL REWARDS</span>
              <h2 id="roadmap-title">앞으로의 보상</h2>
            </div>
            <button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button>
          </header>

          <p className="roadmap-now">
            현재 Lv.{pad2(level)} · 누적 {totalXp.toLocaleString('ko-KR')} XP
          </p>

          {rows.length === 0 ? (
            <p className="shop-empty">Lv.{MAX_REWARD_LEVEL} 도달 · 보상표 끝</p>
          ) : (
            <ol className="roadmap-list">
              {rows.map(({ reward, need }) => (
                <li key={reward.level}>
                  <div className="roadmap-head">
                    <span className="pixel-label">LV. {pad2(reward.level)}</span>
                    <span>{Math.max(0, need - totalXp).toLocaleString('ko-KR')} XP 남음</span>
                  </div>
                  <strong>{titleOfLevel(reward.level)}</strong>
                  <span>{summarizeReward(reward)}</span>
                  <small>누적 {need.toLocaleString('ko-KR')} XP</small>
                </li>
              ))}
            </ol>
          )}

          <button className="quiet-button full" onClick={onClose}>닫기</button>
        </section>
      </div>
    </SheetPortal>
  )
}
