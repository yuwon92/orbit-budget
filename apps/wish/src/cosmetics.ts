// 행성 꾸미기 그리기 값. 데이터만 두고 렌더링 로직은 cosmeticBlocks.ts에 둔다.
// 좌표는 PixelPlanet과 같은 32×32 격자 기준이며 최종 블록은 전부 정수로 나간다.
//
// 프리셋 id는 카탈로그의 아이템 id와 같은 값이다(@orbit/wish-core/items).
// 이름·희귀도·가격은 여기 없다 — 카탈로그와 lib/items.ts가 갖는다.
// 행성 무늬는 몸통 명암·반지름을 함께 봐야 해서 좌표표가 아니라 planet.ts가 그린다.

export interface PlanetPalette {
  highlight: string
  light: string
  mid: string
  dark: string
}

export type PaletteTone = keyof PlanetPalette
/** 팔레트 4단 + 프리셋 고정색 3종. 고정색은 팔레트를 바꿔도 그대로 남는다. */
export type CosmeticFill = PaletteTone | 'accent' | 'soft' | 'ink'

export interface CosmeticPixel {
  x: number
  y: number
  w?: number
  h?: number
  fill: CosmeticFill
}

/** 별자리 연결선. 정수 격자 위 1px 계단선으로 그린다. */
export interface CosmeticLine {
  x1: number
  y1: number
  x2: number
  y2: number
  fill: CosmeticFill
}

export interface PalettePreset {
  id: string
  colors: PlanetPalette
}

export interface PixelPreset {
  id: string
  pixels: readonly CosmeticPixel[]
  lines?: readonly CosmeticLine[]
  accent: string
  soft: string
  ink: string
}

/** 고리 한 겹. 중심 (16,16)에서 rx·ry 타원을 tilt만큼 기울여 훑는다. */
export interface RingBand {
  rx: number
  ry: number
  tilt: number
  /** 도 단위 점선. on 구간만 찍는다. */
  dash?: { on: number; off: number }
  /** 점선 조각을 한 칸씩 두껍게 해서 파편처럼 보이게 한다. */
  chunky?: boolean
}

export interface RingPreset {
  id: string
  bands: readonly RingBand[]
}

export const PALETTE_PRESETS = [
  {
    id: 'planet-color-solar',
    colors: { highlight: '#FFF1AC', light: '#FFD43B', mid: '#FFB126', dark: '#EA8A00' },
  },
  {
    id: 'planet-color-mint',
    colors: { highlight: '#E8FFE0', light: '#9DE7C2', mid: '#52C7A5', dark: '#238B78' },
  },
  {
    id: 'planet-color-coral',
    colors: { highlight: '#FFE7C7', light: '#FF9C7C', mid: '#F06462', dark: '#B93D50' },
  },
  {
    id: 'planet-color-lavender',
    colors: { highlight: '#F3E8FF', light: '#C9A7F2', mid: '#9674D4', dark: '#654B9A' },
  },
  {
    // 전설. 4단 안에서 색상까지 도는 유일한 팔레트라 다른 색과 섞이지 않는다.
    id: 'planet-color-aurora',
    colors: { highlight: '#EBFFF6', light: '#8CF0C8', mid: '#4FA8E8', dark: '#5B3FA8' },
  },
] as const satisfies readonly PalettePreset[]

// 고리는 팔레트 4단만 쓴다. 색을 바꾸면 고리도 같이 물든다.
export const RING_PRESETS = [
  {
    id: 'ring-single',
    bands: [{ rx: 13, ry: 4.4, tilt: -0.2 }],
  },
  {
    id: 'ring-double',
    bands: [
      { rx: 14.5, ry: 5, tilt: -0.2 },
      { rx: 10.5, ry: 3.4, tilt: -0.2 },
    ],
  },
  {
    id: 'ring-debris',
    bands: [{ rx: 13, ry: 4.4, tilt: -0.2, dash: { on: 22, off: 14 }, chunky: true }],
  },
] as const satisfies readonly RingPreset[]

// 위성·동료는 오른쪽 위 구역(x 20~31 · y 1~9)에 고정한다. 돌리면 안테나가 거꾸로 서고
// 효과와 자리가 겹친다. 고리 띠(x 3~29 · y 11~21)와 행성 몸통은 건드리지 않는다.
export const COMPANION_PRESETS = [
  {
    id: 'companion-moonlet',
    // 행성 몸통과 구분되게 팔레트를 따르지 않고 흙색 고정 3톤으로 찍는다.
    accent: '#D8BE8E', soft: '#FFF6E0', ink: '#9C8558',
    pixels: [
      // 6×6 원판. 왼쪽 위가 밝고 오른쪽 아래로 그림자가 진다.
      { x: 24, y: 2, w: 4, fill: 'accent' },
      { x: 23, y: 3, w: 6, fill: 'accent' },
      { x: 23, y: 4, w: 6, fill: 'accent' },
      { x: 23, y: 5, w: 6, fill: 'accent' },
      { x: 23, y: 6, w: 6, fill: 'accent' },
      { x: 24, y: 7, w: 4, fill: 'accent' },
      { x: 24, y: 2, w: 3, fill: 'soft' },
      { x: 23, y: 3, w: 3, fill: 'soft' },
      { x: 23, y: 4, w: 2, fill: 'soft' },
      { x: 26, y: 6, w: 3, fill: 'ink' },
      { x: 25, y: 7, w: 3, fill: 'ink' },
      { x: 27, y: 4, w: 2, fill: 'ink' },
      // 크레이터 둘
      { x: 25, y: 3, fill: 'ink' },
      { x: 24, y: 5, w: 2, fill: 'ink' },
    ],
  },
  {
    id: 'companion-probe',
    accent: '#52C7A5', soft: '#E8FFE0', ink: '#1F7A69',
    pixels: [
      // 접시 → 본체 → 지지대 → 양쪽 태양 날개. 날개는 본체와 한 칸 띄워 실루엣을 끊는다.
      { x: 23, y: 2, w: 5, fill: 'accent' }, { x: 24, y: 2, w: 3, fill: 'soft' },
      { x: 25, y: 3, fill: 'accent' },
      { x: 24, y: 4, w: 3, h: 3, fill: 'accent' },
      { x: 24, y: 4, w: 3, fill: 'soft' },
      { x: 24, y: 6, w: 3, fill: 'ink' },
      { x: 23, y: 5, fill: 'ink' }, { x: 27, y: 5, fill: 'ink' },
      { x: 20, y: 4, w: 3, fill: 'accent' }, { x: 20, y: 5, w: 3, fill: 'ink' },
      { x: 28, y: 4, w: 3, fill: 'accent' }, { x: 28, y: 5, w: 3, fill: 'ink' },
    ],
  },
  {
    id: 'companion-meteor',
    // 돌덩이는 갈색, 불꼬리는 주홍. 가장 뜨거운 자리만 밝게 남긴다.
    accent: '#F0724D', soft: '#FFD8A0', ink: '#7A4A3A',
    pixels: [
      { x: 20, y: 1, fill: 'accent' },
      { x: 21, y: 2, w: 2, fill: 'accent' },
      { x: 23, y: 3, w: 2, fill: 'accent' },
      { x: 24, y: 4, w: 3, fill: 'soft' },
      { x: 27, y: 4, w: 2, fill: 'ink' },
      { x: 26, y: 5, w: 4, fill: 'ink' },
      { x: 26, y: 6, w: 4, fill: 'ink' },
      { x: 27, y: 7, w: 2, fill: 'ink' },
      { x: 27, y: 4, w: 2, fill: 'accent' },
      { x: 26, y: 5, w: 2, fill: 'accent' },
      { x: 26, y: 6, fill: 'soft' },
    ],
  },
  {
    // 별 무리만 팔레트 4단으로만 그린다. 행성에서 떨어져 나온 조각이라는 뜻이고,
    // 고정색을 한 칸이라도 섞으면 팔레트를 바꿨을 때 그 칸만 남아 튄다.
    id: 'companion-star-cluster',
    accent: '#FFD43B', soft: '#FFF1AC', ink: '#EA8A00',
    pixels: [
      { x: 24, y: 2, h: 5, fill: 'light' },
      { x: 23, y: 4, w: 3, fill: 'light' },
      { x: 24, y: 4, fill: 'highlight' },
      { x: 28, y: 6, h: 3, fill: 'mid' },
      { x: 27, y: 7, w: 3, fill: 'mid' },
      { x: 20, y: 6, w: 2, h: 2, fill: 'dark' },
    ],
  },
] as const satisfies readonly PixelPreset[]

// 성계 배경은 고리 띠(x 3~29 · y 11~21)를 피해 위아래 모서리에만 놓는다.
export const BACKGROUND_PRESETS = [
  {
    id: 'background-starfield',
    accent: '#FFB126', soft: '#FFD43B', ink: '#EA8A00',
    pixels: [
      // 십자 별 셋 + 2×2 별 셋. 1px 점은 32px에서 사라져 쓰지 않고, 동료 구역은 비운다.
      { x: 3, y: 4, w: 3, fill: 'accent' }, { x: 4, y: 3, h: 3, fill: 'soft' },
      { x: 8, y: 3, w: 3, fill: 'accent' }, { x: 9, y: 2, h: 3, fill: 'soft' },
      { x: 5, y: 25, w: 3, fill: 'accent' }, { x: 6, y: 24, h: 3, fill: 'soft' },
      { x: 14, y: 2, w: 2, h: 2, fill: 'ink' }, { x: 14, y: 2, fill: 'accent' },
      { x: 27, y: 25, w: 2, h: 2, fill: 'accent' }, { x: 27, y: 25, fill: 'soft' },
      { x: 12, y: 28, w: 2, h: 2, fill: 'ink' }, { x: 12, y: 28, fill: 'accent' },
    ],
  },
  {
    id: 'background-nebula',
    // 라벤더 행성과 색이 붙지 않게 푸른 계열로 잡고, 32px에서 뭉치지 않게 세 줄만 쓴다.
    accent: '#A8B8F0', soft: '#E4ECFF', ink: '#6B7BC4',
    pixels: [
      // 왼쪽 위 띠
      { x: 1, y: 2, w: 4, fill: 'ink' },
      { x: 2, y: 3, w: 5, fill: 'accent' }, { x: 2, y: 3, w: 3, fill: 'soft' },
      { x: 4, y: 4, w: 5, fill: 'ink' }, { x: 5, y: 4, w: 3, fill: 'accent' },
      { x: 7, y: 5, w: 3, fill: 'ink' },
      { x: 0, y: 1, fill: 'ink' }, { x: 9, y: 6, fill: 'ink' },
      // 오른쪽 아래 띠
      { x: 27, y: 29, w: 4, fill: 'ink' },
      { x: 25, y: 28, w: 5, fill: 'accent' }, { x: 27, y: 28, w: 3, fill: 'soft' },
      { x: 23, y: 27, w: 5, fill: 'ink' }, { x: 24, y: 27, w: 3, fill: 'accent' },
      { x: 22, y: 26, w: 3, fill: 'ink' },
      { x: 31, y: 30, fill: 'ink' }, { x: 22, y: 25, fill: 'ink' },
      // 흩어진 별
      { x: 27, y: 3, w: 2, h: 2, fill: 'soft' },
      { x: 5, y: 26, w: 2, h: 2, fill: 'soft' },
    ],
  },
  {
    id: 'background-constellation',
    accent: '#9DE7C2', soft: '#E8FFE0', ink: '#238B78',
    lines: [
      { x1: 2, y1: 3, x2: 6, y2: 6, fill: 'accent' },
      { x1: 6, y1: 6, x2: 11, y2: 3, fill: 'accent' },
      { x1: 11, y1: 3, x2: 14, y2: 7, fill: 'accent' },
      { x1: 20, y1: 27, x2: 25, y2: 29, fill: 'accent' },
      { x1: 25, y1: 29, x2: 29, y2: 25, fill: 'accent' },
      { x1: 29, y1: 25, x2: 26, y2: 22, fill: 'accent' },
    ],
    pixels: [
      { x: 1, y: 2, w: 2, h: 2, fill: 'soft' }, { x: 6, y: 6, fill: 'highlight' },
      { x: 10, y: 2, w: 2, h: 2, fill: 'soft' }, { x: 14, y: 7, fill: 'highlight' },
      { x: 19, y: 26, w: 2, h: 2, fill: 'soft' }, { x: 25, y: 29, fill: 'highlight' },
      { x: 28, y: 24, w: 2, h: 2, fill: 'soft' }, { x: 26, y: 22, fill: 'highlight' },
    ],
  },
] as const satisfies readonly PixelPreset[]

// 효과는 완주(성계 단계)에서만 뜬다. 고리 띠를 피하고, 배경이 덮어 버린 기존 완주 별
// 자리를 대신 채운다 — 그래서 스타터 세트에 기본 효과가 들어 있다.
export const EFFECT_PRESETS = [
  {
    id: 'effect-sparkles',
    accent: '#FFD43B', soft: '#FFF1AC', ink: '#EA8A00',
    pixels: [
      { x: 3, y: 4, w: 3, fill: 'soft' }, { x: 4, y: 3, h: 3, fill: 'highlight' },
      { x: 12, y: 3, w: 3, fill: 'soft' }, { x: 13, y: 2, h: 3, fill: 'light' },
      { x: 4, y: 25, w: 3, fill: 'light' }, { x: 5, y: 24, h: 3, fill: 'soft' },
      { x: 25, y: 26, w: 3, fill: 'soft' }, { x: 26, y: 25, h: 3, fill: 'highlight' },
      { x: 16, y: 28, w: 3, fill: 'soft' }, { x: 17, y: 27, h: 3, fill: 'light' },
    ],
  },
  {
    id: 'effect-comet-trail',
    accent: '#FF9C7C', soft: '#FFE7C7', ink: '#B93D50',
    pixels: [
      { x: 9, y: 6, w: 2, fill: 'soft' },
      { x: 8, y: 7, w: 3, fill: 'soft' }, { x: 9, y: 7, fill: 'highlight' },
      { x: 9, y: 8, w: 2, fill: 'accent' },
      { x: 6, y: 5, w: 2, fill: 'accent' },
      { x: 4, y: 4, w: 2, fill: 'ink' },
      { x: 2, y: 3, w: 2, fill: 'ink' },
      { x: 1, y: 2, fill: 'ink' },
    ],
  },
] as const satisfies readonly PixelPreset[]

export function presetById<T extends { id: string }>(presets: readonly T[], id?: string): T | undefined {
  return id ? presets.find((preset) => preset.id === id) : undefined
}
