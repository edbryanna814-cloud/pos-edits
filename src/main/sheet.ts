import { unzipSync } from 'fflate'

// Reads the first sheet of an .xlsx file, or a CSV / TXT / DAT export (comma, semicolon or tab),
// into rows of text. Used by the product import and the attendance-machine import.
// shortcut: .xlsx only (no old binary .xls); save such files as .xlsx or CSV. First worksheet only.

export const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_UNZIPPED_BYTES = 60 * 1024 * 1024
const MAX_ROWS = 20000

export class SheetError extends Error {}

const unescapeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()])

/** All text runs inside one XML element (rich text has several <t>). */
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('')

const columnIndex = (ref: string) => [...ref.replace(/\d+$/, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1

function readXlsx(data: Uint8Array): string[][] {
  let total = 0
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data, {
      filter: (f) => {
        const wanted = f.name === 'xl/sharedStrings.xml' || f.name === 'xl/worksheets/sheet1.xml'
        if (wanted) total += f.originalSize
        if (total > MAX_UNZIPPED_BYTES) throw new SheetError('SHEET_TOO_LARGE')
        return wanted
      }
    })
  } catch (error) {
    if (error instanceof SheetError) throw error
    throw new SheetError('SHEET_UNREADABLE')
  }
  const sheet = files['xl/worksheets/sheet1.xml']
  if (!sheet) throw new SheetError('SHEET_UNREADABLE')
  const decoder = new TextDecoder()
  const shared = files['xl/sharedStrings.xml'] ? [...decoder.decode(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1])) : []
  const rows: string[][] = []
  for (const row of decoder.decode(sheet).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    if (rows.length >= MAX_ROWS) throw new SheetError('SHEET_TOO_LARGE')
    const cells: string[] = []
    for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1]
      const type = /\bt="(\w+)"/.exec(attrs)?.[1]
      const inner = c[2] ?? ''
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
      const value = type === 's' ? shared[Number(v)] ?? '' : type === 'inlineStr' ? texts(inner) : v !== undefined ? unescapeXml(v) : ''
      cells[ref ? columnIndex(ref) : cells.length] = value
    }
    rows.push(Array.from(cells, (x) => x ?? ''))
  }
  return rows
}

/** Quote-aware split of delimited text. */
function readDelimited(text: string): string[][] {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n|\r/).filter((l) => l.trim() !== '')
  if (lines.length > MAX_ROWS) throw new SheetError('SHEET_TOO_LARGE')
  const first = lines[0] ?? ''
  const delimiter = ['\t', ';', ','].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  return lines.map((line) => {
    const out: string[] = []
    let cell = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') quoted = false
        else cell += ch
      } else if (ch === '"' && cell === '') quoted = true
      else if (ch === delimiter) { out.push(cell.trim()); cell = '' } else cell += ch
    }
    out.push(cell.trim())
    return out
  })
}

export function readSheet(data: Uint8Array, fileName: string): string[][] {
  if (data.byteLength > MAX_FILE_BYTES) throw new SheetError('SHEET_TOO_LARGE')
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'xlsx') return readXlsx(data)
  if (ext === 'csv' || ext === 'txt' || ext === 'dat' || ext === 'tsv') return readDelimited(new TextDecoder().decode(data))
  throw new SheetError('SHEET_TYPE_UNSUPPORTED')
}

/** Excel stores dates as day numbers since 1899-12-30 (local time, no zone). */
export function excelDate(value: string): Date | null {
  const n = Number(value)
  if (!value || !Number.isFinite(n) || n < 20000 || n > 80000) return null
  const ms = Math.round((n - 25569) * 86400000)
  const utc = new Date(ms)
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), utc.getUTCHours(), utc.getUTCMinutes(), utc.getUTCSeconds())
}
