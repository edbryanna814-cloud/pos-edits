import { ObjectId, type Db } from 'mongodb'
import { derivePackaging } from '../shared/packaging'
import { getClient, getDb } from './db'
import type { Category, Product, PurchaseOrder, PurchaseOrderLine, PurchaseReceipt, StockMovement, Supplier, Unit } from '../shared/inventory'
import { logAudit } from './auth'

const CATEGORIES = 'inv_categories'
const UNITS = 'inv_units'
const PRODUCTS = 'inv_products'
const STOCK = 'inv_stock_movements'
const SUPPLIERS = 'inv_suppliers'
const PO = 'inv_purchase_orders'
const RECEIPTS = 'inv_purchase_receipts'

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

function requireText(value: unknown, field: string): string {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${field} is required`)
  return text
}

function toInteger(value: unknown, field: string, min = 0): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min) throw new Error(`${field} must be an integer >= ${min}`)
  return n
}

function duplicateKey(error: unknown): boolean {
  return (error as { code?: number })?.code === 11000
}

export async function ensureInventorySchema(): Promise<void> {
  const db = requireDb()
  const cols = await db.listCollections({ name: { $in: [CATEGORIES, UNITS, PRODUCTS, STOCK, SUPPLIERS, PO, RECEIPTS] } }).toArray()
  const names = new Set(cols.map((c) => c.name))
  if (!names.has(CATEGORIES)) { await db.createCollection(CATEGORIES) }
  if (!names.has(UNITS)) { await db.createCollection(UNITS) }
  if (!names.has(PRODUCTS)) { await db.createCollection(PRODUCTS) }
  if (!names.has(STOCK)) { await db.createCollection(STOCK) }
  await db.collection(PRODUCTS).createIndex({ sku: 1 }, { unique: true })
  await db.collection(STOCK).createIndex({ productId: 1 })
  await db.collection(STOCK).createIndex({ createdAt: -1 })
  if (!names.has(SUPPLIERS)) { await db.createCollection(SUPPLIERS) }
  if (!names.has(PO)) { await db.createCollection(PO) }
  if (!names.has(RECEIPTS)) { await db.createCollection(RECEIPTS) }
}

function withStringId<T>(doc: T): T {
  return { ...doc, _id: String((doc as { _id?: unknown })._id) }
}

export async function listCategories(): Promise<Category[]> {
  const db = requireDb()
  return (await db.collection<Category>(CATEGORIES).find({}).toArray()).map(withStringId)
}
export async function createCategory(input: Partial<Category>): Promise<Category> {
  const db = requireDb(); const now = new Date().toISOString()
  const cat: any = { name: input.name || '', description: input.description, createdAt: now, updatedAt: now }
  const r = await db.collection(CATEGORIES).insertOne(cat)
  return { ...cat, _id: r.insertedId.toString() }
}

export async function listUnits(): Promise<Unit[]> {
  const db = requireDb()
  return (await db.collection<Unit>(UNITS).find({}).toArray()).map(withStringId)
}
export async function createUnit(input: Partial<Unit>): Promise<Unit> {
  const db = requireDb(); const now = new Date().toISOString()
  const unit: any = { name: input.name || '', abbreviation: input.abbreviation || '', createdAt: now, updatedAt: now }
  const r = await db.collection(UNITS).insertOne(unit)
  return { ...unit, _id: r.insertedId.toString() }
}

export async function listProducts(): Promise<Product[]> {
  const db = requireDb()
  return (await db.collection<Product>(PRODUCTS).find({}).toArray()).map(withStringId)
}
const PACKAGINGS = ['box', 'strip', 'pill'] as const

/** 0.3.0 form: the unit type, how it splits, and the price of one such unit; prices below it are derived. */
function packagingFields(input: any): Partial<Product> | null {
  if (input?.packaging === undefined) return null
  if (!PACKAGINGS.includes(input.packaging)) throw new Error('Unit must be box, strip or pill')
  const optional = (value: unknown, label: string) => (value === undefined || value === null || value === '' ? undefined : toInteger(value, label, 1))
  return derivePackaging({
    packaging: input.packaging,
    stripsPerBox: input.packaging === 'box' ? toInteger(input.stripsPerBox, 'Strips per box', 1) : undefined,
    pillsPerStrip: optional(input.pillsPerStrip, 'Pills per strip'),
    priceCents: toInteger(input.unitPriceCents ?? 0, 'Price')
  })
}

/** Warning margin (smallest unit) and return period (days, at most a year); null or '' clears them. */
function optionalCounts(input: any): Partial<Product> {
  const out: any = {}
  if (input?.stockWarnMargin !== undefined) out.stockWarnMargin = input.stockWarnMargin === null || input.stockWarnMargin === '' ? 0 : toInteger(input.stockWarnMargin, 'Warning margin')
  if (input?.returnDays !== undefined) {
    const days = input.returnDays === null || input.returnDays === '' ? 0 : toInteger(input.returnDays, 'Return days')
    if (days > 365) throw new Error('Return days must be 365 or fewer')
    out.returnDays = days
  }
  return out
}

export async function createProduct(input: Partial<Product>): Promise<Product> {
  const db = requireDb(); const now = new Date().toISOString()
  const product: any = {
    name: requireText(input.name, 'Product name'),
    sku: requireText(input.sku, 'SKU'),
    barcode: input.barcode ? String(input.barcode).trim() : undefined,
    categoryId: input.categoryId,
    unitId: input.unitId,
    purchaseCostCents: toInteger(input.purchaseCostCents ?? 0, 'Purchase cost'),
    sellingPriceCents: toInteger(input.sellingPriceCents ?? 0, 'Selling price'),
    unitsPerBox: toInteger(input.unitsPerBox ?? 1, 'Units per box', 1),
    boxPriceCents:
      input.boxPriceCents !== undefined ? toInteger(input.boxPriceCents, 'Box price') : undefined,
    stockQuantity: toInteger(input.stockQuantity ?? 0, 'Stock quantity'),
    minStock: toInteger(input.minStock ?? 0, 'Minimum stock'),
    expiryDate: input.expiryDate ? String(input.expiryDate).trim() : undefined,
    active: input.active !== false,
    createdAt: now,
    updatedAt: now,
    ...packagingFields(input),
    ...optionalCounts(input)
  }
  let insertedId: ObjectId
  try {
    const r = await db.collection(PRODUCTS).insertOne(product)
    insertedId = r.insertedId
  } catch (error) {
    if (duplicateKey(error)) throw new Error('SKU already exists')
    throw error
  }
  await logAudit({ action: 'inventory.product.create', resource: 'inv_products', resourceId: insertedId.toString() })
  return { ...product, _id: insertedId.toString() }
}

export async function updateProduct(id: string, input: Partial<Product>): Promise<Product> {
  const db = requireDb()
  if (!ObjectId.isValid(id)) throw new Error('Invalid product')
  const update: Partial<Product> = {}
  if (input.name !== undefined) update.name = requireText(input.name, 'Product name')
  if (input.sku !== undefined) update.sku = requireText(input.sku, 'SKU')
  if (input.barcode !== undefined) update.barcode = String(input.barcode ?? '').trim()
  if (input.categoryId !== undefined) update.categoryId = input.categoryId
  if (input.unitId !== undefined) update.unitId = input.unitId
  if (input.purchaseCostCents !== undefined) update.purchaseCostCents = toInteger(input.purchaseCostCents, 'Purchase cost')
  if (input.sellingPriceCents !== undefined) update.sellingPriceCents = toInteger(input.sellingPriceCents, 'Selling price')
  if (input.unitsPerBox !== undefined) update.unitsPerBox = toInteger(input.unitsPerBox, 'Units per box', 1)
  if (input.boxPriceCents !== undefined) update.boxPriceCents = toInteger(input.boxPriceCents, 'Box price')
  if (input.minStock !== undefined) update.minStock = toInteger(input.minStock, 'Minimum stock')
  if (input.expiryDate !== undefined)
    update.expiryDate = input.expiryDate ? String(input.expiryDate).trim() : undefined
  if (input.active !== undefined) update.active = Boolean(input.active)
  const pack = packagingFields(input)
  if (pack) Object.assign(update, pack)
  Object.assign(update, optionalCounts(input))
  if (Object.keys(update).length === 0) throw new Error('No product changes supplied')

  let updated: any
  try {
    updated = await db.collection(PRODUCTS).findOneAndUpdate(
      { _id: new ObjectId(id) } as any,
      { $set: { ...update, updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' }
    )
  } catch (error) {
    if (duplicateKey(error)) throw new Error('SKU already exists')
    throw error
  }
  if (!updated) throw new Error('Product not found')
  return { ...updated, _id: updated._id.toString() } as Product
}

export interface CartonIntakeInput {
  productId: string
  cartons: number
  boxesPerCarton: number
  sellingPriceCents?: number
  boxPriceCents?: number
  expiryDate?: string
}

export async function receiveCarton(input: CartonIntakeInput): Promise<Product> {
  const db = requireDb()
  if (!ObjectId.isValid(input.productId)) throw new Error('Invalid product')
  const cartons = toInteger(input.cartons, 'Cartons', 1)
  const boxesPerCarton = toInteger(input.boxesPerCarton, 'Boxes per carton', 1)
  const product = await db.collection(PRODUCTS).findOne({ _id: new ObjectId(input.productId) } as any)
  if (!product) throw new Error('Product not found')
  const unitsPerBox = Math.max(1, Math.trunc(Number((product as any).unitsPerBox) || 1))
  const quantity = cartons * boxesPerCarton * unitsPerBox
  const now = new Date().toISOString()
  const update: Record<string, unknown> = { updatedAt: now }
  if (input.sellingPriceCents !== undefined) {
    update.sellingPriceCents = toInteger(input.sellingPriceCents, 'Selling price')
  }
  if (input.boxPriceCents !== undefined) {
    update.boxPriceCents = toInteger(input.boxPriceCents, 'Box price')
  }
  if (input.expiryDate !== undefined) {
    update.expiryDate = input.expiryDate ? String(input.expiryDate).slice(0, 10) : null
  }
  const updated = await db.collection(PRODUCTS).findOneAndUpdate(
    { _id: new ObjectId(input.productId) } as any,
    { $inc: { stockQuantity: quantity }, $set: update },
    { returnDocument: 'after' }
  )
  if (!updated) throw new Error('Product not found')
  await db.collection(STOCK).insertOne({
    productId: input.productId,
    type: 'purchase',
    quantity,
    reason: `Carton intake: ${cartons} x ${boxesPerCarton}`,
    createdAt: now
  } as any)
  await logAudit({
    action: 'inventory.carton.receive',
    resource: PRODUCTS,
    resourceId: input.productId
  })
  return { ...updated, _id: updated._id.toString() } as Product
}

export async function listStockMovements(productId?: string): Promise<StockMovement[]> {
  const db = requireDb()
  const filter = productId ? { productId } : {}
  return (await db.collection<StockMovement>(STOCK).find(filter).sort({ createdAt: -1 }).toArray()).map(withStringId)
}

export async function stockAdjust(input: { productId: string; quantity: number; reason: string }): Promise<StockMovement> {
  const db = requireDb()
  if (!ObjectId.isValid(input.productId)) throw new Error('Invalid product')
  const quantity = toInteger(input.quantity, 'Adjustment quantity', -1000000)
  if (quantity === 0) throw new Error('Adjustment quantity cannot be zero')
  const reason = requireText(input.reason, 'Reason')
  const now = new Date().toISOString()
  const movement: any = { productId: input.productId, type: 'adjustment', quantity, reason, createdAt: now }

  const client = getClient()
  if (!client) throw new Error('Database unavailable')
  const session = client.startSession()
  let movementId: string
  try {
    movementId = await session.withTransaction(async () => {
      const filter: any = { _id: new ObjectId(input.productId) }
      if (quantity < 0) filter.stockQuantity = { $gte: -quantity }
      const result = await db.collection(PRODUCTS).updateOne(
        filter,
        { $inc: { stockQuantity: quantity }, $set: { updatedAt: now } },
        { session }
      )
      if (result.matchedCount !== 1) throw new Error('Product not found or insufficient stock')
      const inserted = await db.collection(STOCK).insertOne(movement, { session })
      return inserted.insertedId.toString()
    })
  } finally {
    await session.endSession()
  }
  await logAudit({ action: 'inventory.stock.adjust', resource: 'inv_products', resourceId: input.productId })
  return { _id: movementId, ...movement }
}

export async function listSuppliers(): Promise<Supplier[]> {
  const db = requireDb()
  return (await db.collection<Supplier>(SUPPLIERS).find({}).sort({ name: 1 }).toArray()).map(withStringId)
}
export async function createSupplier(input: Partial<Supplier>): Promise<Supplier> {
  const db = requireDb()
  const now = new Date().toISOString()
  const sup: any = {
    name: requireText(input.name, 'Supplier name'),
    contact: input.contact ? String(input.contact).trim() : undefined,
    phone: input.phone ? String(input.phone).trim() : undefined,
    email: input.email ? String(input.email).trim() : undefined,
    address: input.address ? String(input.address).trim() : undefined,
    taxInfo: input.taxInfo ? String(input.taxInfo).trim() : undefined,
    notes: input.notes ? String(input.notes).trim() : undefined,
    active: input.active !== false,
    createdAt: now,
    updatedAt: now
  }
  const r = await db.collection(SUPPLIERS).insertOne(sup)
  await logAudit({ action: 'inventory.supplier.create', resource: 'inv_suppliers', resourceId: r.insertedId.toString() })
  return { ...sup, _id: r.insertedId.toString() }
}

export async function updateSupplier(id: string, input: Partial<Supplier>): Promise<Supplier> {
  const db = requireDb()
  if (!ObjectId.isValid(id)) throw new Error('Invalid supplier')
  const _id = new ObjectId(id)
  const current = await db.collection(SUPPLIERS).findOne({ _id })
  if (!current) throw new Error('Supplier not found')
  const set: any = { updatedAt: new Date().toISOString() }
  if (input.name !== undefined) set.name = requireText(input.name, 'Supplier name')
  if (input.contact !== undefined) set.contact = input.contact ? String(input.contact).trim() : undefined
  if (input.phone !== undefined) set.phone = input.phone ? String(input.phone).trim() : undefined
  if (input.email !== undefined) set.email = input.email ? String(input.email).trim() : undefined
  if (input.address !== undefined) set.address = input.address ? String(input.address).trim() : undefined
  if (input.taxInfo !== undefined) set.taxInfo = input.taxInfo ? String(input.taxInfo).trim() : undefined
  if (input.notes !== undefined) set.notes = input.notes ? String(input.notes).trim() : undefined
  if (input.active !== undefined) set.active = Boolean(input.active)
  const updated = await db.collection(SUPPLIERS).findOneAndUpdate({ _id } as any, { $set: set }, { returnDocument: 'after' })
  if (!updated) throw new Error('Supplier not found')
  await logAudit({ action: 'inventory.supplier.update', resource: 'inv_suppliers', resourceId: id })
  return withStringId(updated as any) as Supplier
}

export async function listPO(): Promise<PurchaseOrder[]> {
  const db = requireDb()
  return (await db.collection<PurchaseOrder>(PO).find({}).sort({ createdAt: -1 }).toArray()).map(withStringId)
}

export async function listReceipts(purchaseOrderId?: string): Promise<PurchaseReceipt[]> {
  const db = requireDb()
  const filter = purchaseOrderId ? { purchaseOrderId } : {}
  return (await db.collection<PurchaseReceipt>(RECEIPTS).find(filter as any).sort({ receivedAt: -1, createdAt: -1 }).toArray()).map(withStringId)
}

const PO_STATUSES = new Set(['draft', 'pending_approval', 'approved', 'sent', 'ordered', 'partially_received', 'received', 'completed', 'canceled'])
const genNo = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
const isoDate = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  const s = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) throw new Error('Invalid date')
  return s.slice(0, 10)
}

async function normalizePoLines(db: Db, rawLines: unknown, existing?: PurchaseOrderLine[]): Promise<PurchaseOrderLine[]> {
  const arr = Array.isArray(rawLines) ? rawLines : []
  if (arr.length === 0) throw new Error('Add at least one line item')
  const prev = new Map((existing ?? []).map((l) => [l.productId, l]))
  const lines: PurchaseOrderLine[] = []
  for (const raw of arr) {
    const productId = String((raw as any)?.productId || '')
    if (!ObjectId.isValid(productId)) throw new Error('Invalid product in purchase order')
    const product = await db.collection(PRODUCTS).findOne({ _id: new ObjectId(productId) } as any)
    if (!product) throw new Error('Product not found in purchase order')
    const quantity = toInteger((raw as any)?.quantity, 'Line quantity', 1)
    const kept = prev.get(productId)
    const receivedQuantity = Math.max(0, Math.min(quantity, toInteger((raw as any)?.receivedQuantity ?? kept?.receivedQuantity ?? 0, 'Received quantity', 0)))
    lines.push({ productId, quantity, unitCostCents: toInteger((raw as any)?.unitCostCents ?? 0, 'Line unit cost'), ...(receivedQuantity ? { receivedQuantity } : {}) })
  }
  return lines
}

export async function createPO(input: Partial<PurchaseOrder>, actor?: string): Promise<PurchaseOrder> {
  const db = requireDb()
  if (!ObjectId.isValid(String(input.supplierId || ''))) throw new Error('Supplier is required')
  const supplier = await db.collection(SUPPLIERS).findOne({ _id: new ObjectId(String(input.supplierId)) } as any)
  if (!supplier) throw new Error('Supplier not found')
  const lines = await normalizePoLines(db, input.lines)
  const status = PO_STATUSES.has(String(input.status)) ? (input.status as PurchaseOrder['status']) : 'draft'
  if (status === 'partially_received' || status === 'received' || status === 'completed') throw new Error('Invalid purchase order status')
  const now = new Date().toISOString()
  const po: any = {
    orderNo: String(input.orderNo || '').trim() || genNo('PO'),
    supplierId: String(input.supplierId),
    status,
    lines: lines.map((l) => ({ ...l, receivedQuantity: 0 })),
    totalCents: lines.reduce((sum, line) => sum + line.quantity * line.unitCostCents, 0),
    orderDate: isoDate(input.orderDate) ?? now.slice(0, 10),
    ...(isoDate(input.expectedDeliveryDate) ? { expectedDeliveryDate: isoDate(input.expectedDeliveryDate) } : {}),
    ...(input.notes ? { notes: String(input.notes).trim() } : {}),
    ...(actor || input.createdBy ? { createdBy: actor || String(input.createdBy) } : {}),
    createdAt: now,
    updatedAt: now
  }
  const r = await db.collection(PO).insertOne(po)
  await logAudit({ action: 'inventory.po.create', resource: 'inv_purchase_orders', resourceId: r.insertedId.toString(), details: { orderNo: po.orderNo } })
  return { ...po, _id: r.insertedId.toString() }
}

export async function updatePO(id: string, input: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
  const db = requireDb()
  if (!ObjectId.isValid(id)) throw new Error('Invalid purchase order')
  const current = await db.collection<PurchaseOrder>(PO).findOne({ _id: new ObjectId(id) } as any)
  if (!current) throw new Error('Purchase order not found')
  if (current.status === 'completed' || current.status === 'received' || current.status === 'canceled') throw new Error('Purchase order cannot be edited')
  const anyReceived = (current.lines ?? []).some((l: any) => (l.receivedQuantity ?? 0) > 0)
  const status = input.status && PO_STATUSES.has(String(input.status)) ? (input.status as PurchaseOrder['status']) : current.status
  const supplierId = input.supplierId !== undefined ? String(input.supplierId) : current.supplierId
  if (!ObjectId.isValid(supplierId)) throw new Error('Supplier is required')
  const supplier = await db.collection(SUPPLIERS).findOne({ _id: new ObjectId(supplierId) } as any)
  if (!supplier) throw new Error('Supplier not found')
  const lines: PurchaseOrderLine[] = input.lines ? await normalizePoLines(db, input.lines, current.lines as any) : ((current.lines ?? []) as PurchaseOrderLine[])
  if (anyReceived) {
    for (const l of lines) {
      const prev = (current.lines as any[]).find((x) => x.productId === l.productId)
      if (!prev || l.quantity < (prev.receivedQuantity ?? 0)) throw new Error('Cannot reduce quantity below received')
    }
  }
  const allDone = lines.length > 0 && lines.every((l) => (l.receivedQuantity ?? 0) >= l.quantity)
  const nextStatus = status === 'canceled' ? 'canceled' : anyReceived ? (allDone ? (status === 'completed' ? 'completed' : 'received') : 'partially_received') : status
  const now = new Date().toISOString()
  const set: any = { supplierId, status: nextStatus, lines, totalCents: lines.reduce((sum: number, line: PurchaseOrderLine) => sum + line.quantity * line.unitCostCents, 0), updatedAt: now }
  if (input.orderDate !== undefined) { const d = isoDate(input.orderDate); if (d) set.orderDate = d }
  if (input.expectedDeliveryDate !== undefined) { const d = isoDate(input.expectedDeliveryDate); set.expectedDeliveryDate = d }
  if (input.notes !== undefined) set.notes = input.notes ? String(input.notes).trim() : undefined
  const updated = await db.collection(PO).findOneAndUpdate({ _id: new ObjectId(id) } as any, { $set: set }, { returnDocument: 'after' })
  if (!updated) throw new Error('Purchase order not found')
  await logAudit({ action: 'inventory.po.update', resource: 'inv_purchase_orders', resourceId: id })
  return withStringId(updated as any) as PurchaseOrder
}

export async function receivePO(purchaseOrderId: string, input?: { lines?: { productId: string; receivedQuantity?: number; damagedQuantity?: number }[]; notes?: string; receivedBy?: string } | string): Promise<PurchaseReceipt> {
  const db = requireDb()
  if (!ObjectId.isValid(purchaseOrderId)) throw new Error('Invalid purchase order')
  const po = await db.collection<PurchaseOrder>(PO).findOne({ _id: new ObjectId(purchaseOrderId) } as any)
  if (!po) throw new Error('Purchase order not found')
  if (po.status === 'canceled') throw new Error('Canceled purchase order cannot be received')
  const poLines = Array.isArray(po.lines) ? (po.lines as any[]) : []
  if (poLines.length === 0) throw new Error('Purchase order has no line items')
  const payload = typeof input === 'string' ? { notes: input } : (input ?? {})
  const byId = new Map((payload.lines ?? []).map((l) => [String(l.productId), l]))
  const now = new Date().toISOString()
  const receiptLines: any[] = []
  const updates: { index: number; accepted: number }[] = []
  for (let i = 0; i < poLines.length; i++) {
    const line = poLines[i]
    const ordered = toInteger(line.quantity, 'Line quantity', 1)
    const prev = Math.max(0, toInteger(line.receivedQuantity ?? 0, 'Received quantity', 0))
    const remaining = ordered - prev
    const explicit = byId.get(String(line.productId))
    const receivedQtyRaw = explicit ? explicit.receivedQuantity : (payload.lines && payload.lines.length ? 0 : remaining)
    const receivedQty = toInteger(receivedQtyRaw ?? 0, 'Received quantity', 0)
    const damagedQty = explicit ? toInteger(explicit.damagedQuantity ?? 0, 'Damaged quantity', 0) : 0
    if (receivedQty === 0) continue
    if (damagedQty > receivedQty) throw new Error('Damaged quantity exceeds received quantity')
    const accepted = receivedQty - damagedQty
    if (accepted <= 0) throw new Error('Accepted quantity must be greater than zero')
    if (accepted > remaining) throw new Error('Received quantity exceeds remaining quantity')
    receiptLines.push({ productId: String(line.productId), quantity: accepted, ...(damagedQty ? { damagedQuantity: damagedQty } : {}), remainingQuantity: remaining - accepted, unitCostCents: line.unitCostCents })
    updates.push({ index: i, accepted })
  }
  if (receiptLines.length === 0) throw new Error('No quantities to receive')

  const client = getClient()
  if (!client) throw new Error('Database unavailable')
  const session = client.startSession()
  let receiptId = ''
  const supplyNo = genNo('SUP')
  try {
    receiptId = await session.withTransaction(async () => {
      for (const line of receiptLines) {
        const result = await db.collection(PRODUCTS).updateOne(
          { _id: new ObjectId(line.productId) } as any,
          { $inc: { stockQuantity: line.quantity }, $set: { updatedAt: now } },
          { session }
        )
        if (result.matchedCount !== 1) throw new Error('Product not found in purchase order')
        await db.collection(STOCK).insertOne(
          { productId: line.productId, type: 'purchase', quantity: line.quantity, reason: 'Supply order received', reference: purchaseOrderId, createdAt: now },
          { session }
        )
      }
      const fresh = await db.collection(PO).findOne({ _id: new ObjectId(purchaseOrderId) } as any, { session })
      if (!fresh) throw new Error('Purchase order not found')
      if (fresh.status === 'canceled') throw new Error('Canceled purchase order cannot be received')
      const freshLines = [...((fresh.lines ?? []) as any[])]
      for (const u of updates) {
        const ordered = toInteger(freshLines[u.index].quantity, 'Line quantity', 1)
        const prev = toInteger(freshLines[u.index].receivedQuantity ?? 0, 'Received quantity', 0)
        if (prev + u.accepted > ordered) throw new Error('Received quantity exceeds remaining quantity')
        freshLines[u.index] = { ...freshLines[u.index], receivedQuantity: prev + u.accepted }
      }
      const done = freshLines.every((l) => (l.receivedQuantity ?? 0) >= l.quantity)
      const nextStatus = done ? (fresh.status === 'completed' ? 'completed' : 'received') : 'partially_received'
      await db.collection(PO).updateOne(
        { _id: new ObjectId(purchaseOrderId) } as any,
        { $set: { lines: freshLines, status: nextStatus, updatedAt: now } },
        { session }
      )
      const receipt: any = {
        supplyNo,
        purchaseOrderId,
        receivedAt: now,
        ...(payload.receivedBy ? { receivedBy: String(payload.receivedBy) } : {}),
        lines: receiptLines,
        ...(payload.notes ? { notes: String(payload.notes).trim() } : {}),
        createdAt: now
      }
      const inserted = await db.collection(RECEIPTS).insertOne(receipt, { session })
      return inserted.insertedId.toString()
    })
  } finally {
    await session.endSession()
  }
  await logAudit({ action: 'inventory.po.receive', resource: 'inv_purchase_orders', resourceId: purchaseOrderId, details: { receiptId, supplyNo } })
  return { _id: receiptId, supplyNo, purchaseOrderId, receivedAt: now, ...(payload.receivedBy ? { receivedBy: String(payload.receivedBy) } : {}), lines: receiptLines, ...(payload.notes ? { notes: String(payload.notes).trim() } : {}), createdAt: now } as any
}


// Deleting. Sales, returns and receipts keep their own copy of names, so history stays readable.

function objectId(id: unknown, what: string): ObjectId {
  if (typeof id !== 'string' || !ObjectId.isValid(id)) throw new Error(`${what} not found`)
  return new ObjectId(id)
}

/** Products in it simply lose the category. */
export async function deleteCategory(id: unknown): Promise<{ ok: true }> {
  const db = requireDb()
  const _id = objectId(id, 'Category')
  const category = await db.collection(CATEGORIES).findOne({ _id })
  if (!category) throw new Error('Category not found')
  await db.collection(PRODUCTS).updateMany({ categoryId: String(id) }, { $unset: { categoryId: '' } })
  await db.collection(CATEGORIES).deleteOne({ _id })
  await logAudit({ action: 'inventory.category.delete', resource: CATEGORIES, resourceId: String(id), details: { name: category.name } })
  return { ok: true }
}

/** Refused while the product is on a purchase order that has not been received or cancelled. */
export async function deleteProduct(id: unknown): Promise<{ ok: true }> {
  const db = requireDb()
  const _id = objectId(id, 'Product')
  const product = await db.collection(PRODUCTS).findOne({ _id })
  if (!product) throw new Error('Product not found')
  if (await db.collection(PO).findOne({ status: { $nin: ['received', 'completed', 'canceled'] }, 'lines.productId': String(id) })) throw new Error('PRODUCT_ON_OPEN_ORDER')
  await db.collection(PRODUCTS).deleteOne({ _id })
  await logAudit({ action: 'inventory.product.delete', resource: PRODUCTS, resourceId: String(id), details: { name: product.name, sku: product.sku, stockQuantity: product.stockQuantity } })
  return { ok: true }
}

/** Refused when the supplier is referenced by purchase orders. */
export async function deleteSupplier(id: unknown): Promise<{ ok: true }> {
  const db = requireDb()
  const _id = objectId(id, 'Supplier')
  const supplier = await db.collection(SUPPLIERS).findOne({ _id })
  if (!supplier) throw new Error('Supplier not found')
  if (await db.collection(PO).findOne({ supplierId: String(id) })) throw new Error('SUPPLIER_HAS_ORDERS')
  await db.collection(SUPPLIERS).deleteOne({ _id })
  await logAudit({ action: 'inventory.supplier.delete', resource: SUPPLIERS, resourceId: String(id), details: { name: supplier.name } })
  return { ok: true }
}
