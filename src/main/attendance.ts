import type { Db } from 'mongodb'
import { getDb } from './db'
import { isAdminViewer, logAudit } from './auth'
import { localDay, summarizeDay, type Punch, type PunchType } from './attendanceRules'
import type { AttendanceDay, SellerKpi } from '../shared/attendance'

// Attendance punches (from the fingerprint machine's export) and the manager's seller KPIs.
// Managers never see Administrator accounts here either (same rule as the Users page).

const PUNCHES = 'attendance'

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

/** 'YYYY-MM-DD' to 'YYYY-MM-DD' (local days), at most a year. */
export function checkRange(input: any): { from: string; to: string; fromIso: string; toIso: string } {
  const from = String(input?.from ?? '')
  const to = String(input?.to ?? '')
  const re = /^\d{4}-\d{2}-\d{2}$/
  if (!re.test(from) || !re.test(to) || from > to) throw new Error('RANGE_INVALID')
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const start = new Date(fy, fm - 1, fd)
  const end = new Date(ty, tm - 1, td + 1)
  if (end.getTime() - start.getTime() > 367 * 86400000) throw new Error('RANGE_INVALID')
  return { from, to, fromIso: start.toISOString(), toIso: end.toISOString() }
}

/** Saves punches; the same punch imported twice is stored once. */
export async function importPunches(punches: Punch[], actor: string): Promise<{ added: number; duplicates: number; unknownUserNos: number[] }> {
  const db = requireDb()
  const col = db.collection(PUNCHES)
  await col.createIndex({ userNo: 1, at: 1, type: 1 }, { unique: true })
  await col.createIndex({ day: 1 })
  const importedAt = new Date().toISOString()
  const docs = punches.map((p) => ({ userNo: p.userNo, at: p.at.toISOString(), day: localDay(p.at), type: p.type, source: 'machine', importedAt, importedBy: actor }))
  let added = 0
  if (docs.length) {
    try {
      added = (await col.insertMany(docs, { ordered: false })).insertedCount
    } catch (error) {
      // Only "already imported" (duplicate key) is expected; anything else is a real failure.
      const e = error as { name?: string; insertedCount?: number; writeErrors?: { code?: number } | { code?: number }[] }
      const writeErrors = ([] as { code?: number }[]).concat(e.writeErrors ?? [])
      if (e.name !== 'MongoBulkWriteError' || !writeErrors.length || !writeErrors.every((w) => w.code === 11000)) throw error
      added = e.insertedCount ?? 0
    }
  }
  const known = new Set((await db.collection('users').find({}, { projection: { userNo: 1 } }).toArray()).map((u) => u.userNo))
  const unknownUserNos = [...new Set(punches.map((p) => p.userNo))].filter((n) => !known.has(n)).sort((a, b) => a - b)
  await logAudit({ actorUsername: actor, action: 'attendance.import', resource: PUNCHES, details: { added, duplicates: docs.length - added, unknownUserNos } })
  return { added, duplicates: docs.length - added, unknownUserNos }
}

type UserRow = { userNo?: number; username: string; role: string }

async function visibleUsers(db: Db): Promise<UserRow[]> {
  const filter = isAdminViewer() ? {} : { role: { $ne: 'Administrator' } }
  return db.collection<UserRow>('users').find(filter, { projection: { userNo: 1, username: 1, role: 1 } }).toArray()
}

async function daySummaries(db: Db, from: string, to: string) {
  const punches = await db.collection(PUNCHES).find({ day: { $gte: from, $lte: to } }).sort({ at: 1 }).toArray()
  const groups = new Map<string, { userNo: number; day: string; punches: { at: Date; type: PunchType }[] }>()
  for (const p of punches) {
    const key = `${p.userNo}|${p.day}`
    if (!groups.has(key)) groups.set(key, { userNo: p.userNo, day: p.day, punches: [] })
    groups.get(key)!.punches.push({ at: new Date(p.at), type: p.type })
  }
  return [...groups.values()].map((g) => ({ userNo: g.userNo, day: g.day, ...summarizeDay(g.punches) }))
}

const minutes = (ms: number) => Math.round(ms / 60000)

export async function attendanceDays(input: unknown): Promise<AttendanceDay[]> {
  const db = requireDb()
  const { from, to } = checkRange(input)
  const users = new Map((await visibleUsers(db)).filter((u) => u.userNo).map((u) => [u.userNo!, u]))
  return (await daySummaries(db, from, to))
    .filter((d) => users.has(d.userNo) || isAdminViewer())
    .map((d) => ({
      userNo: d.userNo,
      username: users.get(d.userNo)?.username ?? '',
      day: d.day,
      firstIn: d.firstIn?.toISOString() ?? null,
      lastOut: d.lastOut?.toISOString() ?? null,
      workedMinutes: minutes(d.workedMs),
      breakMinutes: minutes(d.breakMs),
      open: d.open
    }))
    .sort((a, b) => (a.day === b.day ? a.userNo - b.userNo : a.day < b.day ? 1 : -1))
}

/** Per user in the period: sales (count, money, items), returns, days present, hours and breaks. */
export async function sellerKpis(input: unknown): Promise<SellerKpi[]> {
  const db = requireDb()
  const { from, to, fromIso, toIso } = checkRange(input)
  const users = await visibleUsers(db)
  const sales = await db.collection('pos_sales').aggregate<{ _id: string; count: number; cents: number; items: number }>([
    { $match: { createdAt: { $gte: fromIso, $lt: toIso }, status: { $in: ['completed', 'returned'] } } },
    { $group: { _id: '$cashierUsername', count: { $sum: 1 }, cents: { $sum: '$totalCents' }, items: { $sum: { $sum: '$lines.quantity' } } } }
  ]).toArray()
  const returns = await db.collection('pos_returns').aggregate<{ _id: string; count: number; cents: number }>([
    { $match: { createdAt: { $gte: fromIso, $lt: toIso } } },
    { $group: { _id: '$createdBy', count: { $sum: 1 }, cents: { $sum: '$refundCents' } } }
  ]).toArray()
  const days = await daySummaries(db, from, to)
  return users
    .map((u) => {
      const s = sales.find((x) => x._id === u.username)
      const r = returns.find((x) => x._id === u.username)
      const mine = days.filter((d) => u.userNo !== undefined && d.userNo === u.userNo)
      return {
        userNo: u.userNo ?? null,
        username: u.username,
        role: u.role,
        salesCount: s?.count ?? 0,
        salesCents: s?.cents ?? 0,
        itemsSold: s?.items ?? 0,
        returnsCount: r?.count ?? 0,
        returnsCents: r?.cents ?? 0,
        daysPresent: mine.length,
        workedMinutes: minutes(mine.reduce((n, d) => n + d.workedMs, 0)),
        breakMinutes: minutes(mine.reduce((n, d) => n + d.breakMs, 0))
      }
    })
    .sort((a, b) => b.salesCents - a.salesCents || a.username.localeCompare(b.username))
}
