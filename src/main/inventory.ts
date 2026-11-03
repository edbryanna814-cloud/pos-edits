import type { Db } from 'mongodb'
import { getDb } from './db'
import type { Category, Product, PurchaseOrder, PurchaseReceipt, StockMovement, Supplier, Unit } from '../shared/inventory'
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

export async function ensureInventorySchema(): Promise<void> {
  const db = requireDb()
  const cols = await db.listCollections({ name: { $in: [CATEGORIES, UNITS, PRODUCTS, STOCK, SUPPLIERS, PO, RECEIPTS] } }).toArray()
  const names = new Set(cols.map((c) => c.name))
  if (!names.has(CATEGORIES)) { await db.createCollection(CATEGORIES) }
  if (!names.has(UNITS)) { await db.createCollection(UNITS) }
  if (!names.has(PRODUCTS)) { await db.createCollection(PRODUCTS); await db.collection(PRODUCTS).createIndex({ sku: 1 }, { unique: true }) }
  if (!names.has(STOCK)) { await db.createCollection(STOCK); await db.collection(STOCK).createIndex({ productId: 1 }) }
  if (!names.has(SUPPLIERS)) { await db.createCollection(SUPPLIERS) }
  if (!names.has(PO)) { await db.createCollection(PO) }
  if (!names.has(RECEIPTS)) { await db.createCollection(RECEIPTS) }
}

export async function listCategories(): Promise<Category[]> { const db = requireDb(); return db.collection<Category>(CATEGORIES).find({}).toArray() }
export async function createCategory(input: Partial<Category>): Promise<Category> {
  const db = requireDb(); const now = new Date().toISOString()
  const cat: any = { name: input.name || '', description: input.description, createdAt: now, updatedAt: now }
  const r = await db.collection(CATEGORIES).insertOne(cat)
  return { _id: r.insertedId.toString(), ...cat }
}

export async function listUnits(): Promise<Unit[]> { const db = requireDb(); return db.collection<Unit>(UNITS).find({}).toArray() }
export async function createUnit(input: Partial<Unit>): Promise<Unit> {
  const db = requireDb(); const now = new Date().toISOString()
  const unit: any = { name: input.name || '', abbreviation: input.abbreviation || '', createdAt: now, updatedAt: now }
  const r = await db.collection(UNITS).insertOne(unit)
  return { _id: r.insertedId.toString(), ...unit }
}

export async function listProducts(): Promise<Product[]> { const db = requireDb(); return db.collection<Product>(PRODUCTS).find({}).toArray() }
export async function createProduct(input: Partial<Product>): Promise<Product> {
  const db = requireDb(); const now = new Date().toISOString()
  const product: any = {
    name: input.name || '',
    sku: input.sku || '',
    barcode: input.barcode,
    categoryId: input.categoryId,
    unitId: input.unitId,
    purchaseCostCents: Number(input.purchaseCostCents) || 0,
    sellingPriceCents: Number(input.sellingPriceCents) || 0,
    stockQuantity: Number(input.stockQuantity) || 0,
    minStock: Number(input.minStock) || 0,
    active: input.active !== false,
    createdAt: now,
    updatedAt: now
  }
  const r = await db.collection(PRODUCTS).insertOne(product)
  await logAudit({ action: 'inventory.product.create', resource: 'inv_products', resourceId: r.insertedId.toString() })
  return { _id: r.insertedId.toString(), ...product }
}

export async function updateProduct(id: string, input: Partial<Product>): Promise<Product> {
  const db = requireDb(); const { ObjectId } = await import('mongodb')
  const update: any = { $set: { ...input, updatedAt: new Date().toISOString() } }
  delete update.$set._id
  const r = await db.collection(PRODUCTS).findOneAndUpdate({ _id: new ObjectId(id) } as any, update, { returnDocument: 'after' } as any)
  if (!r) throw new Error('Product not found')
  return r as any
}

export async function listStockMovements(productId?: string): Promise<StockMovement[]> {
  const db = requireDb()
  const filter = productId ? { productId } : {}
  return db.collection<StockMovement>(STOCK).find(filter).sort({ createdAt: -1 }).toArray()
}

export async function stockAdjust(input: { productId: string; quantity: number; reason: string }): Promise<StockMovement> {
  const db = requireDb()
  const { ObjectId } = await import('mongodb')
  const now = new Date().toISOString()
  const movement: any = { productId: input.productId, type: 'adjustment', quantity: input.quantity, reason: input.reason, createdAt: now }
  await db.collection(PRODUCTS).updateOne({ _id: new ObjectId(input.productId) } as any, { $inc: { stockQuantity: input.quantity }, $set: { updatedAt: now } })
  const r = await db.collection(STOCK).insertOne(movement)
  await logAudit({ action: 'inventory.stock.adjust', resource: 'inv_products', resourceId: input.productId })
  return { _id: r.insertedId.toString(), ...movement }
}

export async function listSuppliers(): Promise<Supplier[]> { const db = requireDb(); return db.collection<Supplier>(SUPPLIERS).find({}).toArray() }
export async function createSupplier(input: Partial<Supplier>): Promise<Supplier> {
  const db = requireDb(); const now = new Date().toISOString()
  const sup: any = { name: input.name || '', contact: input.contact, phone: input.phone, email: input.email, address: input.address, active: input.active !== false, createdAt: now, updatedAt: now }
  const r = await db.collection(SUPPLIERS).insertOne(sup)
  return { _id: r.insertedId.toString(), ...sup }
}

export async function listPO(): Promise<PurchaseOrder[]> { const db = requireDb(); return db.collection<PurchaseOrder>(PO).find({}).sort({ createdAt: -1 }).toArray() }
export async function createPO(input: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
  const db = requireDb(); const now = new Date().toISOString()
  const po: any = { supplierId: input.supplierId || '', status: 'draft', totalCents: Number(input.totalCents) || 0, notes: input.notes, createdAt: now, updatedAt: now }
  const r = await db.collection(PO).insertOne(po)
  return { _id: r.insertedId.toString(), ...po }
}

export async function receivePO(purchaseOrderId: string, notes?: string): Promise<PurchaseReceipt> {
  const db = requireDb()
  const { ObjectId } = await import('mongodb')
  const now = new Date().toISOString()
  await db.collection(PO).updateOne({ _id: new ObjectId(purchaseOrderId) } as any, { $set: { status: 'received', updatedAt: now } })
  const receipt: any = { purchaseOrderId, receivedAt: now, notes, createdAt: now }
  const r = await db.collection(RECEIPTS).insertOne(receipt)
  await logAudit({ action: 'inventory.po.receive', resource: 'inv_purchase_orders', resourceId: purchaseOrderId })
  return { _id: r.insertedId.toString(), ...receipt }
}
