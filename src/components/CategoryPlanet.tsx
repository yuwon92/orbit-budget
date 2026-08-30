import type { CSSProperties } from 'react'

export function CategoryPlanet({ color }: { color: string }) {
  return (
    <span className="category-planet" style={{ '--category-color': color } as CSSProperties}>
      <i />
    </span>
  )
}
