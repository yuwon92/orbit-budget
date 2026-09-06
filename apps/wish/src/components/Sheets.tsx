import { useMemo, useState, type FormEvent } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { money } from '@orbit/budget-core/format'
import { XP } from '@orbit/wish-core/xp'
import { addDays, daysBetween, seedFromId } from '@orbit/wish-core/wish'
import type { Wish } from '@orbit/wish-core/types'

/** 미션 수행 시트. 하루 몫이 프리필된 상태로 열린다. */
export function CollectSheet({ wishName, dailyShare, availableAmount, onClose, onCollect, onSkip }: {
  wishName: string
  dailyShare: number
  availableAmount: number
  onClose: () => void
  onCollect: (amount: number) => void
  onSkip: () => void
}) {
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
 * 새 위시 등록과 이름 수정을 겸한다.
 * 목표 금액·기간 수정은 회수 흐름이 걸려 있어 다음 단계로 미룬다.
 */
export function WishSheet({ today, wish, onClose, onCreate, onRename }: {
  today: string
  wish?: Wish
  onClose: () => void
  onCreate?: (wish: Wish) => void
  onRename?: (name: string) => void
}) {
  const editing = Boolean(wish)
  const [name, setName] = useState(wish?.name ?? '')
  const [amount, setAmount] = useState(wish ? String(wish.targetAmount) : '')
  const [period, setPeriod] = useState('')
  const [unit, setUnit] = useState<'day' | 'week' | 'month'>('day')

  const targetDate = useMemo(() => {
    if (wish) return wish.targetDate
    const count = Number(period)
    if (!Number.isInteger(count) || count < 1) return null
    if (unit === 'month') {
      const date = new Date(`${today}T00:00:00`)
      date.setMonth(date.getMonth() + count)
      return date.toLocaleDateString('sv-SE')
    }
    return addDays(today, count * (unit === 'week' ? 7 : 1))
  }, [wish, period, unit, today])

  const targetAmount = Number(amount)
  const days = targetDate ? Math.max(1, daysBetween(today, targetDate) + 1) : null
  const preview = days && targetAmount > 0 ? Math.floor(targetAmount / days) : 0

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    if (editing) {
      onRename?.(name.trim())
      return
    }
    if (targetAmount <= 0) return
    const id = crypto.randomUUID()
    onCreate?.({
      id,
      name: name.trim(),
      targetAmount,
      savedAmount: 0,
      startDate: today,
      targetDate,
      status: 'active',
      seed: seedFromId(id),
      createdAt: Date.now(),
    })
  }

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="wl-sheet" onSubmit={submit}>
        <div className="sheet-handle" />
        <header className="sheet-header">
          <div>
            <span className="pixel-label">{editing ? 'EDIT WISH' : 'NEW WISH'}</span>
            <h2>{editing ? '이름 바꾸기' : '새 소원 빌기'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        </header>

        <label>소원 이름<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="오래 생각해 본 것" /></label>
        <label>목표 금액
          <div className="input-with-unit">
            <input
              inputMode="numeric"
              aria-label="목표 금액"
              value={amount ? money(Number(amount)) : ''}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, '').slice(0, 9))}
              placeholder="200,000"
              disabled={editing}
            />
            <span>원</span>
          </div>
        </label>
        <fieldset>
          <legend>목표 기간</legend>
          <div className="period-editor">
            <input
              inputMode="numeric"
              aria-label="목표 기간 숫자"
              value={period}
              onChange={(event) => setPeriod(event.target.value.replace(/[^0-9]/g, ''))}
              placeholder={editing ? '수정 예정' : '기간 없음'}
              disabled={editing}
            />
            <div className="period-unit-choice" aria-label="기간 단위">
              {([['day', '일'], ['week', '주'], ['month', '월']] as const).map(([value, label]) => (
                <button type="button" key={value} className={unit === value ? 'active' : ''} aria-pressed={unit === value} disabled={editing} onClick={() => setUnit(value)}>{label}</button>
              ))}
            </div>
          </div>
        </fieldset>

        <p className="mission-gain">
          <span className="pixel-label">DAILY SHARE</span>
          <strong>{preview ? `${money(preview)}원` : '—'}</strong>
          <span>{editing ? '금액·기간 수정은 다음 단계' : days ? `${days}일 궤도` : '기간을 정하면 하루 몫이 생긴다'}</span>
        </p>

        <button className="primary-button full" type="submit">{editing ? '이름 저장' : '궤도에 올리기'}</button>
      </form>
    </div>
  )
}
