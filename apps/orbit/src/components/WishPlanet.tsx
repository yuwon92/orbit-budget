/**
 * Wish 앱 로고와 같은 픽셀 행성. 앱 전환 메뉴의 wish 줄에 쓴다.
 *
 * 원본은 apps/wish/src/planet.ts의 buildBlocks(38, 7)이다. 빌드가 분리돼 있어
 * import할 수 없으므로 그 결과를 그대로 옮겨 뒀다. Wish 로고를 바꾸면 여기도
 * 함께 바꿔야 한다. viewBox는 몸통에 맞춰 잘라 옆 로고와 크기를 맞춘다.
 */
export function WishPlanet({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="7 7 18 18" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="15" y="8" width="2" height="1" fill="#FFD43B" />
      <rect x="12" y="9" width="7" height="1" fill="#FFD43B" />
      <rect x="19" y="9" width="1" height="1" fill="#FFB126" />
      <rect x="11" y="10" width="4" height="1" fill="#FFF1AC" />
      <rect x="15" y="10" width="4" height="1" fill="#FFD43B" />
      <rect x="19" y="10" width="2" height="1" fill="#FFB126" />
      <rect x="10" y="11" width="6" height="1" fill="#FFF1AC" />
      <rect x="16" y="11" width="3" height="1" fill="#FFD43B" />
      <rect x="19" y="11" width="3" height="1" fill="#FFB126" />
      <rect x="9" y="12" width="1" height="1" fill="#FFD43B" />
      <rect x="10" y="12" width="6" height="1" fill="#FFF1AC" />
      <rect x="16" y="12" width="4" height="1" fill="#FFD43B" />
      <rect x="20" y="12" width="3" height="1" fill="#FFB126" />
      <rect x="9" y="13" width="1" height="1" fill="#FFD43B" />
      <rect x="10" y="13" width="6" height="1" fill="#FFF1AC" />
      <rect x="16" y="13" width="4" height="1" fill="#FFD43B" />
      <rect x="20" y="13" width="3" height="1" fill="#FFB126" />
      <rect x="9" y="14" width="1" height="1" fill="#FFD43B" />
      <rect x="10" y="14" width="5" height="1" fill="#FFF1AC" />
      <rect x="15" y="14" width="1" height="1" fill="#FFB126" />
      <rect x="16" y="14" width="3" height="1" fill="#FFD43B" />
      <rect x="19" y="14" width="3" height="1" fill="#FFB126" />
      <rect x="22" y="14" width="1" height="1" fill="#EA8A00" />
      <rect x="8" y="15" width="3" height="1" fill="#FFD43B" />
      <rect x="11" y="15" width="4" height="1" fill="#FFF1AC" />
      <rect x="15" y="15" width="4" height="1" fill="#FFD43B" />
      <rect x="19" y="15" width="3" height="1" fill="#FFB126" />
      <rect x="22" y="15" width="2" height="1" fill="#EA8A00" />
      <rect x="8" y="16" width="4" height="1" fill="#FFD43B" />
      <rect x="12" y="16" width="1" height="1" fill="#FFB126" />
      <rect x="13" y="16" width="4" height="1" fill="#FFD43B" />
      <rect x="17" y="16" width="5" height="1" fill="#FFB126" />
      <rect x="22" y="16" width="2" height="1" fill="#EA8A00" />
      <rect x="9" y="17" width="8" height="1" fill="#FFD43B" />
      <rect x="17" y="17" width="4" height="1" fill="#FFB126" />
      <rect x="21" y="17" width="2" height="1" fill="#EA8A00" />
      <rect x="9" y="18" width="5" height="1" fill="#FFD43B" />
      <rect x="14" y="18" width="2" height="1" fill="#FFB126" />
      <rect x="16" y="18" width="1" height="1" fill="#FFD43B" />
      <rect x="17" y="18" width="4" height="1" fill="#FFB126" />
      <rect x="21" y="18" width="2" height="1" fill="#EA8A00" />
      <rect x="9" y="19" width="3" height="1" fill="#FFB126" />
      <rect x="12" y="19" width="2" height="1" fill="#FFD43B" />
      <rect x="14" y="19" width="6" height="1" fill="#FFB126" />
      <rect x="20" y="19" width="3" height="1" fill="#EA8A00" />
      <rect x="10" y="20" width="9" height="1" fill="#FFB126" />
      <rect x="19" y="20" width="3" height="1" fill="#EA8A00" />
      <rect x="11" y="21" width="6" height="1" fill="#FFB126" />
      <rect x="17" y="21" width="4" height="1" fill="#EA8A00" />
      <rect x="12" y="22" width="2" height="1" fill="#FFB126" />
      <rect x="14" y="22" width="6" height="1" fill="#EA8A00" />
      <rect x="15" y="23" width="2" height="1" fill="#EA8A00" />
    </svg>
  )
}
