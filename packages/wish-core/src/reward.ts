// 레벨 보상 수령 판정. 보상표 자체는 Phase 4에서 붙는다.
// 여기서는 「무엇이 아직 미수령인가」만 계산한다. 순수 함수.

/**
 * 아직 수령 기록이 없는 레벨. 현재 레벨을 넘지 않는다.
 *
 * 이미 레벨이 오른 채로 보상 기능을 만나는 기존 사용자를 위한 계산이다. 지난
 * 레벨의 보상을 자동으로 지급하지 않는다 — 레벨 보상에는 고르는 것이 섞여 있어서
 * 대신 골라 주면 안 된다. 미수령분은 관측소 보상 카드에 쌓아 두고 직접 받게 한다.
 */
export function unclaimedLevels(level: number, claimed: number[]): number[] {
  const done = new Set(claimed)
  return Array.from({ length: Math.max(0, level) }, (_, index) => index + 1)
    .filter((value) => !done.has(value))
}
