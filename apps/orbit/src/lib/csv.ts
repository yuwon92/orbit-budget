import type { Category, Transaction } from './types'

// 콤마, 따옴표, 줄바꿈이 든 값은 CSV 규칙대로 따옴표로 감싼다.
const escapeCsv = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/** 자유비용 제외 여부까지 내보내야 위시 구매를 다시 가져올 때 이중 차감되지 않는다. */
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
        String(t.excludedFromFreeAmount ?? false),
      ].join(','),
    )
  return ['date,type,category,amount,memo,is_planned,excluded_from_free_amount', ...rows].join('\n')
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
