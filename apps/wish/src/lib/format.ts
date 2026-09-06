/** 오늘 날짜. Orbit과 같은 'yyyy-MM-dd' 로컬 문자열 */
export const todayString = () => new Date().toLocaleDateString('sv-SE')

/** '2026-09-06' → '2026.09.06' */
export const formatDate = (date: string) => date.replaceAll('-', '.')

/** LV. 04처럼 두 자리로 */
export const pad2 = (value: number) => String(value).padStart(2, '0')
