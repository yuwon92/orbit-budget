import { useId } from 'react'

interface PlanetVisualProps {
  color: string
  progress: number
  compact?: boolean
  active?: boolean
}

export function PlanetVisual({ color, progress, compact = false, active = false }: PlanetVisualProps) {
  const gradientId = useId().replaceAll(':', '')
  const value = Math.max(0, Math.min(progress, 100))
  const formed = value >= 25
  const patched = value >= 50
  const ringed = value >= 75
  const complete = value >= 100

  return (
    <div className={`planet-wrap ${compact ? 'compact' : ''} ${active ? 'active' : ''}`} aria-label={`위시 진행률 ${Math.round(value)}%`}>
      <svg className="planet-svg" viewBox="0 0 320 320" role="img">
        <defs>
          <radialGradient id={gradientId} cx="34%" cy="26%" r="72%">
            <stop offset="0" stopColor="#fff" stopOpacity=".92" />
            <stop offset=".28" stopColor={color} stopOpacity=".9" />
            <stop offset="1" stopColor={color} stopOpacity=".44" />
          </radialGradient>
          <filter id={`${gradientId}-blur`}><feGaussianBlur stdDeviation="15" /></filter>
          <clipPath id={`${gradientId}-clip`}><circle cx="160" cy="160" r="91" /></clipPath>
        </defs>

        <circle className="planet-glow" cx="160" cy="160" r="108" fill={color} filter={`url(#${gradientId}-blur)`} opacity=".2" />

        {!formed && (
          <g className="planet-dust" fill={color}>
            <rect x="112" y="116" width="18" height="18" rx="2" />
            <rect x="147" y="95" width="12" height="12" rx="2" opacity=".72" />
            <rect x="178" y="118" width="22" height="22" rx="2" opacity=".85" />
            <rect x="127" y="154" width="27" height="27" rx="3" opacity=".9" />
            <rect x="171" y="159" width="17" height="17" rx="2" opacity=".66" />
            <rect x="151" y="194" width="21" height="21" rx="2" opacity=".76" />
            <rect x="202" y="181" width="10" height="10" rx="1" opacity=".52" />
            <rect x="94" y="188" width="9" height="9" rx="1" opacity=".48" />
          </g>
        )}

        {formed && (
          <>
            {ringed && <ellipse className="planet-ring back" cx="160" cy="160" rx="137" ry="45" transform="rotate(-17 160 160)" />}
            <circle className="planet-body" cx="160" cy="160" r="91" fill={`url(#${gradientId})`} />
            <g clipPath={`url(#${gradientId}-clip)`}>
              <path className="planet-shadow" d="M83 176c41 33 116 42 160-7 7 53-31 91-82 91-45 0-76-29-78-84Z" />
              {patched && <path className="planet-patch one" d="M91 132c19-26 42-30 55-17 11 12 5 33-15 42-18 8-35-3-40-25Z" />}
              {patched && <path className="planet-patch two" d="M178 173c20-14 47-9 55 9 9 20-11 45-39 43-22-2-31-38-16-52Z" />}
              {value >= 75 && <path className="planet-patch three" d="M157 80c17 1 35 8 44 18-5 15-22 25-37 18-14-7-17-24-7-36Z" />}
            </g>
            {ringed && <path className="planet-ring front" d="M39 183c36 24 101 33 165 18 42-10 72-29 81-47" transform="rotate(-17 160 160)" />}
            {complete && <g className="planet-moon"><circle cx="262" cy="83" r="13" fill="#f0d97a" /><circle cx="258" cy="79" r="4" fill="#fff" opacity=".65" /></g>}
          </>
        )}
      </svg>
      {!compact && <span className="star-mark star-one" />}
      {!compact && <span className="star-mark star-two" />}
      {!compact && <span className="square-star" />}
    </div>
  )
}
