import type { Db } from 'mongodb'
import { getDb } from './db'
import type { CashboxMovement, CashierShift, Payment, Return, Sale, SaleLine } from '../shared/pos'
import { logAudit } from './auth'

const SALES = 'pos_sales'
const PAYMENTS = 'pos_payments'
const RETURNS = 'pos_returns'
const CASHBOX = 'pos_cashbox'
const SHIFTS = 'pos_shifts'

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

export async function ensurePosSchema(): Promise<void> {
  const db = requireDb()
  const cols = await db.listCollections({ name: { $in: [SALES, PAYMENTS, RETURNS, CASHBOX, SHIFTS] } }).toArray()
  const names = new Set(cols.map((c) => c.name))
  if (!names.has(SALES)) { await db.createCollection(SALES); await db.collection(SALES).createIndex({ invoiceNo: 1 }, { unique: true }) }
  if (!names.has(PAYMENTS)) { await db.createCollection(PAYMENTS) }
  if (!names.has(RETURNS)) { await db.createCollection(RETURNS) }
  if (!names.has(CASHBOX)) { await db.createCollection(CASHBOX); await db.collection(CASHBOX).createIndex({ createdAt: -1 }) }
  if (!names.has(SHIFTS)) { await db.createCollection(SHIFTS) }
}

function genInvoice(): string {
  return `INV-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
}

export async function checkout(input: any, cashierUsername?: string): Promise<Sale> {
  const db = requireDb()
  const { ObjectId } = await import('mongodb')
  const now = new Date().toISOString()
  const lines: SaleLine[] = (input.lines || []).map((l: any) => {
    const qty = Number(l.quantity) || 0
    const unit = Number(l.unitPriceCents) || 0
    const disc = Number(l.discountCents) || 0
    const tax = Number(l.taxCents) || 0
    return {
      productId: l.productId,
      productName: l.productName || '',
      sku: l.sku || '',
      quantity: qty,
      unitPriceCents: unit,
      discountCents: disc,
      taxCents: tax,
      lineTotalCents: qty * unit - disc + tax
    }
  })
  const subtotalCents = lines.reduce((s, l) => s + l.quantity * l.unitPriceCents, 0)
  const discountCents = lines.reduce((s, l) => s + l.discountCents, 0)
  const taxCents = lines.reduce((s, l) => s + l.taxCents, 0)
  const totalCents = subtotalCents - discountCents + taxCents
  const paidCents = Number(input.paidCents) || totalCents
  const sale: any = {
    invoiceNo: genInvoice(),
    customerId: input.customerId,
    lines,
    subtotalCents,
    discountCents,
    taxCents,
    totalCents,
    paymentMethod: input.paymentMethod || 'cash',
    paidCents,
    changeCents: Math.max(0, paidCents - totalCents),
    status: 'completed',
    cashierUsername,
    createdAt: now,
    updatedAt: now
  }
  // stock check and decrement
  for (const line of lines) {
    const prod = await db.collection('inv_products').findOne({ _id: new ObjectId(line.productId) } as any)
    if (!prod) throw new Error(`Product not found: ${line.productId}`)
    if ((prod.stockQuantity || 0) < line.quantity) throw new Error(`Insufficient stock for ${line.productName}`)
  }
  const result = await db.collection(SALES).insertOne(sale)
  for (const line of lines) {
    await db.collection('inv_products').updateOne({ _id: new ObjectId(line.productId) } as any, { $inc: { stockQuantity: -line.quantity }, $set: { updatedAt: now } })
    await db.collection('inv_stock_movements').insertOne({ productId: line.productId, type: 'sale', quantity: -line.quantity, reason: `Sale ${sale.invoiceNo}`, reference: result.insertedId.toString(), createdAt: now })
  }
  await db.collection(PAYMENTS).insertOne({ saleId: result.insertedId.toString(), amountCents: paidCents, method: sale.paymentMethod, createdAt: now })
  await db.collection(CASHBOX).insertOne({ type: 'sale', amountCents: totalCents, reason: `Sale ${sale.invoiceNo}`, reference: result.insertedId.toString(), createdAt: now })
  await logAudit({ action: 'pos.checkout', resource: 'pos_sales', resourceId: result.insertedId.toString() })
  return { _id: result.insertedId.toString(), ...sale }
}

export async function listSales(): Promise<Sale[]> {
  const db = requireDb()
  return db.collection<Sale>(SALES).find({}).sort({ createdAt: -1 }).toArray()
}

export async function posReturn(input: { saleId: string; reason: string; lines?: any[] }, username?: string): Promise<Return> {
  const db = requireDb()
  const { ObjectId } = await import('mongodb')
  const now = new Date().toISOString()
  const sale = await db.collection<Sale>(SALES).findOne({ _id: new ObjectId(input.saleId) } as any)
  if (!sale) throw new Error('Sale not found')
  if (sale.status === 'returned') throw new Error('Already returned')
  const lines = input.lines || sale.lines.map((l: SaleLine) => ({ productId: l.productId, quantity: l.quantity, amountCents: l.lineTotalCents }))
  const refundCents = lines.reduce((s: number, l: any) => s + (Number(l.amountCents) || 0), 0)
  for (const l of lines) {
    await db.collection('inv_products').updateOne({ _id: new ObjectId(l.productId) } as any, { $inc: { stockQuantity: Number(l.quantity) || 0 }, $set: { updatedAt: now } })
    await db.collection('inv_stock_movements').insertOne({ productId: l.productId, type: 'return', quantity: Number(l.quantity) || 0, reason: `Return ${sale.invoiceNo}`, reference: input.saleId, createdAt: now })
  }
  await db.collection(SALES).updateOne({ _id: new ObjectId(input.saleId) } as any, { $set: { status: 'returned', updatedAt: now } })
  const ret: any = { saleId: input.saleId, invoiceNo: sale.invoiceNo, lines, refundCents, reason: input.reason, createdAt: now, createdBy: username }
  const r = await db.collection(RETURNS).insertOne(ret)
  await db.collection(CASHBOX).insertOne({ type: 'refund', amountCents: -refundCents, reason: `Return ${sale.invoiceNo}`, reference: input.saleId, createdAt: now })
  await logAudit({ action: 'pos.return', resource: 'pos_sales', resourceId: input.saleId })
  return { _id: r.insertedId.toString(), ...ret }
}

export async function cashIn(amountCents: number, reason: string): Promise<CashboxMovement> {
  const db = requireDb()
  const now = new Date().toISOString()
  const mv: any = { type: 'in', amountCents: Number(amountCents) || 0, reason, createdAt: now }
  const r = await db.collection(CASHBOX).insertOne(mv)
  return { _id: r.insertedId.toString(), ...mv }
}

export async function cashOut(amountCents: number, reason: string): Promise<CashboxMovement> {
  const db = requireDb()
  const now = new Date().toISOString()
  const mv: any = { type: 'out', amountCents: -(Number(amountCents) || 0), reason, createdAt: now }
  const r = await db.collection(CASHBOX).insertOne(mv)
  return { _id: r.insertedId.toString(), ...mv }
}

export async function listCashbox(): Promise<CashboxMovement[]> {
  const db = requireDb()
  return db.collection<CashboxMovement>(CASHBOX).find({}).sort({ createdAt: -1 }).toArray()
}

export async function openShift(cashierUsername: string, openingBalanceCents: number): Promise<CashierShift> {
  const db = requireDb()
  const now = new Date().toISOString()
  const shift: any = { cashierUsername, openedAt: now, openingBalanceCents: Number(openingBalanceCents) || 0, status: 'open' }
  const r = await db.collection(SHIFTS).insertOne(shift)
  return { _id: r.insertedId.toString(), ...shift }
}

export async function closeShift(): Promise<CashierShift> {
  const db = requireDb()
  const { ObjectId } = await import('mongodb')
  const now = new Date().toISOString()
  const open = await db.collection<CashierShift>(SHIFTS).findOne({ status: 'open' }, { sort: { openedAt: -1 } })
  if (!open) throw new Error('No open shift')
  const result = await db.collection(SHIFTS).findOneAndUpdate({ _id: open._id } as any, { $set: { closedAt: now, status: 'closed' } }, { returnDocument: 'after' } as any)
  return result as any
}

export async function listShifts(): Promise<CashierShift[]> {
  const db = requireDb()
  return db.collection<CashierShift>(SHIFTS).find({}).sort({ openedAt: -1 }).toArray()
}
