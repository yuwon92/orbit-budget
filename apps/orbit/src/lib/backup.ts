// 전체 백업 받기·복원. 형식 검사는 backupFormat.ts(순수), 여기서는 두 DB를 읽고 쓴다.
import type Dexie from 'dexie'
import { wishDb } from '@orbit/wish-bridge/db'
import { db } from './db'
import { PLANNED_INCOME_KEY } from './settings'
import { buildBackup, type Backup, type DbDump, type DbSchema } from './backupFormat'

/** Wish가 저장해 두는 예산 요약(apps/wish/src/lib/budget.ts). 복원 뒤 옛 숫자를 보여 주지 않게 비운다 */
const WISH_SNAPSHOT_KEY = 'wish-budget-snapshot'

const schemaOf = (source: Dexie): DbSchema => ({
  version: source.verno,
  keys: Object.fromEntries(source.tables.map((table) => [table.name, String(table.schema.primKey.keyPath)])),
})

/** 지금 앱의 두 DB 스키마. 연 뒤에 읽어야 버전이 실제 값이다 */
export async function backupSchema() {
  await Promise.all([db.open(), wishDb.open()])
  return { budget: schemaOf(db), wish: schemaOf(wishDb) }
}

/** 한 읽기 트랜잭션으로 묶어, 읽는 도중 다른 탭의 저장이 섞이지 않게 한다 */
function dump(source: Dexie): Promise<DbDump> {
  return source.transaction('r', source.tables, async () => {
    const entries = await Promise.all(source.tables.map(async (table) => [table.name, await table.toArray()] as const))
    return { version: source.verno, tables: Object.fromEntries(entries) }
  })
}

/** DB 하나를 통째로 바꾼다. 한 트랜잭션이라 도중에 실패하면 지운 것까지 함께 되돌아간다 */
function replace(target: Dexie, tables: Record<string, unknown[]>): Promise<void> {
  return target.transaction('rw', target.tables, async () => {
    for (const table of target.tables) {
      await table.clear()
      const rows = tables[table.name] ?? []
      if (rows.length) await table.bulkAdd(rows)
    }
  })
}

function readSettings(): Backup['settings'] {
  try {
    const value = localStorage.getItem(PLANNED_INCOME_KEY)
    return value === 'include' || value === 'exclude' ? { plannedIncome: value } : {}
  } catch {
    return {}
  }
}

export async function downloadBackup(filename: string) {
  const [budget, wish] = await Promise.all([dump(db), dump(wishDb)])
  downloadFile(JSON.stringify(buildBackup(budget, wish, readSettings(), Date.now())), filename, 'application/json')
}

/**
 * 복원. 부르기 전에 `parseBackup`을 통과해야 한다.
 *
 * 두 DB는 한 트랜잭션으로 묶을 수 없다. 예산만 바뀌고 위시에서 멈추면 두 숫자가
 * 어긋나므로, 먼저 읽어 둔 원래 데이터로 둘 다 되돌리고 오류를 다시 던진다.
 */
export async function restoreBackup(backup: Backup) {
  const [budgetBefore, wishBefore] = await Promise.all([dump(db), dump(wishDb)])
  try {
    await replace(db, backup.budget.tables)
    await replace(wishDb, backup.wish.tables)
  } catch (error) {
    await replace(db, budgetBefore.tables).catch(() => undefined)
    await replace(wishDb, wishBefore.tables).catch(() => undefined)
    throw error
  }
  try {
    if (backup.settings.plannedIncome) localStorage.setItem(PLANNED_INCOME_KEY, backup.settings.plannedIncome)
    else localStorage.removeItem(PLANNED_INCOME_KEY)
    localStorage.removeItem(WISH_SNAPSHOT_KEY)
  } catch { /* 저장소 접근 불가 */ }
}

export function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // 바로 해제하면 일부 브라우저(Safari·Firefox)가 다운로드를 시작하기 전에 주소가 사라진다
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
