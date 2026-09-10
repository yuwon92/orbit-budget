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
  /**
   * 애니메이션 묶음. 같은 번호는 같은 박자로 움직인다 — 십자 별 하나가 가로 3칸 +
   * 세로 3칸 두 줄이라, 번호를 안 묶으면 한 별의 가로와 세로가 따로 깜빡인다.
   * 번호가 커질수록 늦게 시작한다(`drift`는 이 순서가 곧 빛이 흐르는 방향).
   */
  g?: number
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

/**
 * 효과 애니메이션 갈래. 12px 격자라 부드러운 페이드는 흐릿하게 뭉개진다 — 셋 다
 * 값이 뚝뚝 끊기는 계단이고, CSS는 같은 값을 두 지점에 걸쳐 두는 방식으로 만든다.
 *
 * `twinkle` 별이 밝았다 어두워짐 · `pulse` 호가 숨쉬듯 부풀었다 가라앉음 ·
 * `drift` 밝은 마디가 묶음 번호 순서대로 흘러감(꼬리 → 머리)
 */
export type CosmeticAnim = 'twinkle' | 'pulse' | 'drift'

export interface PixelPreset {
  id: string
  pixels: readonly CosmeticPixel[]
  lines?: readonly CosmeticLine[]
  /** 있으면 그 층 전체가 이 갈래로 움직인다. 없으면 정지 */
  anim?: CosmeticAnim
  /**
   * 프리셋 고정색. 자기 색이 있는 아이템만 갖는다 — 성운의 푸른 띠, 위성의 흙색처럼
   * 행성과 별개의 물체이거나 이름이 색을 뜻하는 것들.
   *
   * 기본 아이템(기본 별밭·반짝이는 별)은 이 세 값을 두지 않고 팔레트 4단만 쓴다.
   * 행성 색을 바꿨는데 주변 별만 노랑으로 남으면 색이 반만 바뀐 것처럼 보인다.
   */
  accent?: string
  soft?: string
  ink?: string
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
    pixels: [
      { x: 24, y: 2, h: 5, fill: 'light' },
      { x: 23, y: 4, w: 3, fill: 'light' },
      { x: 24, y: 4, fill: 'highlight' },
      { x: 28, y: 6, h: 3, fill: 'mid' },
      { x: 27, y: 7, w: 3, fill: 'mid' },
      { x: 20, y: 6, w: 2, h: 2, fill: 'dark' },
    ],
  },
  {
    id: 'companion-pebble',
    accent: '#BFB6A4', soft: '#EDE7D8', ink: '#847C6C',
    pixels: [
      // 5×4 자갈 하나 + 떨어져 있는 조각 하나. 위성보다 작게 둬서 등급 차이가 보이게.
      { x: 25, y: 3, w: 3, fill: 'accent' },
      { x: 24, y: 4, w: 5, fill: 'accent' },
      { x: 24, y: 5, w: 5, fill: 'accent' },
      { x: 25, y: 6, w: 3, fill: 'accent' },
      { x: 25, y: 3, w: 2, fill: 'soft' },
      { x: 24, y: 4, w: 2, fill: 'soft' },
      { x: 27, y: 5, w: 2, fill: 'ink' },
      { x: 26, y: 6, w: 2, fill: 'ink' },
      { x: 21, y: 7, w: 2, h: 2, fill: 'accent' }, { x: 21, y: 7, fill: 'soft' },
    ],
  },
  {
    id: 'companion-comet',
    // 얼음 머리는 청록, 꼬리는 뒤로 갈수록 어둡게. 머리를 오른쪽에 둬서 행성 반대편으로
    // 날아가는 방향이 된다 — 안쪽을 향하면 부딪히는 것처럼 보인다.
    accent: '#8FD8F0', soft: '#EAFBFF', ink: '#3E7E9C',
    pixels: [
      { x: 27, y: 3, w: 3, fill: 'accent' },
      { x: 26, y: 4, w: 5, fill: 'accent' },
      { x: 27, y: 5, w: 3, fill: 'accent' },
      { x: 27, y: 3, w: 2, fill: 'soft' },
      { x: 27, y: 4, w: 2, fill: 'soft' },
      { x: 29, y: 5, w: 2, fill: 'ink' },
      { x: 24, y: 4, w: 2, fill: 'accent' },
      { x: 22, y: 5, w: 2, fill: 'accent' },
      { x: 20, y: 6, w: 2, fill: 'ink' },
      { x: 24, y: 3, w: 2, fill: 'ink' },
      { x: 22, y: 3, fill: 'ink' },
    ],
  },
  {
    id: 'companion-shuttle',
    accent: '#D8DEE9', soft: '#FFFFFF', ink: '#7A8698',
    pixels: [
      // 코 → 본체 → 날개 → 배기. 창은 ink 한 칸으로만 찍는다. 2칸이면 32px에서
      // 본체가 뚫린 것처럼 보인다.
      { x: 26, y: 2, fill: 'soft' },
      { x: 25, y: 3, w: 3, fill: 'accent' }, { x: 25, y: 3, fill: 'soft' },
      { x: 25, y: 4, w: 3, fill: 'accent' }, { x: 26, y: 4, fill: 'ink' },
      { x: 24, y: 5, w: 5, fill: 'accent' },
      { x: 24, y: 6, w: 5, fill: 'ink' },
      { x: 23, y: 5, fill: 'ink' }, { x: 29, y: 5, fill: 'ink' },
      { x: 25, y: 7, w: 3, fill: 'soft' },
      { x: 26, y: 8, fill: 'accent' },
    ],
  },
] as const satisfies readonly PixelPreset[]

// 성계 배경.
//
// **배경은 넓게 깔린다.** 모서리에 뭉치 둘만 놓으면 동료나 효과와 구별이 안 된다 —
// 배경으로 읽히려면 화면 폭을 가로지르거나 한 면을 통째로 덮어야 한다. `고요한 월면`이
// 그 기준이다.
//
// 배경은 가장 먼저 깔려 행성·고리·동료·효과가 전부 위에 얹힌다. 그래서 가운데를
// 지나가도 안전하다 — 성운 띠처럼 행성 뒤로 지나가는 모양이 오히려 깊이를 만든다.
// 지켜야 할 것은 **동료 자리(x 20~31 · y 1~9)** 하나뿐이고, 여기는 흐린 칸만 둔다.
// 위성·안테나가 그 위에 서면 뒤가 복잡할수록 형태가 뭉개진다.
export const BACKGROUND_PRESETS = [
  {
    // 기본 배경은 팔레트 4단만 쓴다. mid·light·dark가 원래 고정색과 같은 값이라
    // 기본 태양색에서는 모습이 그대로이고, 색을 바꾸면 주변 별도 함께 물든다.
    // 1px 점은 32px에서 사라져 쓰지 않는다 — 십자 아니면 2×2.
    id: 'background-starfield',
    pixels: [
      // 위쪽 하늘
      { x: 1, y: 4, w: 3, fill: 'mid' }, { x: 2, y: 3, h: 3, fill: 'light' },
      { x: 7, y: 2, w: 3, fill: 'mid' }, { x: 8, y: 1, h: 3, fill: 'light' },
      { x: 13, y: 6, w: 3, fill: 'mid' }, { x: 14, y: 5, h: 3, fill: 'light' },
      { x: 17, y: 1, w: 2, h: 2, fill: 'dark' }, { x: 17, y: 1, fill: 'mid' },
      { x: 10, y: 9, w: 2, h: 2, fill: 'dark' },
      { x: 30, y: 6, w: 2, h: 2, fill: 'dark' },
      // 아래쪽 하늘
      { x: 2, y: 26, w: 3, fill: 'mid' }, { x: 3, y: 25, h: 3, fill: 'light' },
      { x: 10, y: 29, w: 3, fill: 'mid' }, { x: 11, y: 28, h: 3, fill: 'light' },
      { x: 19, y: 25, w: 3, fill: 'mid' }, { x: 20, y: 24, h: 3, fill: 'light' },
      { x: 27, y: 28, w: 3, fill: 'mid' }, { x: 28, y: 27, h: 3, fill: 'light' },
      { x: 6, y: 22, w: 2, h: 2, fill: 'dark' }, { x: 6, y: 22, fill: 'mid' },
      { x: 24, y: 22, w: 2, h: 2, fill: 'dark' }, { x: 24, y: 22, fill: 'mid' },
      { x: 15, y: 24, w: 2, h: 2, fill: 'dark' },
      { x: 0, y: 30, w: 2, fill: 'dark' }, { x: 30, y: 31, w: 2, fill: 'dark' },
    ],
  },
  {
    id: 'background-nebula',
    // 라벤더 행성과 색이 붙지 않게 푸른 계열로 잡는다. 왼쪽 위에서 오른쪽 아래로
    // 대각선을 그으며 지나가고, 가운데는 행성이 가린다 — 뒤로 흐르는 깊이가 생긴다.
    accent: '#A8B8F0', soft: '#E4ECFF', ink: '#6B7BC4',
    pixels: [
      // 왼쪽 위 날개
      { x: 0, y: 1, w: 6, fill: 'ink' },
      { x: 0, y: 2, w: 9, fill: 'accent' }, { x: 1, y: 2, w: 4, fill: 'soft' },
      { x: 1, y: 3, w: 11, fill: 'accent' }, { x: 3, y: 3, w: 5, fill: 'soft' },
      { x: 3, y: 4, w: 11, fill: 'ink' }, { x: 5, y: 4, w: 5, fill: 'accent' },
      { x: 6, y: 5, w: 10, fill: 'ink' },
      { x: 9, y: 6, w: 8, fill: 'ink' },
      { x: 12, y: 7, w: 6, fill: 'ink' },
      { x: 15, y: 8, w: 4, fill: 'ink' },
      // 오른쪽 아래 날개
      { x: 14, y: 24, w: 5, fill: 'ink' },
      { x: 16, y: 25, w: 8, fill: 'ink' },
      { x: 17, y: 26, w: 11, fill: 'accent' }, { x: 19, y: 26, w: 5, fill: 'soft' },
      { x: 19, y: 27, w: 12, fill: 'accent' }, { x: 22, y: 27, w: 5, fill: 'soft' },
      { x: 21, y: 28, w: 11, fill: 'ink' },
      { x: 24, y: 29, w: 8, fill: 'ink' },
      { x: 26, y: 30, w: 6, fill: 'ink' },
      // 흩어진 별
      { x: 2, y: 8, w: 2, h: 2, fill: 'soft' },
      { x: 17, y: 1, w: 2, h: 2, fill: 'soft' },
      { x: 5, y: 26, w: 2, h: 2, fill: 'soft' },
      { x: 29, y: 22, w: 2, h: 2, fill: 'soft' },
    ],
  },
  {
    id: 'background-constellation',
    // 두 갈래 연결선이 각각 화면 폭을 가로지른다. 짧게 끊으면 별 몇 개로만 보인다.
    accent: '#9DE7C2', soft: '#E8FFE0', ink: '#238B78',
    lines: [
      { x1: 1, y1: 3, x2: 6, y2: 7, fill: 'accent' },
      { x1: 6, y1: 7, x2: 12, y2: 3, fill: 'accent' },
      { x1: 12, y1: 3, x2: 18, y2: 8, fill: 'accent' },
      { x1: 2, y1: 25, x2: 8, y2: 29, fill: 'accent' },
      { x1: 8, y1: 29, x2: 15, y2: 26, fill: 'accent' },
      { x1: 15, y1: 26, x2: 22, y2: 30, fill: 'accent' },
      { x1: 22, y1: 30, x2: 29, y2: 24, fill: 'accent' },
    ],
    pixels: [
      { x: 0, y: 2, w: 2, h: 2, fill: 'soft' }, { x: 6, y: 7, fill: 'highlight' },
      { x: 11, y: 2, w: 2, h: 2, fill: 'soft' }, { x: 18, y: 8, fill: 'highlight' },
      { x: 1, y: 24, w: 2, h: 2, fill: 'soft' }, { x: 8, y: 29, fill: 'highlight' },
      { x: 14, y: 25, w: 2, h: 2, fill: 'soft' }, { x: 22, y: 30, fill: 'highlight' },
      { x: 28, y: 23, w: 2, h: 2, fill: 'soft' },
    ],
  },
  {
    id: 'background-dust-cloud',
    // 흙먼지가 아래를 층으로 덮고 위로는 옅은 띠 하나가 지나간다. 뭉치 둘로 두면
    // 동료로 읽힌다 — 아래 층이 폭 전체를 채워야 깔린 것으로 보인다.
    accent: '#E8D9B8', soft: '#FFF6E0', ink: '#B8A47C',
    pixels: [
      // 아래 먼지층
      { x: 0, y: 30, w: 32, h: 2, fill: 'accent' },
      { x: 0, y: 29, w: 32, fill: 'ink' },
      { x: 2, y: 28, w: 8, fill: 'ink' }, { x: 13, y: 28, w: 9, fill: 'ink' }, { x: 25, y: 28, w: 6, fill: 'ink' },
      { x: 3, y: 27, w: 5, fill: 'accent' }, { x: 15, y: 27, w: 6, fill: 'accent' }, { x: 26, y: 27, w: 3, fill: 'accent' },
      { x: 4, y: 26, w: 3, fill: 'soft' }, { x: 16, y: 26, w: 4, fill: 'soft' },
      // 위를 지나는 띠. accent(#E8D9B8)는 크림 배경과 붙어 거의 안 보인다 —
      // ink를 몸통으로 쓰고 accent·soft는 결만 넣는다
      { x: 2, y: 2, w: 11, fill: 'accent' },
      { x: 0, y: 3, w: 17, fill: 'ink' },
      { x: 1, y: 4, w: 18, fill: 'ink' }, { x: 4, y: 4, w: 8, fill: 'accent' },
      { x: 3, y: 5, w: 12, fill: 'ink' }, { x: 6, y: 5, w: 4, fill: 'soft' },
      { x: 6, y: 6, w: 6, fill: 'accent' },
      { x: 22, y: 10, w: 9, fill: 'ink' },
    ],
  },
  {
    id: 'background-deepspace',
    // 영웅 등급. 성간 먼지가 위아래를 통째로 눌러 덮고 왼쪽에 먼 은하가 뜬다.
    accent: '#5B4B8A', soft: '#B9A7E0', ink: '#332656',
    pixels: [
      // 위쪽 성간
      { x: 0, y: 0, w: 32, fill: 'ink' },
      { x: 0, y: 1, w: 19, fill: 'accent' }, { x: 24, y: 0, w: 8, fill: 'accent' },
      { x: 2, y: 2, w: 10, fill: 'ink' }, { x: 13, y: 2, w: 6, fill: 'ink' },
      { x: 0, y: 3, w: 8, fill: 'accent' }, { x: 2, y: 3, w: 4, fill: 'soft' },
      { x: 1, y: 4, w: 6, fill: 'ink' },
      // 먼 은하
      { x: 2, y: 6, w: 5, fill: 'accent' },
      { x: 1, y: 7, w: 8, fill: 'soft' },
      { x: 3, y: 8, w: 5, fill: 'accent' },
      // 아래쪽 성간
      { x: 9, y: 25, w: 22, fill: 'ink' },
      { x: 5, y: 26, w: 27, fill: 'accent' }, { x: 12, y: 26, w: 3, fill: 'soft' },
      { x: 3, y: 27, w: 29, fill: 'ink' }, { x: 24, y: 27, w: 2, fill: 'soft' },
      { x: 0, y: 28, w: 32, fill: 'accent' },
      { x: 0, y: 29, w: 32, h: 3, fill: 'ink' },
      // 흩어진 별
      { x: 16, y: 5, w: 2, h: 2, fill: 'soft' },
      { x: 9, y: 9, w: 2, h: 2, fill: 'accent' },
      { x: 0, y: 23, w: 2, h: 2, fill: 'soft' },
      { x: 29, y: 23, w: 2, h: 2, fill: 'accent' },
    ],
  },
  {
    id: 'background-lunar',
    // 아래를 지평선으로 통째로 덮는다. 고리 띠(y 11~21) 아래에서 시작해야 고리가 땅에
    // 묻히지 않는다. 위쪽은 먼 별 몇 개만 남겨 하늘을 비운다.
    accent: '#CFC8B4', soft: '#F2EEE2', ink: '#8E8676',
    pixels: [
      { x: 0, y: 27, w: 32, fill: 'ink' },
      { x: 0, y: 28, w: 32, fill: 'accent' },
      { x: 0, y: 29, w: 32, fill: 'accent' },
      { x: 0, y: 30, w: 32, h: 2, fill: 'ink' },
      { x: 4, y: 26, w: 5, fill: 'ink' }, { x: 5, y: 25, w: 3, fill: 'accent' },
      { x: 20, y: 26, w: 7, fill: 'ink' }, { x: 22, y: 25, w: 3, fill: 'accent' },
      { x: 12, y: 28, w: 5, fill: 'soft' }, { x: 13, y: 29, w: 3, fill: 'ink' },
      { x: 3, y: 3, w: 2, h: 2, fill: 'soft' },
      { x: 10, y: 2, w: 2, h: 2, fill: 'soft' },
      { x: 16, y: 4, w: 2, h: 2, fill: 'soft' },
      { x: 26, y: 10, w: 2, h: 2, fill: 'soft' },
    ],
  },
  {
    id: 'background-twin-moons',
    // 달 둘은 왼쪽·가운데 위에만 둔다. 오른쪽 위(x 20~31 · y 1~9)는 동료 자리라 비운다.
    // 달만 두면 동료 둘로 읽혀서, 아래위로 별을 흩어 하늘을 만든다.
    accent: '#C9D6E8', soft: '#F0F5FF', ink: '#8194AD',
    pixels: [
      { x: 4, y: 2, w: 3, fill: 'accent' },
      { x: 3, y: 3, w: 5, fill: 'accent' },
      { x: 2, y: 4, w: 7, fill: 'accent' },
      { x: 2, y: 5, w: 7, fill: 'accent' },
      { x: 3, y: 6, w: 5, fill: 'accent' },
      { x: 4, y: 7, w: 3, fill: 'accent' },
      { x: 4, y: 2, w: 2, fill: 'soft' }, { x: 3, y: 3, w: 3, fill: 'soft' },
      { x: 6, y: 6, w: 2, fill: 'ink' }, { x: 5, y: 7, w: 2, fill: 'ink' },
      { x: 13, y: 4, w: 2, fill: 'accent' },
      { x: 12, y: 5, w: 4, fill: 'accent' },
      { x: 12, y: 6, w: 4, fill: 'accent' },
      { x: 13, y: 7, w: 2, fill: 'accent' },
      { x: 13, y: 4, w: 2, fill: 'soft' }, { x: 14, y: 6, w: 2, fill: 'ink' },
      // 하늘
      { x: 0, y: 9, w: 2, h: 2, fill: 'accent' },
      { x: 17, y: 2, w: 2, h: 2, fill: 'soft' },
      { x: 5, y: 23, w: 2, h: 2, fill: 'accent' },
      { x: 2, y: 27, w: 2, h: 2, fill: 'soft' },
      { x: 9, y: 30, w: 2, h: 2, fill: 'accent' },
      { x: 16, y: 25, w: 2, h: 2, fill: 'soft' },
      { x: 22, y: 29, w: 2, h: 2, fill: 'accent' },
      { x: 28, y: 26, w: 2, h: 2, fill: 'soft' },
    ],
  },
] as const satisfies readonly PixelPreset[]

// 효과는 완주(성계 단계)에서만 뜬다. 고리 띠를 피하고, 배경이 덮어 버린 기존 완주 별
// 자리를 대신 채운다 — 그래서 스타터 세트에 기본 효과가 들어 있다.
//
// 효과만 움직인다(`anim`). 배경·동료는 정지다 — 화면에서 움직이는 것이 여럿이면
// 어느 것이 보상으로 얻은 효과인지 구분이 안 된다.
//
// `g`는 애니메이션 묶음이다. 별 하나가 여러 칸이라 번호로 묶어야 한 별의 가로줄과
// 세로줄이 같이 깜빡인다. `drift`에서는 번호 순서가 곧 빛이 흐르는 방향(꼬리 → 머리).
export const EFFECT_PRESETS = [
  {
    // 기본 효과도 팔레트 4단만 쓴다. 원래 고정색 soft(#FFF1AC)가 기본 태양색의
    // highlight와 같은 값이라 기본 모습은 그대로다.
    id: 'effect-sparkles',
    anim: 'twinkle',
    pixels: [
      { x: 3, y: 4, w: 3, fill: 'highlight', g: 0 }, { x: 4, y: 3, h: 3, fill: 'highlight', g: 0 },
      { x: 12, y: 3, w: 3, fill: 'highlight', g: 3 }, { x: 13, y: 2, h: 3, fill: 'light', g: 3 },
      { x: 4, y: 25, w: 3, fill: 'light', g: 6 }, { x: 5, y: 24, h: 3, fill: 'highlight', g: 6 },
      { x: 25, y: 26, w: 3, fill: 'highlight', g: 1 }, { x: 26, y: 25, h: 3, fill: 'highlight', g: 1 },
      { x: 16, y: 28, w: 3, fill: 'highlight', g: 4 }, { x: 17, y: 27, h: 3, fill: 'light', g: 4 },
    ],
  },
  {
    id: 'effect-comet-trail',
    // 꼬리 끝(g0)에서 머리(g4)로 빛이 흐른다. 머리를 가장 늦게 켜야 날아가는 방향이
    // 읽힌다 — 반대로 두면 뒤로 빨려 들어가는 것처럼 보인다.
    anim: 'drift',
    accent: '#FF9C7C', soft: '#FFE7C7', ink: '#B93D50',
    pixels: [
      { x: 1, y: 2, fill: 'ink', g: 0 },
      { x: 2, y: 3, w: 2, fill: 'ink', g: 1 },
      { x: 4, y: 4, w: 2, fill: 'ink', g: 2 },
      { x: 6, y: 5, w: 2, fill: 'accent', g: 3 },
      { x: 9, y: 6, w: 2, fill: 'soft', g: 4 },
      { x: 8, y: 7, w: 3, fill: 'soft', g: 4 }, { x: 9, y: 7, fill: 'highlight', g: 4 },
      { x: 9, y: 8, w: 2, fill: 'accent', g: 4 },
    ],
  },
  {
    id: 'effect-twinkle',
    // 기본 반짝임과 헷갈리지 않게 은백색 고정으로 두고 십자 셋만 쓴다.
    anim: 'twinkle',
    accent: '#DCE6F0', soft: '#FFFFFF', ink: '#A9B8CC',
    pixels: [
      { x: 5, y: 5, w: 3, fill: 'accent', g: 0 }, { x: 6, y: 4, h: 3, fill: 'soft', g: 0 },
      { x: 24, y: 27, w: 3, fill: 'accent', g: 3 }, { x: 25, y: 26, h: 3, fill: 'soft', g: 3 },
      { x: 14, y: 29, w: 3, fill: 'accent', g: 6 }, { x: 15, y: 28, h: 3, fill: 'soft', g: 6 },
    ],
  },
  {
    id: 'effect-stardust',
    // 별가루. 1px 점은 32px에서 사라지므로 2칸 조각으로만 흩뿌린다.
    // 조각이 하나씩 따로 떠서 묶음 번호를 안 준다 — 칸 순서가 그대로 박자가 된다.
    anim: 'twinkle',
    accent: '#FFD98A', soft: '#FFF7DC', ink: '#D9A62E',
    pixels: [
      { x: 2, y: 6, w: 2, fill: 'accent' }, { x: 5, y: 3, w: 2, fill: 'soft' },
      { x: 8, y: 7, w: 2, fill: 'ink' }, { x: 11, y: 4, w: 2, fill: 'accent' },
      { x: 14, y: 8, w: 2, fill: 'soft' }, { x: 3, y: 24, w: 2, fill: 'accent' },
      { x: 7, y: 27, w: 2, fill: 'soft' }, { x: 11, y: 25, w: 2, fill: 'ink' },
      { x: 15, y: 28, w: 2, fill: 'accent' }, { x: 19, y: 26, w: 2, fill: 'soft' },
      { x: 23, y: 29, w: 2, fill: 'accent' }, { x: 27, y: 27, w: 2, fill: 'ink' },
      { x: 29, y: 24, w: 2, fill: 'accent' },
    ],
  },
  {
    id: 'effect-shooting-star',
    // 영웅 등급. 긴 대각 궤적을 왼쪽 위에 둔다 — 오른쪽 위로 그으면 동료와 겹친다.
    // 꼬리 끝(g0)에서 머리(g6)로 흐르고, 아래 짧은 궤적은 그 중간 박자에 얹는다.
    anim: 'drift',
    accent: '#FFC64D', soft: '#FFF3C4', ink: '#C97A1E',
    pixels: [
      { x: 2, y: 2, w: 2, fill: 'ink', g: 0 },
      { x: 3, y: 3, w: 2, fill: 'ink', g: 1 },
      { x: 4, y: 4, w: 2, fill: 'accent', g: 2 },
      { x: 5, y: 5, w: 2, fill: 'accent', g: 3 },
      { x: 6, y: 6, w: 2, fill: 'soft', g: 4 },
      { x: 7, y: 7, w: 2, fill: 'soft', g: 5 },
      { x: 8, y: 8, w: 2, fill: 'soft', g: 6 }, { x: 7, y: 8, fill: 'accent', g: 6 },
      { x: 22, y: 25, w: 2, fill: 'ink', g: 2 },
      { x: 23, y: 26, w: 2, fill: 'accent', g: 3 },
      { x: 24, y: 27, w: 2, fill: 'soft', g: 4 },
      { x: 25, y: 28, w: 2, fill: 'soft', g: 5 },
    ],
  },
  {
    id: 'effect-halo',
    // 위아래 호. 행성을 감싸는 모양이지만 고리 띠(y 11~21)를 넘지 않게 y 8~9와
    // y 22~23에만 둔다. 오른쪽은 x 19에서 끊어 동료 자리를 비운다.
    // 두 호가 한 덩이로 숨쉰다 — 위아래가 따로 놀면 호가 아니라 두 물체로 읽힌다.
    anim: 'pulse',
    accent: '#FFE9A8', soft: '#FFFFFF', ink: '#E0B44A',
    pixels: [
      { x: 11, y: 8, w: 9, fill: 'ink', g: 0 },
      { x: 9, y: 9, w: 3, fill: 'accent', g: 0 }, { x: 17, y: 9, w: 3, fill: 'accent', g: 0 },
      { x: 12, y: 9, w: 5, fill: 'soft', g: 0 },
      { x: 11, y: 23, w: 9, fill: 'ink', g: 0 },
      { x: 9, y: 22, w: 3, fill: 'accent', g: 0 }, { x: 17, y: 22, w: 3, fill: 'accent', g: 0 },
      { x: 12, y: 22, w: 5, fill: 'soft', g: 0 },
    ],
  },
  {
    id: 'effect-glimmer',
    // 3×3 마름모 다섯. 십자보다 부드러워 보이게 가운데 줄만 3칸으로 넓힌다.
    anim: 'twinkle',
    accent: '#C7B8F0', soft: '#F2ECFF', ink: '#8A76C4',
    pixels: [
      { x: 4, y: 3, fill: 'soft', g: 0 }, { x: 3, y: 4, w: 3, fill: 'accent', g: 0 }, { x: 4, y: 5, fill: 'ink', g: 0 },
      { x: 12, y: 5, fill: 'soft', g: 2 }, { x: 11, y: 6, w: 3, fill: 'accent', g: 2 }, { x: 12, y: 7, fill: 'ink', g: 2 },
      { x: 6, y: 26, fill: 'soft', g: 4 }, { x: 5, y: 27, w: 3, fill: 'accent', g: 4 }, { x: 6, y: 28, fill: 'ink', g: 4 },
      { x: 25, y: 24, fill: 'soft', g: 6 }, { x: 24, y: 25, w: 3, fill: 'accent', g: 6 }, { x: 25, y: 26, fill: 'ink', g: 6 },
      { x: 17, y: 28, fill: 'soft', g: 8 }, { x: 16, y: 29, w: 3, fill: 'accent', g: 8 }, { x: 17, y: 30, fill: 'ink', g: 8 },
    ],
  },
] as const satisfies readonly PixelPreset[]

export function presetById<T extends { id: string }>(presets: readonly T[], id?: string): T | undefined {
  return id ? presets.find((preset) => preset.id === id) : undefined
}
