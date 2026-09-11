import { useMemo, useState } from 'react'
import { money } from '@orbit/budget-core/format'
import { daysBetween, keptDays } from '@orbit/wish-core/wish'
import { XP } from '@orbit/wish-core/xp'
import type { Wish, WishEvent } from '@orbit/wish-core/types'
import { PixelPlanet } from '../components/PixelPlanet'
import { CODEX_SLOTS } from '../lib/labels'
import { formatDate } from '../lib/format'
import type { WishSkin } from '../lib/preview'

export function CodexScreen({ wishes, events, skin }: { wishes: Wish[]; events: WishEvent[]; skin: WishSkin }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const entries = useMemo(() => wishes.map((wish) => {
    const purchase = events.find((event) => event.wishId === wish.id && event.type === 'purchase')
    const date = purchase?.date ?? wish.targetDate ?? wish.startDate
    const kept = keptDays(events, wish.id)
    return {
      wish,
      date,
      days: daysBetween(wish.startDate, date) + 1,
      keptDays: kept,
      // 그 위시에서 얻은 XP. 지킨 날 XP + 완주 보너스
      xp: kept * XP.share + XP.complete,
    }
  }).sort((a, b) => (a.date < b.date ? 1 : -1)), [wishes, events])

  const entry = entries.find((item) => item.wish.id === selectedId) ?? entries[0]
  const empty = Math.max(0, CODEX_SLOTS - entries.length)

  return (
    <main className="codex-screen">
      <header className="screen-head">
        <span className="pixel-label">UNIVERSE CODEX</span>
        <h1>우주 도감</h1>
        <p>별 {entries.length} / {CODEX_SLOTS} 수집</p>
      </header>

      <section className="constellation">
        {entries.map((item, index) => (
          <button
            key={item.wish.id}
            className={`constellation-star s-${(index % 6) + 1}${entry?.wish.id === item.wish.id ? ' selected' : ''}`}
            onClick={() => setSelectedId(item.wish.id)}
            aria-label={item.wish.name}
          >
            <PixelPlanet progress={100} seed={item.wish.seed} size={40} {...skin} />
          </button>
        ))}
        <span className="dust d1" /><span className="dust d2" /><span className="dust d3" /><span className="dust d4" />
      </section>

      {entry ? (
        <section className="codex-detail">
          <div>
            <span className="pixel-label">ORBIT COMPLETE · {formatDate(entry.date)}</span>
            <h2>{entry.wish.name}</h2>
          </div>
          <dl>
            <div><dt>걸린 날</dt><dd>{entry.days}일</dd></div>
            <div><dt>지킨 날</dt><dd>{entry.keptDays}일</dd></div>
            <div><dt>모은 금액</dt><dd>{money(entry.wish.targetAmount)}원</dd></div>
            <div><dt>얻은 XP</dt><dd>{entry.xp.toLocaleString('ko-KR')}</dd></div>
          </dl>
        </section>
      ) : (
        <section className="codex-detail">
          <div>
            <span className="pixel-label">EMPTY UNIVERSE</span>
            <h2>아직 완주한 별이 없다</h2>
          </div>
        </section>
      )}

      <section className="codex-grid">
        {entries.map((item) => (
          <button
            key={item.wish.id}
            className={`codex-cell${entry?.wish.id === item.wish.id ? ' selected' : ''}`}
            onClick={() => setSelectedId(item.wish.id)}
          >
            <PixelPlanet progress={100} seed={item.wish.seed} size={52} {...skin} />
            <strong>{item.wish.name}</strong>
            <span>{formatDate(item.date)}</span>
          </button>
        ))}
        {Array.from({ length: empty }, (_, index) => (
          <div key={`empty-${index}`} className="codex-cell locked">
            <span className="cell-silhouette" aria-hidden="true" />
            <strong>???</strong>
            <span>미수집</span>
          </div>
        ))}
      </section>
    </main>
  )
}
