// 개발 전용 도구. `import.meta.env.DEV` 안에서만 부른다 — 프로덕션 빌드에서는
// 호출부가 접히면서 이 모듈이 통째로 트리셰이킹된다.
//
// **XP는 저장하지 않는다**(`xp.ts` 헤더). 이벤트와 수령 기록에서 매번 다시 계산하므로
// 「레벨을 5로 맞춘다」 같은 것을 저장으로는 할 수 없다. 대신 계산 결과에 더할 가산값을
// localStorage에 두고 App이 `totalXp`에 얹는다. 그러면 레벨 판정·레벨업 연출·미수령
// 보상까지 실제 경로를 그대로 탄다.
//
// ⚠ 가산값을 되돌리면 레벨이 내려가지만 이미 수령한 레벨 기록은 남는다. 개발용
// 오리진에서만 쓸 것.
import type { Reward } from '../components/RewardOverlay'

const XP_KEY = 'wish-dev-xp'

export function readDevXp(): number {
  try {
    return Number(window.localStorage.getItem(XP_KEY)) || 0
  } catch {
    return 0
  }
}

export function writeDevXp(value: number): number {
  const next = Math.max(0, Math.round(value))
  try {
    if (next > 0) window.localStorage.setItem(XP_KEY, String(next))
    else window.localStorage.removeItem(XP_KEY)
  } catch {
    // 사생활 보호 모드 등에서 던진다. 가산값은 이번 세션에만 남는다
  }
  return next
}

/** 연출 미리보기용 표본. 저장을 건드리지 않고 오버레이만 띄운다 */
export const SAMPLE_REWARDS: { label: string; reward: Reward }[] = [
  { label: '레벨업', reward: { kind: 'levelup', from: 4, to: 5, title: 'VOYAGER', unlock: '별빛 궤도 링' } },
  { label: '보상', reward: { kind: 'levelReward', level: 12, dust: 320, itemName: '빛무리' } },
  { label: '완주', reward: { kind: 'complete', name: '헤드폰', seed: 41, xp: 100, date: '2026-09-10' } },
]
