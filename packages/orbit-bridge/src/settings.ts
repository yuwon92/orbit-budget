// Orbit의 앱 설정 중 계산에 영향을 주는 값. Wish도 같은 값을 읽어야
// 두 앱이 같은 자유비용 숫자를 보여준다.

/** 예정 수입을 자유비용에 넣을지. 저장된 적이 없으면 포함이 기본 */
export const PLANNED_INCOME_KEY = 'orbit-planned-income'

export function readPlannedIncome(): boolean {
  try {
    return localStorage.getItem(PLANNED_INCOME_KEY) !== 'exclude'
  } catch {
    return true
  }
}

export function writePlannedIncome(include: boolean) {
  // 시크릿 모드 등에서 쓰기가 막혀도 화면은 그대로 둔다
  try {
    localStorage.setItem(PLANNED_INCOME_KEY, include ? 'include' : 'exclude')
  } catch { /* 저장 불가 */ }
}

/**
 * 이월을 시작할 달('yyyy-MM'). 이 달 이전 기록은 이월 계산에 넣지 않는다.
 *
 * 기능을 켠 시점을 굳혀 두는 값이다. 없으면 첫 기록 달부터 전부 소급되는데,
 * 앱을 쓰기 시작하던 달의 엉성한 기록(수입만 넣고 지출은 빠뜨린 달 등)까지
 * 지금 자유비용에 더해져 버린다.
 */
export const CARRYOVER_START_KEY = 'orbit-carryover-start'

export function readCarryoverStart(): string | null {
  try {
    const stored = localStorage.getItem(CARRYOVER_START_KEY)
    return stored && /^\d{4}-\d{2}$/.test(stored) ? stored : null
  } catch {
    return null
  }
}

/**
 * 저장된 적이 없으면 이 달로 굳히고, 그 값을 돌려준다.
 * 저장이 막힌 환경에서는 늘 이번 달이 되어 이월이 0이다 — 숫자가 갑자기 뛰는 쪽보다 안전하다.
 */
export function ensureCarryoverStart(month: string): string {
  const stored = readCarryoverStart()
  if (stored) return stored
  try {
    localStorage.setItem(CARRYOVER_START_KEY, month)
  } catch { /* 저장 불가 */ }
  return month
}
