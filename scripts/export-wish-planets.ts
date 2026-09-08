// Wish 행성 성장 단계를 SVG와 투명 PNG로 추출한다.
// 실행: node scripts/export-wish-planets.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { buildBlocks, GRID } from '../apps/wish/src/planet.ts'

const OUTPUT_DIR = 'exports/wish-planets'
const PNG_SIZE = 256
const SEED = 7

const STAGES = [
  { file: '01-seed', name: '티끌', progress: 0 },
  { file: '02-moon', name: '위성', progress: 15 },
  { file: '03-planet', name: '행성', progress: 35 },
  { file: '04-ring', name: '고리', progress: 60 },
  { file: '05-satellites', name: '위성대', progress: 80 },
  { file: '06-system', name: '성계', progress: 100 },
] as const

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

function crc32(buffer: Buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

function encodePng(size: number, pixels: Buffer) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6

  const stride = size * 4 + 1
  const scanlines = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y += 1) {
    scanlines[y * stride] = 0
    pixels.copy(scanlines, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function hexToRgba(hex: string): [number, number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
    255,
  ]
}

function svgOf(progress: number, name: string) {
  const rects = buildBlocks(progress, SEED)
    .map((block) => `  <rect x="${block.x}" y="${block.y}" width="${block.w}" height="${block.h}" fill="${block.fill}"/>`)
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PNG_SIZE}" height="${PNG_SIZE}" viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges" role="img" aria-label="${name}">\n${rects}\n</svg>\n`
}

function pngOf(progress: number) {
  const pixels = Buffer.alloc(PNG_SIZE * PNG_SIZE * 4)
  const scale = PNG_SIZE / GRID
  for (const block of buildBlocks(progress, SEED)) {
    const rgba = hexToRgba(block.fill)
    for (let y = block.y * scale; y < (block.y + block.h) * scale; y += 1) {
      for (let x = block.x * scale; x < (block.x + block.w) * scale; x += 1) {
        const offset = (y * PNG_SIZE + x) * 4
        pixels[offset] = rgba[0]
        pixels[offset + 1] = rgba[1]
        pixels[offset + 2] = rgba[2]
        pixels[offset + 3] = rgba[3]
      }
    }
  }
  return encodePng(PNG_SIZE, pixels)
}

mkdirSync(OUTPUT_DIR, { recursive: true })
for (const stage of STAGES) {
  writeFileSync(`${OUTPUT_DIR}/${stage.file}.svg`, svgOf(stage.progress, stage.name))
  writeFileSync(`${OUTPUT_DIR}/${stage.file}.png`, pngOf(stage.progress))
}

writeFileSync(
  `${OUTPUT_DIR}/README.md`,
  `# Wish 행성 성장 단계\n\n앱의 \`buildBlocks()\`에서 seed ${SEED}로 추출. SVG와 256×256 투명 PNG.\n\n${STAGES.map((stage) => `- ${stage.file}: ${stage.name} (${stage.progress}%)`).join('\n')}\n`,
)

console.log(`${STAGES.length} stages exported to ${OUTPUT_DIR} as SVG and PNG`)
