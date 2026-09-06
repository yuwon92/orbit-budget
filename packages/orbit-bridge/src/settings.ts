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
