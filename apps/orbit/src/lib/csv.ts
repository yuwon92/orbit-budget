import type { Category, Transaction } from './types'

// 콤마, 따옴표, 줄바꿈이 든 값은 CSV 규칙대로 따옴표로 감싼다.
const escapeCsv = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/** 앱 가이드 §6 컬럼 구성: date,type,category,amount,memo,is_planned */
export function buildCsv(transactions: Transaction[], categories: Category[]): string {
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  const rows = [...transactions]
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    .map((t) =>
      [
        t.date,
        t.type,
        escapeCsv(t.categoryId ? nameById.get(t.categoryId) ?? '' : ''),
        String(t.amount),
        escapeCsv(t.memo),
        String(t.isPlanned),
      ].join(','),
    )
  return ['date,type,category,amount,memo,is_planned', ...rows].join('\n')
}

/** BOM을 붙여 엑셀에서 한글이 깨지지 않게 다운로드한다. */
export function downloadCsv(csvContent: string, filename: string) {
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
