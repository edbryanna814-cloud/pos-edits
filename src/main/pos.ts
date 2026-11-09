import { ObjectId } from 'mongodb'
import type { Db } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { getClient, getDb } from './db'
import type { CashboxMovement, CashierShift, Return, Sale, SaleLine } from '../shared/pos'
import { logAudit } from './auth'

const SALES = 'pos_sales'
const PAYMENTS = 'pos_payments'
const RETURNS = 'pos_returns'
const CASHBOX = 'pos_cashbox'
const SHIFTS = 'pos_shifts'

const PAYMENT_METHODS = ['cash', 'card', 'other'] as const

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

function requireClient() {
  const client = getClient()
  if (!client) throw new Error('Database unavailable')
  return client
}

export async function ensurePosSchema(): Promise<void> {
  const db = requireDb()
  const cols = await db.listCollections({ name: { $in: [SALES, PAYMENTS, RETURNS, CASHBOX, SHIFTS] } }).toArray()
  const names = new Set(cols.map((c) => c.name))
  if (!names.has(SALES)) await db.createCollection(SALES)
  if (!names.has(PAYMENTS)) await db.createCollection(PAYMENTS)
  if (!names.has(RETURNS)) await db.createCollection(RETURNS)
  if (!names.has(CASHBOX)) { await db.createCollection(CASHBOX); await db.collection(CASHBOX).createIndex({ createdAt: -1 }) }
  if (!names.has(SHIFTS)) await db.createCollection(SHIFTS)
  await db.collection(SHIFTS).createIndex({ status: 1 })
  await db.collection(SALES).createIndex({ invoiceNo: 1 }, { unique: true })
  await db.collection(SALES).createIndex(
    { clientRequestId: 1 },
    { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } }
  )
}

function genInvoice(): string {
  return `INV-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`
}

function withStringId<T>(doc: T): T {
  return { ...doc, _id: String((doc as { _id?: unknown })._id) }
}

function toInteger(value: unknown, field: string, min = 0): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min) throw new Error(`${field} must be an integer >= ${min}`)
  return n
}

function toCents(value: unknown, field: string): number {
  return toInteger(value, field, 0)
}

function serverPrice(product: any): number {
  return Math.max(0, Math.trunc(Number(product.sellingPriceCents) || 0))
}

async function createSale(db: Db, input: any): Promise<Sale> {
  const rawLines = Array.isArray(input?.lines) ? input.lines : []
  if (rawLines.length === 0) throw new Error('Cart is empty')

  const now = new Date().toISOString()
  const lines: SaleLine[] = []

  for (const raw of rawLines) {
    const productId = String(raw?.productId ?? '')
    if (!ObjectId.isValid(productId)) throw new Error('Invalid product in cart')
    const quantity = toInteger(raw?.quantity, 'Quantity', 1)
    const product = await db.collection('inv_products').findOne(
      { _id: new ObjectId(productId) },
      { session: input.session }
    )
    if (!product) throw new Error('Product not found')
    if (product.active === false) throw new Error(`Product is inactive: ${product.name}`)
    if ((product as any).expiryDate) {
      const expiry = new Date(`${String((product as any).expiryDate).slice(0, 10)}T23:59:59`)
      if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
        throw new Error(`Product is expired: ${product.name}`)
      }
    }

    const saleUnit = raw?.saleUnit === 'box' ? 'box' : 'base'
    const unitsPerBox = Math.max(1, Math.trunc(Number((product as any).unitsPerBox) || 1))
    let unitPriceCents: number
    let baseQuantity: number
    if (saleUnit === 'box') {
      if (unitsPerBox <= 1) throw new Error(`${product.name} is not sold by box`)
      unitPriceCents = Math.max(0, Math.trunc(Number((product as any).boxPriceCents) || 0))
      if (unitPriceCents <= 0) throw new Error(`Box price is not set for ${product.name}`)
      baseQuantity = quantity * unitsPerBox
    } else {
      unitPriceCents = serverPrice(product)
      baseQuantity = quantity
    }

    const discountCents = toCents(raw?.discountCents ?? 0, 'Line discount')
    const lineTotalCents = unitPriceCents * quantity - discountCents
    if (lineTotalCents < 0) throw new Error(`Discount exceeds line total for ${product.name}`)

    lines.push({
      productId,
      productName: String(product.name ?? ''),
      sku: String(product.sku ?? ''),
      quantity,
      saleUnit,
      baseQuantity,
      unitsPerBox,
      unitPriceCents,
      unitCostCents: Math.max(0, Math.trunc(Number(product.purchaseCostCents) || 0)),
      discountCents,
      taxCents: 0,
      lineTotalCents
    })
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)
  const lineDiscounts = lines.reduce((sum, line) => sum + line.discountCents, 0)
  const requestedDiscount = toCents(input?.discountCents ?? 0, 'Discount')
  const discountCents = requestedDiscount > 0 ? requestedDiscount : lineDiscounts
  if (discountCents > subtotalCents) throw new Error('Discount exceeds subtotal')

  const taxCents = toCents(input?.taxCents ?? 0, 'Tax')
  const totalCents = subtotalCents - discountCents + taxCents

  const paymentMethod = String(input?.paymentMethod ?? 'cash')
  if (!PAYMENT_METHODS.includes(paymentMethod as (typeof PAYMENT_METHODS)[number])) {
    throw new Error('Invalid payment method')
  }
  const paidCents =
    paymentMethod === 'cash' ? toCents(input?.paidCents ?? totalCents, 'Paid amount') : totalCents
  if (paidCents < totalCents) throw new Error('Paid amount is less than total')

  for (const line of lines) {
    const baseQuantity = line.baseQuantity ?? line.quantity
    const result = await db.collection('inv_products').updateOne(
      { _id: new ObjectId(line.productId), stockQuantity: { $gte: baseQuantity } } as any,
      { $inc: { stockQuantity: -baseQuantity }, $set: { updatedAt: now } },
      { session: input.session }
    )
    if (result.matchedCount !== 1) throw new Error(`Insufficient stock for ${line.productName}`)
  }

  const clientRequestId = typeof input?.clientRequestId === 'string' ? input.clientRequestId.trim() : ''
  const customerId = typeof input?.customerId === 'string' ? input.customerId.trim() : ''
  if (customerId) {
    if (!ObjectId.isValid(customerId)) throw new Error('Invalid customer')
    const customer = await db.collection('crm_customers').findOne(
      { _id: new ObjectId(customerId) },
      { session: input.session }
    )
    if (!customer) throw new Error('Customer not found')
  }
  const cashierUsername =
    typeof input?.cashierUsername === 'string' ? input.cashierUsername.trim() : ''
  const sale: Omit<Sale, '_id'> = {
    invoiceNo: genInvoice(),
    ...(clientRequestId ? { clientRequestId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(cashierUsername ? { cashierUsername } : {}),
    lines,
    subtotalCents,
    discountCents,
    taxCents,
    totalCents,
    paymentMethod: paymentMethod as Sale['paymentMethod'],
    paidCents,
    changeCents: paidCents - totalCents,
    status: 'completed',
    createdAt: now,
    updatedAt: now
  }

  const inserted = await db.collection(SALES).insertOne(sale as any, { session: input.session })
  const saleId = inserted.insertedId.toString()

  for (const line of lines) {
    await db.collection('inv_stock_movements').insertOne(
      {
        productId: line.productId,
        type: 'sale',
        quantity: -(line.baseQuantity ?? line.quantity),
        reason: `Sale ${sale.invoiceNo}`,
        reference: saleId,
        createdAt: now
      },
      { session: input.session }
    )
  }
  await db.collection(PAYMENTS).insertOne(
    { saleId, amountCents: paidCents, method: sale.paymentMethod, createdAt: now },
    { session: input.session }
  )
  await db.collection(CASHBOX).insertOne(
    { type: 'sale', amountCents: totalCents, reason: `Sale ${sale.invoiceNo}`, reference: saleId, createdAt: now },
    { session: input.session }
  )

  return { ...sale, _id: saleId }
}

export async function checkout(input: any, username?: string): Promise<Sale> {
  const db = requireDb()
  const client = requireClient()
  const clientRequestId = typeof input?.clientRequestId === 'string' ? input.clientRequestId.trim() : ''

  if (clientRequestId) {
    const existing = await db.collection<Sale>(SALES).findOne({ clientRequestId })
    if (existing) return withStringId(existing)
  }

  const session = client.startSession()
  try {
    const sale = await session.withTransaction(async () =>
      createSale(db, { ...input, session, cashierUsername: username })
    )
    if (!sale) throw new Error('Checkout failed')
    try {
      await logAudit({ action: 'pos.checkout', resource: 'pos_sales', resourceId: sale._id })
    } catch {}
    return sale
  } catch (error) {
    if (clientRequestId && (error as { code?: number })?.code === 11000) {
      const existing = await db.collection<Sale>(SALES).findOne({ clientRequestId })
      if (existing) return withStringId(existing)
    }
    throw error
  } finally {
    await session.endSession()
  }
}

export async function listSales(): Promise<Sale[]> {
  const db = requireDb()
  return (await db.collection<Sale>(SALES).find({}).sort({ createdAt: -1 }).toArray()).map(withStringId)
}

export async function posReturn(input: { saleId: string; reason: string }, username?: string): Promise<Return> {
  const db = requireDb()
  const client = requireClient()
  if (!ObjectId.isValid(input.saleId)) throw new Error('Invalid sale')

  const session = client.startSession()
  try {
    const returned = await session.withTransaction(async () => {
      const sale = await db.collection<Sale>(SALES).findOne(
        { _id: new ObjectId(input.saleId), status: 'completed' } as any,
        { session }
      )
      if (!sale) throw new Error('Sale not found or already returned')

      const now = new Date().toISOString()
      for (const line of sale.lines) {
        const baseQuantity = line.baseQuantity ?? line.quantity
        await db.collection('inv_products').updateOne(
          { _id: new ObjectId(line.productId) } as any,
          { $inc: { stockQuantity: baseQuantity }, $set: { updatedAt: now } },
          { session }
        )
        await db.collection('inv_stock_movements').insertOne(
          {
            productId: line.productId,
            type: 'return',
            quantity: baseQuantity,
            reason: `Return ${sale.invoiceNo}`,
            reference: input.saleId,
            createdAt: now
          },
          { session }
        )
      }

      await db.collection(SALES).updateOne(
        { _id: new ObjectId(input.saleId) },
        { $set: { status: 'returned', updatedAt: now } },
        { session }
      )

      const ret: Omit<Return, '_id'> = {
        saleId: input.saleId,
        invoiceNo: sale.invoiceNo,
        lines: sale.lines.map((line) => ({
          productId: line.productId,
          quantity: line.baseQuantity ?? line.quantity,
          amountCents: line.lineTotalCents
        })),
        refundCents: sale.totalCents,
        reason: String(input.reason ?? '').trim() || 'Customer return',
        createdAt: now,
        ...(username ? { createdBy: username } : {})
      }
      const inserted = await db.collection(RETURNS).insertOne(ret as any, { session })
      await db.collection(CASHBOX).insertOne(
        {
          type: 'refund',
          amountCents: -sale.totalCents,
          reason: `Return ${sale.invoiceNo}`,
          reference: input.saleId,
          createdAt: now
        },
        { session }
      )
      return { ...ret, _id: inserted.insertedId.toString() }
    })
    if (!returned) throw new Error('Return failed')
    try {
      await logAudit({ action: 'pos.return', resource: 'pos_sales', resourceId: input.saleId })
    } catch {}
    return returned
  } finally {
    await session.endSession()
  }
}

export async function cashIn(amountCents: number, reason: string): Promise<CashboxMovement> {
  return cashMove('in', amountCents, reason)
}

export async function cashOut(amountCents: number, reason: string): Promise<CashboxMovement> {
  return cashMove('out', amountCents, reason)
}

async function cashMove(type: 'in' | 'out', amountCents: number, reason: string): Promise<CashboxMovement> {
  const db = requireDb()
  const amount = toInteger(amountCents, 'Amount', 1)
  const note = String(reason ?? '').trim()
  if (!note) throw new Error('Reason is required')
  const now = new Date().toISOString()
  const movement: Omit<CashboxMovement, '_id'> = {
    type,
    amountCents: type === 'in' ? amount : -amount,
    reason: note,
    createdAt: now
  }
  const inserted = await db.collection(CASHBOX).insertOne(movement as any)
  return { ...movement, _id: inserted.insertedId.toString() }
}

export async function listCashbox(): Promise<CashboxMovement[]> {
  const db = requireDb()
  return (await db.collection<CashboxMovement>(CASHBOX).find({}).sort({ createdAt: -1 }).toArray()).map(withStringId)
}

export async function openShift(cashierUsername: string, openingBalanceCents: number): Promise<CashierShift> {
  const db = requireDb()
  const open = await db.collection<CashierShift>(SHIFTS).findOne({ status: 'open' })
  if (open) throw new Error('A shift is already open')
  const now = new Date().toISOString()
  const shift: Omit<CashierShift, '_id'> = {
    cashierUsername,
    openedAt: now,
    openingBalanceCents: toInteger(openingBalanceCents, 'Opening balance', 0),
    status: 'open'
  }
  const inserted = await db.collection(SHIFTS).insertOne(shift as any)
  await logAudit({ action: 'pos.shift.open', resource: 'pos_shifts', resourceId: inserted.insertedId.toString() })
  return { ...shift, _id: inserted.insertedId.toString() }
}

export async function closeShift(): Promise<CashierShift> {
  const db = requireDb()
  const now = new Date().toISOString()
  const open = await db.collection<CashierShift>(SHIFTS).findOne({ status: 'open' }, { sort: { openedAt: -1 } })
  if (!open) throw new Error('No open shift')
  const movements = await db
    .collection<CashboxMovement>(CASHBOX)
    .find({ createdAt: { $gte: open.openedAt } })
    .toArray()
  const closingBalanceCents = open.openingBalanceCents + movements.reduce((sum, item) => sum + item.amountCents, 0)
  const result = await db.collection<CashierShift>(SHIFTS).findOneAndUpdate(
    { _id: new ObjectId(String(open._id)) } as any,
    { $set: { closedAt: now, closingBalanceCents, status: 'closed' } },
    { returnDocument: 'after' }
  )
  if (!result) throw new Error('Shift update failed')
  await logAudit({ action: 'pos.shift.close', resource: 'pos_shifts', resourceId: String(open._id) })
  return withStringId(result) as unknown as CashierShift
}

export async function listShifts(): Promise<CashierShift[]> {
  const db = requireDb()
  return (await db.collection<CashierShift>(SHIFTS).find({}).sort({ openedAt: -1 }).toArray()).map(withStringId)
}
