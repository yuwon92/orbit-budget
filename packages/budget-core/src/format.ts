export const money = (value: number) => new Intl.NumberFormat('ko-KR').format(value)

/** 0=일 … 6=토. 카테고리 요일 선택과 반복 거래 주 단위가 같은 이름을 쓴다. */
export const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

/** [1,2,3,4,5] -> "월~금", [1,3,5] -> "월·수·금". 연속 3개 이상이면 물결표로 줄인다. */
export function formatWeekdays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b)
  const runs: number[][] = []
  for (const day of sorted) {
    const last = runs[runs.length - 1]
    if (last && day === last[last.length - 1] + 1) last.push(day)
    else runs.push([day])
  }
  return runs
    .map((run) =>
      run.length >= 3
        ? `${WEEKDAY_NAMES[run[0]]}~${WEEKDAY_NAMES[run[run.length - 1]]}`
        : run.map((d) => WEEKDAY_NAMES[d]).join('·'),
    )
    .join('·')
}
