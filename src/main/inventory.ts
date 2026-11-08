import { ObjectId, type Db } from 'mongodb'
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
    stockQuantity: toInteger(input.stockQuantity ?? 0, 'Stock quantity'),
    minStock: toInteger(input.minStock ?? 0, 'Minimum stock'),
    expiryDate: input.expiryDate ? String(input.expiryDate).trim() : undefined,
    active: input.active !== false,
    createdAt: now,
    updatedAt: now
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
  if (input.minStock !== undefined) update.minStock = toInteger(input.minStock, 'Minimum stock')
  if (input.expiryDate !== undefined)
    update.expiryDate = input.expiryDate ? String(input.expiryDate).trim() : undefined
  if (input.active !== undefined) update.active = Boolean(input.active)
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
    active: input.active !== false,
    createdAt: now,
    updatedAt: now
  }
  const r = await db.collection(SUPPLIERS).insertOne(sup)
  await logAudit({ action: 'inventory.supplier.create', resource: 'inv_suppliers', resourceId: r.insertedId.toString() })
  return { ...sup, _id: r.insertedId.toString() }
}

export async function listPO(): Promise<PurchaseOrder[]> {
  const db = requireDb()
  return (await db.collection<PurchaseOrder>(PO).find({}).sort({ createdAt: -1 }).toArray()).map(withStringId)
}
export async function createPO(input: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
  const db = requireDb()
  if (!ObjectId.isValid(String(input.supplierId || ''))) throw new Error('Supplier is required')
  const supplier = await db.collection(SUPPLIERS).findOne({ _id: new ObjectId(String(input.supplierId)) } as any)
  if (!supplier) throw new Error('Supplier not found')
  const rawLines = Array.isArray(input.lines) ? input.lines : []
  if (rawLines.length === 0) throw new Error('Add at least one line item')
  const lines: PurchaseOrderLine[] = []
  for (const raw of rawLines) {
    const productId = String((raw as any)?.productId || '')
    if (!ObjectId.isValid(productId)) throw new Error('Invalid product in purchase order')
    const product = await db.collection(PRODUCTS).findOne({ _id: new ObjectId(productId) } as any)
    if (!product) throw new Error('Product not found in purchase order')
    lines.push({
      productId,
      quantity: toInteger((raw as any)?.quantity, 'Line quantity', 1),
      unitCostCents: toInteger((raw as any)?.unitCostCents ?? 0, 'Line unit cost')
    })
  }
  const status = ['draft', 'ordered', 'canceled'].includes(String(input.status))
    ? (input.status as PurchaseOrder['status'])
    : 'draft'
  const now = new Date().toISOString()
  const po: any = {
    supplierId: String(input.supplierId),
    status,
    lines,
    totalCents: lines.reduce((sum, line) => sum + line.quantity * line.unitCostCents, 0),
    notes: input.notes ? String(input.notes).trim() : undefined,
    createdAt: now,
    updatedAt: now
  }
  const r = await db.collection(PO).insertOne(po)
  await logAudit({ action: 'inventory.po.create', resource: 'inv_purchase_orders', resourceId: r.insertedId.toString() })
  return { ...po, _id: r.insertedId.toString() }
}

export async function receivePO(purchaseOrderId: string, notes?: string): Promise<PurchaseReceipt> {
  const db = requireDb()
  if (!ObjectId.isValid(purchaseOrderId)) throw new Error('Invalid purchase order')
  const po = await db.collection<PurchaseOrder>(PO).findOne({ _id: new ObjectId(purchaseOrderId) } as any)
  if (!po) throw new Error('Purchase order not found')
  if (po.status === 'received') throw new Error('Purchase order already received')
  if (po.status === 'canceled') throw new Error('Canceled purchase order cannot be received')
  const lines = Array.isArray(po.lines) ? po.lines : []
  if (lines.length === 0) throw new Error('Purchase order has no line items')

  const client = getClient()
  if (!client) throw new Error('Database unavailable')
  const session = client.startSession()
  const now = new Date().toISOString()
  let receiptId: string
  try {
    receiptId = await session.withTransaction(async () => {
      for (const line of lines) {
        const quantity = toInteger(line.quantity, 'Line quantity', 1)
        const result = await db.collection(PRODUCTS).updateOne(
          { _id: new ObjectId(line.productId) } as any,
          { $inc: { stockQuantity: quantity }, $set: { updatedAt: now } },
          { session }
        )
        if (result.matchedCount !== 1) throw new Error('Product not found in purchase order')
        await db.collection(STOCK).insertOne(
          {
            productId: line.productId,
            type: 'purchase',
            quantity,
            reason: `Purchase order received`,
            reference: purchaseOrderId,
            createdAt: now
          },
          { session }
        )
      }
      const receipt: any = {
        purchaseOrderId,
        receivedAt: now,
        lines,
        notes: notes ? String(notes).trim() : undefined,
        createdAt: now
      }
      const inserted = await db.collection(RECEIPTS).insertOne(receipt, { session })
      await db.collection(PO).updateOne(
        { _id: new ObjectId(purchaseOrderId) } as any,
        { $set: { status: 'received', updatedAt: now } },
        { session }
      )
      return inserted.insertedId.toString()
    })
  } finally {
    await session.endSession()
  }
  await logAudit({ action: 'inventory.po.receive', resource: 'inv_purchase_orders', resourceId: purchaseOrderId })
  return {
    _id: receiptId,
    purchaseOrderId,
    receivedAt: now,
    lines,
    notes: notes ? String(notes).trim() : undefined,
    createdAt: now
  }
}
