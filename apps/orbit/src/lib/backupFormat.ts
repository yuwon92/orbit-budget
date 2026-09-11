// 전체 백업 파일 형식. 예산(orbital-budget)과 위시(orbital-wish) 두 DB를 한 파일에
// 담는다 — 위시 구매가 예산 거래를 만들고 위시 저금이 자유비용에서 빠지므로, 한쪽만
// 되돌리면 두 숫자가 어긋난다.
//
// 순수 함수만 둔다(검산 스크립트가 읽는다). Dexie 읽기·쓰기는 backup.ts.

export const BACKUP_APP = 'orbit-suite'
export const BACKUP_FORMAT = 1

export interface DbDump {
  /** Dexie 스키마 버전. 새 버전 앱의 백업은 받지 않는다 */
  version: number
  /** 표 이름 → 행 목록 */
  tables: Record<string, unknown[]>
}

export interface Backup {
  app: typeof BACKUP_APP
  format: number
  exportedAt: number
  budget: DbDump
  wish: DbDump
  /** 계산에 영향을 주는 localStorage 설정. 테마처럼 보기만 바꾸는 값은 넣지 않는다 */
  settings: { plannedIncome?: 'include' | 'exclude' }
}

/** 지금 앱의 스키마. 표 이름 → 기본키 필드 */
export interface DbSchema {
  version: number
  keys: Record<string, string>
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; reason: string }

export function buildBackup(budget: DbDump, wish: DbDump, settings: Backup['settings'], now: number): Backup {
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: now, budget, wish, settings }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const fail = (reason: string): ParseResult => ({ ok: false, reason })

/**
 * 백업 파일 검사. 복원은 지금 데이터를 지우고 바꾸므로 **쓰기 전에 전부 확인**한다.
 *
 * 받지 않는 것: 다른 JSON · 새 버전 앱의 백업(지금 코드가 모르는 필드를 해석할 수
 * 없다) · 모르는 표 · 기본키가 없거나 겹치는 행(Dexie가 넣지 못해 복원 도중 멈춘다).
 * 옛 버전 백업은 받는다 — 그때 없던 표는 빈 표로 복원된다.
 */
export function parseBackup(text: string, current: { budget: DbSchema; wish: DbSchema }): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail('백업 파일 아님')
  }
  if (!isObject(data) || data.app !== BACKUP_APP || typeof data.format !== 'number') return fail('백업 파일 아님')
  if (data.format > BACKUP_FORMAT) return fail('새 버전 앱의 백업 · 앱 업데이트 후 복원')
  if (typeof data.exportedAt !== 'number') return fail('백업 파일 손상')

  const budget = checkDump(data.budget, current.budget, '예산')
  if (typeof budget === 'string') return fail(budget)
  const wish = checkDump(data.wish, current.wish, '위시')
  if (typeof wish === 'string') return fail(wish)

  const settings = isObject(data.settings) ? data.settings : {}
  const plannedIncome = settings.plannedIncome === 'include' || settings.plannedIncome === 'exclude'
    ? settings.plannedIncome
    : undefined
  return { ok: true, backup: buildBackup(budget, wish, plannedIncome ? { plannedIncome } : {}, data.exportedAt) }
}

/** DB 하나를 검사한다. 통과하면 DbDump, 아니면 이유 문구 */
function checkDump(value: unknown, schema: DbSchema, label: string): DbDump | string {
  if (!isObject(value) || typeof value.version !== 'number' || !isObject(value.tables)) return `${label} 데이터 손상`
  if (value.version > schema.version) return '새 버전 앱의 백업 · 앱 업데이트 후 복원'
  const tables: Record<string, unknown[]> = {}
  for (const [name, rows] of Object.entries(value.tables)) {
    const key = schema.keys[name]
    if (key === undefined) return `${label} 데이터에 모르는 표 · ${name}`
    if (!Array.isArray(rows)) return `${label} 데이터 손상 · ${name}`
    const seen = new Set<string | number>()
    for (const row of rows) {
      if (!isObject(row)) return `${label} 데이터 손상 · ${name}`
      const id = row[key]
      if (typeof id !== 'string' && typeof id !== 'number') return `${label} 데이터 손상 · ${name}`
      if (seen.has(id)) return `${label} 데이터 중복 · ${name}`
      seen.add(id)
    }
    tables[name] = rows
  }
  return { version: value.version, tables }
}
