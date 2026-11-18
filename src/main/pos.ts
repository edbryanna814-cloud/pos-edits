import { ObjectId } from 'mongodb'
import type { Db } from 'mongodb'
import { packOf, saleUnits, unitPrice, unitSize, type SaleUnit } from '../shared/packaging'
import { customerForSale } from './customers'
import { isLineOpen, lineRefund, returnDeadline, type ReturnableLine } from '../shared/returns'
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
  await db.collection(SALES).createIndex(
    { barcode: 1 },
    { unique: true, partialFilterExpression: { barcode: { $type: 'string' } } }
  )
}

async function genInvoiceNo(db: Db): Promise<string> {
  const day = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  for (let i = 0; i < 20; i++) {
    const invoiceNo = `S-${day}-${randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase()}`
    const exists = await db.collection(SALES).findOne({ $or: [{ invoiceNo }, { barcode: invoiceNo }] } as any, { projection: { _id: 1 } })
    if (!exists) return invoiceNo
  }
  return `S-${day}-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
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

    // Box, strip or pill (src/shared/packaging.ts); 'base' from an older till means the strip.
    const p = product as any
    const requested = raw?.saleUnit === 'base' || raw?.saleUnit === undefined ? (packOf(p).countsPills ? 'pill' : 'strip') : raw.saleUnit
    if (!saleUnits(p).includes(requested)) throw new Error(`${product.name} is not sold by ${String(requested)}`)
    const saleUnit = requested as SaleUnit
    const unitsPerBox = unitSize(p, 'box')
    const unitPriceCents = unitPrice(p, saleUnit)
    if (unitPriceCents <= 0) throw new Error(`The ${saleUnit} price is not set for ${product.name}`)
    const baseQuantity = quantity * unitSize(p, saleUnit)

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
      ...(Number(p.returnDays) > 0 ? { returnDays: Math.trunc(Number(p.returnDays)) } : {}),
      discountCents,
      taxCents: 0,
      lineTotalCents
    })
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)
  const lineDiscounts = lines.reduce((sum, line) => sum + line.discountCents, 0)
  // Discount as a percentage (basis points, 1250 = 12.5%), computed here from the subtotal.
  const discountBasisPoints = input?.discountBasisPoints === undefined ? null : Number(input.discountBasisPoints)
  if (discountBasisPoints !== null && !(Number.isInteger(discountBasisPoints) && discountBasisPoints >= 0 && discountBasisPoints <= 10000)) {
    throw new Error('Discount must be from 0 to 100%')
  }
  const requestedDiscount = discountBasisPoints !== null ? Math.round((subtotalCents * discountBasisPoints) / 10000) : toCents(input?.discountCents ?? 0, 'Discount')
  const discountCents = requestedDiscount > 0 ? requestedDiscount : lineDiscounts
  if (discountCents > subtotalCents) throw new Error('Discount exceeds subtotal')

  // Gate 2: tax is recomputed here from saved settings. The renderer's taxCents is ignored so a
  // stale screen (or a tampered call) cannot post a wrong tax figure to sales or reports.
  const settingsDoc = await db.collection('settings').findOne({ _id: 'company' } as any)
  const taxRateBasisPoints = Math.min(
    10000,
    Math.max(0, Math.trunc(Number((settingsDoc as any)?.taxRateBasisPoints) || 0))
  )
  const taxCents = Math.round(((subtotalCents - discountCents) * taxRateBasisPoints) / 10000)
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
  const cashierUsername =
    typeof input?.cashierUsername === 'string' ? input.cashierUsername.trim() : ''
  const customer = await customerForSale(db, input?.customerId, input.session)
  const invoiceNo = await genInvoiceNo(db)
  const sale: Omit<Sale, '_id'> = {
    invoiceNo,
    barcode: invoiceNo,
    ...(clientRequestId ? { clientRequestId } : {}),
    ...(cashierUsername ? { cashierUsername } : {}),
    ...(customer ?? {}),
    ...(discountBasisPoints !== null ? { discountBasisPoints } : {}),
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
  // The cashbox is the physical drawer: only cash sales add to it. Card and other payments live in
  // the payments collection so the drawer balance still matches the notes and coins in the till.
  if (paymentMethod === 'cash') {
    await db.collection(CASHBOX).insertOne(
      { type: 'sale', amountCents: totalCents, reason: `Sale ${sale.invoiceNo}`, reference: saleId, ...(cashierUsername ? { cashierUsername } : {}), createdAt: now },
      { session: input.session }
    )
  }

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

export async function getSale(ref: string): Promise<Sale | null> {
  const db = requireDb()
  const key = String(ref ?? '').trim()
  if (!key) return null
  const or: any[] = [{ invoiceNo: key }, { barcode: key }]
  if (ObjectId.isValid(key)) or.push({ _id: new ObjectId(key) })
  const sale = await db.collection<Sale>(SALES).findOne({ $or: or } as any)
  return sale ? withStringId(sale) : null
}

/** Sale lines that can still be returned, soonest deadline first (a passed period drops off the list). */
export async function listReturnable(): Promise<ReturnableLine[]> {
  const db = requireDb()
  const since = new Date(Date.now() - 366 * 86400000).toISOString()
  const sales = await db.collection<Sale>(SALES).find({ status: 'completed', createdAt: { $gte: since }, 'lines.returnDays': { $gt: 0 } } as any).sort({ createdAt: -1 }).limit(5000).toArray()
  const now = Date.now()
  const out: ReturnableLine[] = []
  for (const sale of sales) {
    sale.lines.forEach((line, lineIndex) => {
      const deadline = returnDeadline(sale, line)
      if (!deadline || deadline.getTime() < now || !isLineOpen(line)) return
      const remaining = line.quantity - (line.returnedQuantity ?? 0)
      out.push({
        saleId: String(sale._id), invoiceNo: sale.invoiceNo, lineIndex, productName: line.productName, quantity: remaining,
        saleUnit: line.saleUnit, refundCents: lineRefund(sale, lineIndex, remaining), soldAt: sale.createdAt, deadline: deadline.toISOString(),
        ...(sale.customerName ? { customerName: sale.customerName } : {})
      })
    })
  }
  return out.sort((a, b) => a.deadline.localeCompare(b.deadline))
}

/**
 * Returns selected quantity from a line (lineIndex) or every line still open (full remaining). Partial,
 * traceable, and idempotent-safe against over-return: stock/financials update only for the returned amount.
 */
export async function posReturn(input: { saleId: string; reason: string; lineIndex?: number; quantity?: number }, username?: string): Promise<Return> {
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
      const single = input.lineIndex !== undefined && input.lineIndex !== null
      if (single && !(Number.isInteger(input.lineIndex) && sale.lines[input.lineIndex as number])) throw new Error('RETURN_LINE_INVALID')
      const indexes = sale.lines.map((_, i) => i).filter((i) => (single ? i === input.lineIndex : true) && isLineOpen(sale.lines[i]))
      if (indexes.length === 0) throw new Error('Sale not found or already returned')
      if (single && input.quantity != null && !(Number.isInteger(input.quantity) && input.quantity > 0)) throw new Error('RETURN_QTY_INVALID')
      for (const i of indexes) {
        const deadline = returnDeadline(sale, sale.lines[i])
        if (!deadline) throw new Error(`RETURN_NOT_ALLOWED: ${sale.lines[i].productName}`)
        if (Date.now() > deadline.getTime()) throw new Error(`RETURN_PERIOD_OVER: ${sale.lines[i].productName}`)
      }
      const takes = indexes.map((i) => {
        const remaining = sale.lines[i].quantity - (sale.lines[i].returnedQuantity ?? 0)
        const take = single && input.quantity != null ? (input.quantity as number) : remaining
        if (!(Number.isInteger(take) && take > 0 && take <= remaining)) throw new Error('RETURN_QTY_INVALID')
        return take
      })
      const working = { ...sale, lines: sale.lines.map((l) => ({ ...l })) }
      const refunds: number[] = []
      indexes.forEach((i, k) => {
        refunds.push(lineRefund(working, i, takes[k]))
        working.refundedCents = (working.refundedCents ?? 0) + refunds[k]
        working.lines[i].returnedQuantity = (working.lines[i].returnedQuantity ?? 0) + takes[k]
      })
      const refundCents = refunds.reduce((a, b) => a + b, 0)

      const baseBacks = indexes.map((i, k) => {
        const line = sale.lines[i]
        const basePerUnit = (line.baseQuantity ?? line.quantity) / line.quantity
        return Math.round(basePerUnit * takes[k])
      })
      for (let k = 0; k < indexes.length; k++) {
        const i = indexes[k]
        const line = sale.lines[i]
        const baseBack = baseBacks[k]
        await db.collection('inv_products').updateOne(
          { _id: new ObjectId(line.productId) } as any,
          { $inc: { stockQuantity: baseBack }, $set: { updatedAt: now } },
          { session }
        )
        await db.collection('inv_stock_movements').insertOne(
          {
            productId: line.productId,
            type: 'return',
            quantity: baseBack,
            reason: `Return ${sale.invoiceNo}`,
            reference: input.saleId,
            ...(username ? { cashierUsername: username } : {}),
            createdAt: now
          },
          { session }
        )
      }

      const allBack = working.lines.every((l) => !isLineOpen(l))
      await db.collection(SALES).updateOne(
        { _id: new ObjectId(input.saleId) },
        { $set: { lines: working.lines, refundedCents: working.refundedCents, ...(allBack ? { status: 'returned' } : {}), updatedAt: now } },
        { session }
      )

      const ret: Omit<Return, '_id'> = {
        saleId: input.saleId,
        invoiceNo: sale.invoiceNo,
        lines: indexes.map((i, k) => ({
          productId: sale.lines[i].productId,
          lineIndex: i,
          saleUnitQuantity: takes[k],
          quantity: Math.round(((sale.lines[i].baseQuantity ?? sale.lines[i].quantity) / sale.lines[i].quantity) * takes[k]),
          amountCents: refunds[k]
        })) as any,
        refundCents,
        reason: String(input.reason ?? '').trim() || 'Customer return',
        createdAt: now,
        ...(username ? { createdBy: username } : {})
      }
      const inserted = await db.collection(RETURNS).insertOne(ret as any, { session })
      if (sale.paymentMethod === 'cash') {
        await db.collection(CASHBOX).insertOne(
          {
            type: 'refund',
            amountCents: -refundCents,
            reason: `Return ${sale.invoiceNo}`,
            reference: input.saleId,
            ...(username ? { cashierUsername: username } : {}),
            createdAt: now
          },
          { session }
        )
      }
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

export async function cashIn(amountCents: number, reason: string, cashierUsername?: string): Promise<CashboxMovement> {
  return cashMove('in', amountCents, reason, cashierUsername)
}

export async function cashOut(amountCents: number, reason: string, cashierUsername?: string): Promise<CashboxMovement> {
  return cashMove('out', amountCents, reason, cashierUsername)
}

async function cashMove(type: 'in' | 'out', amountCents: number, reason: string, cashierUsername?: string): Promise<CashboxMovement> {
  const db = requireDb()
  const amount = toInteger(amountCents, 'Amount', 1)
  const note = String(reason ?? '').trim()
  if (!note) throw new Error('Reason is required')
  const now = new Date().toISOString()
  const movement: Omit<CashboxMovement, '_id'> = {
    type,
    amountCents: type === 'in' ? amount : -amount,
    reason: note,
    ...(cashierUsername ? { cashierUsername } : {}),
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
  // One open shift per cashier (several tills can share one database).
  const open = await db.collection<CashierShift>(SHIFTS).findOne({ status: 'open', cashierUsername })
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

export async function closeShift(cashierUsername: string): Promise<CashierShift> {
  const db = requireDb()
  const now = new Date().toISOString()
  const open = await db.collection<CashierShift>(SHIFTS).findOne({ status: 'open', cashierUsername }, { sort: { openedAt: -1 } })
  if (!open) throw new Error('No open shift')
  // Only this cashier's cash (movements from before per-cashier tracking have no cashier and still count).
  const movements = await db
    .collection<CashboxMovement>(CASHBOX)
    .find({ createdAt: { $gte: open.openedAt }, $or: [{ cashierUsername }, { cashierUsername: { $exists: false } }] } as any)
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
