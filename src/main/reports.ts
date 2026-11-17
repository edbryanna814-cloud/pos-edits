import type { Db } from 'mongodb'
import { getDb } from './db'
import { isAdminViewer } from './auth'
import { ADMIN_ROLE } from '../shared/auth'
import { expiryState } from '../shared/expiry'
import type { CashboxReport, InventoryReport, SalesReport } from '../shared/reports'

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

export async function salesReport(): Promise<SalesReport> {
  const db = requireDb()
  const sales = (await db.collection('pos_sales').find({}).toArray()) as any[]
  const returns = (await db.collection('pos_returns').find({}).toArray()) as any[]
  const completed = sales.filter((s) => s.status === 'completed')
  let totalSalesCents = 0
  let grossCents = 0
  let discountCents = 0
  let taxCents = 0
  let cogsCents = 0
  const byPaymentMethod: Record<string, { count: number; totalCents: number }> = {}
  const byCashier: Record<string, { count: number; totalCents: number }> = {}
  const products = new Map<string, SalesReport['byProduct'][number]>()

  for (const s of completed) {
    const total = Number(s.totalCents) || 0
    totalSalesCents += total
    grossCents += Number(s.subtotalCents) || 0
    discountCents += Number(s.discountCents) || 0
    taxCents += Number(s.taxCents) || 0

    const method = s.paymentMethod || 'other'
    byPaymentMethod[method] ??= { count: 0, totalCents: 0 }
    byPaymentMethod[method].count++
    byPaymentMethod[method].totalCents += total

    const cashier = s.cashierUsername || 'unknown'
    byCashier[cashier] ??= { count: 0, totalCents: 0 }
    byCashier[cashier].count++
    byCashier[cashier].totalCents += total

    for (const line of Array.isArray(s.lines) ? s.lines : []) {
      const quantity = Number(line.baseQuantity ?? line.quantity) || 0
      const revenue = Number(line.lineTotalCents) || 0
      const cost = quantity * (Number(line.unitCostCents) || 0)
      cogsCents += cost
      const entry = products.get(line.productId) ?? {
        productId: String(line.productId),
        productName: String(line.productName ?? ''),
        quantity: 0,
        revenueCents: 0,
        costCents: 0,
        profitCents: 0
      }
      entry.quantity += quantity
      entry.revenueCents += revenue
      entry.costCents += cost
      entry.profitCents = entry.revenueCents - entry.costCents
      products.set(line.productId, entry)
    }
  }

  const returnsCents = returns.reduce((sum, r) => sum + (Number(r.refundCents) || 0), 0)

  return {
    totalSalesCents,
    totalCount: completed.length,
    grossCents,
    discountCents,
    taxCents,
    returnsCents,
    returnsCount: returns.length,
    cogsCents,
    grossProfitCents: grossCents - discountCents - cogsCents,
    byPaymentMethod,
    byCashier: await withoutAdmins(db, byCashier),
    byProduct: [...products.values()].sort((a, b) => b.revenueCents - a.revenueCents)
  }
}

export async function cashboxReport(): Promise<CashboxReport> {
  const db = requireDb()
  const mv = await db.collection('pos_cashbox').find({}).toArray() as any[]
  let totalInCents = 0
  let totalOutCents = 0
  for (const m of mv) {
    const a = Number(m.amountCents) || 0
    if (a > 0) totalInCents += a
    else totalOutCents += Math.abs(a)
  }
  return { totalInCents, totalOutCents, balanceCents: totalInCents - totalOutCents }
}

export async function inventoryReport(): Promise<InventoryReport> {
  const db = requireDb()
  const products = await db.collection('inv_products').find({}).toArray() as any[]
  let lowStock = 0
  let totalValueCents = 0
  for (const p of products) {
    const qty = Number(p.stockQuantity) || 0
    const state = expiryState(p.expiryDate ? String(p.expiryDate) : undefined)
    const expiring = state === 'expired' || state === 'soon'
    if (qty <= Math.max(0, Math.trunc(Number(p.minStock) || 0)) || expiring) lowStock++
    totalValueCents += qty * (Number(p.purchaseCostCents) || 0)
  }
  return { totalProducts: products.length, lowStock, totalValueCents }
}

/** Administrator accounts are hidden from everyone else, here too (same rule as Users and the dashboard). */
async function withoutAdmins<T>(db: Db, rows: Record<string, T>): Promise<Record<string, T>> {
  if (isAdminViewer()) return rows
  const admins = new Set((await db.collection('users').find({ role: ADMIN_ROLE }, { projection: { username: 1 } }).toArray()).map((u) => String(u.username)))
  return Object.fromEntries(Object.entries(rows).filter(([name]) => !admins.has(name)))
}
