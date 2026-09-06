/** 픽셀 세그먼트 바. 계층마다 칸 수만 바꿔 쓴다. (가이드 18장) */
export function PixelBar({ ratio, segments = 10, tone = 'gold', label }: {
  ratio: number
  segments?: number
  tone?: 'gold' | 'orange'
  label?: string
}) {
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * segments)
  return (
    <div className={`pixel-bar tone-${tone}`} role="img" aria-label={label ?? `진행률 ${Math.round(ratio * 100)}%`}>
      {Array.from({ length: segments }, (_, index) => (
        <i key={index} className={index < filled ? 'on' : ''} />
      ))}
    </div>
  )
}
