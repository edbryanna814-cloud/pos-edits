import type { Db } from 'mongodb'
import { getDb } from './db'
import type { CashboxReport, InventoryReport, SalesReport } from '../shared/reports'

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

export async function salesReport(): Promise<SalesReport> {
  const db = requireDb()
  const sales = await db.collection('pos_sales').find({}).toArray() as any[]
  let totalSalesCents = 0
  const byPaymentMethod: Record<string, { count: number; totalCents: number }> = {}
  for (const s of sales) {
    if (s.status === 'completed') {
      totalSalesCents += Number(s.totalCents) || 0
      const m = s.paymentMethod || 'other'
      if (!byPaymentMethod[m]) byPaymentMethod[m] = { count: 0, totalCents: 0 }
      byPaymentMethod[m].count++
      byPaymentMethod[m].totalCents += Number(s.totalCents) || 0
    }
  }
  return { totalSalesCents, totalCount: sales.filter((s) => s.status === 'completed').length, byPaymentMethod }
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
    const min = Number(p.minStock) || 0
    if (qty <= min) lowStock++
    totalValueCents += qty * (Number(p.purchaseCostCents) || 0)
  }
  return { totalProducts: products.length, lowStock, totalValueCents }
}
