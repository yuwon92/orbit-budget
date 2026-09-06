// Orbit 예산을 읽는 통로. 지금은 같은 origin의 IndexedDB를 직접 읽는다.
//
// 홈 화면에 설치된 두 앱이 저장소를 나눠 갖는 환경(iOS)에서는 이 읽기가
// 빈 DB를 만나게 된다. 그때는 이 파일의 구현만 서버 조회로 바꾸면 되고
// 화면 코드는 건드리지 않는다.
import { getOrbitSnapshot, type OrbitBudgetSnapshot } from '@orbit/bridge'

const CACHE_KEY = 'wish-budget-snapshot'

export interface BudgetView {
  snapshot: OrbitBudgetSnapshot | null
  /** 이번에 직접 읽은 값인지, 저장해 둔 마지막 값인지 */
  stale: boolean
  error: string | null
}

function readCache(): OrbitBudgetSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as OrbitBudgetSnapshot) : null
  } catch {
    return null
  }
}

function writeCache(snapshot: OrbitBudgetSnapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot))
  } catch { /* 저장소 접근 불가 */ }
}

/**
 * 예산 요약을 가져온다. 읽기에 실패하거나 Orbit에 데이터가 없으면
 * 마지막으로 성공했던 값을 stale로 돌려준다 — 숫자가 0으로 튀는 것보다 낫다.
 */
export async function loadBudgetView(today: string): Promise<BudgetView> {
  try {
    const snapshot = await getOrbitSnapshot(today)
    if (snapshot.connected) {
      writeCache(snapshot)
      return { snapshot, stale: false, error: null }
    }
    // DB는 열렸는데 내용이 비었다. 저장소가 분리됐거나 Orbit을 아직 안 쓴 경우
    return { snapshot: readCache(), stale: true, error: null }
  } catch (error) {
    return {
      snapshot: readCache(),
      stale: true,
      error: error instanceof Error ? error.message : '예산을 읽지 못했다',
    }
  }
}

/** '3시간 전'처럼 마지막 확인 시점을 사람 말로 */
export function sinceLabel(timestamp: number, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000))
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}
