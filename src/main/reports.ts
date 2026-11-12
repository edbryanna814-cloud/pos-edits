import { ObjectId, type Db } from 'mongodb'
import { getDb } from './db'
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
  const byCustomer = new Map<string, { count: number; totalCents: number }>()
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

    if (s.customerId) {
      const entry = byCustomer.get(s.customerId) ?? { count: 0, totalCents: 0 }
      entry.count++
      entry.totalCents += total
      byCustomer.set(s.customerId, entry)
    }

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

  const customerIds = [...byCustomer.keys()].filter((id) => ObjectId.isValid(id))
  const customers =
    customerIds.length > 0
      ? ((await db
          .collection('crm_customers')
          .find({ _id: { $in: customerIds.map((id) => new ObjectId(id)) } })
          .toArray()) as any[])
      : []
  const customerNames = new Map(customers.map((c) => [String(c._id), String(c.name ?? '')]))
  const byCustomerList = [...byCustomer.entries()]
    .map(([customerId, value]) => ({
      customerId,
      name: customerNames.get(customerId) ?? customerId,
      ...value
    }))
    .sort((a, b) => b.totalCents - a.totalCents)

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
    byCashier,
    byCustomer: byCustomerList,
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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (const p of products) {
    const qty = Number(p.stockQuantity) || 0
    let expiring = false
    if (p.expiryDate) {
      const target = new Date(`${String(p.expiryDate).slice(0, 10)}T00:00:00`)
      if (!Number.isNaN(target.getTime())) {
        const days = Math.round((target.getTime() - today.getTime()) / 86400000)
        expiring = days <= 30
      }
    }
    if (qty <= Math.max(0, Math.trunc(Number(p.minStock) || 0)) || expiring) lowStock++
    totalValueCents += qty * (Number(p.purchaseCostCents) || 0)
  }
  return { totalProducts: products.length, lowStock, totalValueCents }
}
