// PWA 아이콘 생성 스크립트 (의존성 없음). 실행: node scripts/gen-icons.ts
// 로고 구슬과 같은 시안→블루→라벤더→핑크 그라디언트 행성을 그린다.
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const CRC_TABLE: number[] = []
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}
function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(size: number, pixels: Buffer): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const stride = size * 4 + 1
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0 // filter: none
    pixels.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

type Rgb = [number, number, number]
const STOPS: { at: number; color: Rgb }[] = [
  { at: 0, color: [0x83, 0xe4, 0xe3] }, // cosmic cyan
  { at: 0.45, color: [0x8e, 0xbe, 0xff] }, // planet blue
  { at: 0.76, color: [0xb7, 0xa7, 0xf8] }, // orbit lavender
  { at: 1, color: [0xe4, 0xb7, 0xe9] }, // stardust pink
]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function gradient(t: number): Rgb {
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i].at) {
      const k = (t - STOPS[i - 1].at) / (STOPS[i].at - STOPS[i - 1].at)
      const [a, b] = [STOPS[i - 1].color, STOPS[i].color]
      return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]
    }
  }
  return STOPS[STOPS.length - 1].color
}

function render(size: number, opts: { bg: Rgb | null; radiusRatio: number }): Buffer {
  const px = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const r = size * opts.radiusRatio
  const hx = size * 0.36
  const hy = size * 0.34
  const hs = 2 * (size * 0.13) ** 2
  const sx = size * 0.68
  const sy = size * 0.72
  const ss = 2 * (size * 0.34) ** 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const d = Math.hypot(x - cx, y - cy)
      const cover = Math.min(1, Math.max(0, (r - d) / (size * 0.006)))
      let base: Rgb | null = opts.bg
      if (cover > 0) {
        const t = (x + y) / (2 * size)
        let [cr, cg, cb] = gradient(t)
        const hw = 0.8 * Math.exp(-((x - hx) ** 2 + (y - hy) ** 2) / hs)
        cr = lerp(cr, 255, hw)
        cg = lerp(cg, 255, hw)
        cb = lerp(cb, 255, hw)
        const sw = 0.26 * Math.exp(-((x - sx) ** 2 + (y - sy) ** 2) / ss)
        cr = lerp(cr, 0x5a, sw)
        cg = lerp(cg, 0x4c, sw)
        cb = lerp(cb, 0x92, sw)
        base = base
          ? [lerp(base[0], cr, cover), lerp(base[1], cg, cover), lerp(base[2], cb, cover)]
          : [cr, cg, cb]
      }
      if (base) {
        px[i] = Math.round(base[0])
        px[i + 1] = Math.round(base[1])
        px[i + 2] = Math.round(base[2])
        px[i + 3] = opts.bg ? 255 : Math.round(255 * cover)
      }
    }
  }
  return px
}

mkdirSync('public', { recursive: true })
writeFileSync('public/icon-192.png', encodePng(192, render(192, { bg: null, radiusRatio: 0.46 })))
writeFileSync('public/icon-512.png', encodePng(512, render(512, { bg: null, radiusRatio: 0.46 })))
writeFileSync('public/icon-maskable-512.png', encodePng(512, render(512, { bg: [0xee, 0xf2, 0xfa], radiusRatio: 0.36 })))
console.log('icons written: public/icon-192.png, icon-512.png, icon-maskable-512.png')
