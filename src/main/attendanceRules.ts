import { excelDate } from './sheet'

// Fingerprint attendance: reading the machine's export and working out hours. No database here (tested).
// The machine's user number is the app's user ID (Users page). Clock in / clock out / break out / break in.

export type PunchType = 'in' | 'out' | 'break_out' | 'break_in' | 'punch'
export type Punch = { userNo: number; at: Date; type: PunchType }

const H = {
  user: ['ac-no', 'ac-no.', 'ac no', 'no.', 'no', 'user id', 'userid', 'user no', 'user no.', 'pin', 'enroll no', 'enrollnumber', 'emp no', 'employee no', 'id', 'رقم المستخدم', 'الرقم', 'رقم الموظف'],
  datetime: ['date/time', 'datetime', 'date time', 'checktime', 'check time', 'التاريخ والوقت'],
  date: ['date', 'التاريخ'],
  time: ['time', 'الوقت'],
  status: ['status', 'state', 'type', 'punch state', 'checktype', 'check type', 'الحالة', 'النوع']
}

const STATUS: Record<string, PunchType> = {
  '0': 'in', 'c/in': 'in', 'check in': 'in', 'check-in': 'in', checkin: 'in', in: 'in', 'clock in': 'in', 'overtime in': 'in', 'ot in': 'in', '4': 'in', حضور: 'in', دخول: 'in',
  '1': 'out', 'c/out': 'out', 'check out': 'out', 'check-out': 'out', checkout: 'out', out: 'out', 'clock out': 'out', 'overtime out': 'out', 'ot out': 'out', '5': 'out', انصراف: 'out', خروج: 'out',
  '2': 'break_out', 'break out': 'break_out', 'break-out': 'break_out', 'بداية استراحة': 'break_out', استراحة: 'break_out',
  '3': 'break_in', 'break in': 'break_in', 'break-in': 'break_in', 'نهاية استراحة': 'break_in', 'عودة من استراحة': 'break_in'
}

const norm = (s: string) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/** "2026-11-16 08:01:22", "16/11/2026 8:01 AM", Excel day numbers; machine times are local. */
export function parseMachineTime(value: string): Date | null {
  const v = String(value ?? '').trim()
  const serial = excelDate(v)
  if (serial) return serial
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(v)
    ?? /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(v)
  if (!m) return null
  const ymd = m[1].length === 4 ? [+m[1], +m[2], +m[3]] : [+m[3], +m[2], +m[1]]
  let hour = +m[4]
  const ampm = m[7]?.toLowerCase()
  if (ampm === 'pm' && hour < 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0
  const d = new Date(ymd[0], ymd[1] - 1, ymd[2], hour, +m[5], +(m[6] ?? 0))
  return Number.isNaN(d.getTime()) || d.getDate() !== ymd[2] ? null : d
}

/**
 * Rows from the machine's export. With a header row (Excel export): user number, date/time (or date + time)
 * and status columns found by name. Without one (attlog.dat): user, date-time, device, state, ….
 * shortcut: headerless files assume the ZKTeco attlog column order; other layouts need a header row.
 */
export function parsePunches(rows: string[][]): { punches: Punch[]; skipped: number } {
  const header = (rows[0] ?? []).map(norm)
  const find = (names: string[]) => header.findIndex((h) => names.includes(h))
  const hasHeader = find(H.user) >= 0 && (find(H.datetime) >= 0 || find(H.date) >= 0 || find(H.time) >= 0)
  const col = hasHeader
    ? { user: find(H.user), datetime: find(H.datetime), date: find(H.date), time: find(H.time), status: find(H.status) }
    : { user: 0, datetime: 1, date: -1, time: -1, status: 3 }
  const punches: Punch[] = []
  let skipped = 0
  for (const r of hasHeader ? rows.slice(1) : rows) {
    if (!r.some((c) => String(c ?? '').trim())) continue
    const userNo = Number(String(r[col.user] ?? '').trim())
    const when = col.datetime >= 0 ? String(r[col.datetime] ?? '') : `${r[col.date] ?? ''} ${r[col.time] ?? ''}`
    const at = parseMachineTime(when) ?? (col.date >= 0 && col.time >= 0 ? combine(r[col.date], r[col.time]) : null)
    if (!(Number.isInteger(userNo) && userNo >= 1) || !at) {
      skipped++
      continue
    }
    punches.push({ userNo, at, type: col.status >= 0 ? STATUS[norm(r[col.status])] ?? 'punch' : 'punch' })
  }
  return { punches, skipped }
}

/** Excel keeps a date column and a time column as two day-numbers (date whole, time fraction). */
function combine(date: string, time: string): Date | null {
  const d = excelDate(String(date ?? ''))
  const t = Number(time)
  if (!d || !Number.isFinite(t) || t < 0 || t >= 1) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, Math.round(t * 86400))
}

export const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export type DaySummary = { firstIn: Date | null; lastOut: Date | null; workedMs: number; breakMs: number; open: boolean }

/**
 * One person's punches on one day, oldest first. Work runs from an "in" (or the return from a break) to an
 * "out" (or a break start); a break runs from break-out to break-in. Punches without a status alternate in,
 * out, in, out. A missing clock-out leaves the last period uncounted (open = true).
 */
export function summarizeDay(punches: { at: Date; type: PunchType }[]): DaySummary {
  let start: number | null = null
  let breakStart: number | null = null
  let workedMs = 0
  let breakMs = 0
  let firstIn: Date | null = null
  let lastOut: Date | null = null
  punches.forEach((p, i) => {
    const t = p.at.getTime()
    const type = p.type === 'punch' ? (i % 2 === 0 ? 'in' : 'out') : p.type
    if (type === 'in' || type === 'break_in') {
      if (type === 'break_in' && breakStart !== null) { breakMs += t - breakStart; breakStart = null }
      if (start === null) start = t
      if (type === 'in' && !firstIn) firstIn = p.at
    } else {
      if (start !== null) { workedMs += t - start; start = null }
      if (type === 'break_out') breakStart = t
      else lastOut = p.at
    }
  })
  return { firstIn, lastOut, workedMs, breakMs, open: start !== null }
}
