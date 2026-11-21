type Cell = string | number | null | undefined

const PHONE = /^\+[\d\s().-]+$/

// guest names and notes come from booking platforms, so a cell like =HYPERLINK(...)
// would run as a formula in Excel or Sheets. phone numbers keep their leading +.
function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s) && !PHONE.test(s) && typeof value !== 'number') s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
