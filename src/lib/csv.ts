// P1-6 — minimal client-side CSV builder. RFC 4180-ish: any cell that
// contains a quote, comma, or newline is wrapped in double quotes with
// internal quotes doubled. Excel reads this cleanly.
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined): string => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const lines: string[] = []
  lines.push(headers.map(escape).join(','))
  for (const r of rows) lines.push(r.map(escape).join(','))
  return lines.join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  // BOM keeps Excel happy with non-ASCII characters.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
