import { BSON, type Db } from 'mongodb'
import { getDb } from './db'
import { packOf, unitPrice, unitSize } from '../shared/packaging'
import { breakdown } from '../shared/packaging'
import type { Cell } from './sheetWrite'

// Exports for Administrators: each section as Excel (readable, one row per record) or as a .db file
// (the records exactly as stored: MongoDB Extended JSON, the same format the backups use inside).
// The inventory sheet uses the product-import columns, so it doubles as the import template.

export const EXPORT_SECTIONS = ['inventory', 'users', 'customers', 'sales', 'audit', 'attendance'] as const
export type ExportSection = (typeof EXPORT_SECTIONS)[number]

const COLLECTION: Record<ExportSection, string> = {
  inventory: 'inv_products', users: 'users', customers: 'customers', sales: 'pos_sales', audit: 'audit', attendance: 'attendance'
}
/** Never leaves the database, in any format. */
const SECRET_FIELDS: Partial<Record<ExportSection, string[]>> = { users: ['passwordHash', 'failedLoginCount', 'lockedUntil'] }

const money = (cents: unknown) => Math.round(Number(cents) || 0) / 100
const id = (doc: any) => String(doc._id)

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

function sheetRows(section: ExportSection, docs: any[]): Cell[][] {
  switch (section) {
    case 'inventory':
      return [
        ['Name', 'SKU', 'Barcode', 'Unit', 'Strips per box', 'Pills per strip', 'Price', 'Cost', 'Stock', 'Min stock', 'Expiry', 'Return days', 'Warn margin', 'Stock detail', 'Record ID'],
        ...docs.map((p) => {
          const k = packOf(p)
          const size = unitSize(p, k.packaging)
          const b = breakdown(p.stockQuantity, p)
          return [
            p.name, p.sku, p.barcode ?? '', k.packaging, k.packaging === 'box' ? k.stripsPerBox : '', k.pillsPerStrip > 1 ? k.pillsPerStrip : '',
            money(unitPrice(p, k.packaging)), money((p.purchaseCostCents ?? 0) * size), Math.floor(p.stockQuantity / size), Math.ceil((p.minStock ?? 0) / size),
            p.expiryDate ? String(p.expiryDate).slice(0, 10) : '', p.returnDays || '', p.stockWarnMargin ? Math.ceil(p.stockWarnMargin / size) : '',
            `${b.boxes} boxes, ${b.strips} strips, ${b.pills} pills`, id(p)
          ]
        })
      ]
    case 'users':
      return [['User ID', 'Username', 'Role', 'Active', 'Created', 'Record ID'], ...docs.map((u) => [u.userNo ?? '', u.username, u.role, u.active !== false ? 'yes' : 'no', u.createdAt, id(u)])]
    case 'customers':
      return [['Name', 'ID number', 'Phone', 'Discount %', 'Created', 'Record ID'], ...docs.map((c) => [c.name, c.nationalId, c.phone, (c.discountBasisPoints ?? 0) / 100, c.createdAt, id(c)])]
    case 'sales':
      return [
        ['Invoice', 'Date', 'Cashier', 'Customer', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Refunded', 'Payment', 'Status', 'Record ID'],
        ...docs.map((s) => [
          s.invoiceNo, s.createdAt, s.cashierUsername ?? '', s.customerName ?? '',
          (s.lines ?? []).map((l: any) => `${l.quantity} ${l.saleUnit && l.saleUnit !== 'base' ? l.saleUnit + ' ' : ''}${l.productName}`).join('; '),
          money(s.subtotalCents), money(s.discountCents), money(s.taxCents), money(s.totalCents), money(s.refundedCents), s.paymentMethod, s.status, id(s)
        ])
      ]
    case 'audit':
      return [['Seq', 'Date', 'User', 'Action', 'Resource', 'Resource ID', 'Details', 'Record ID'], ...docs.map((e) => [e.seq ?? '', e.createdAt, e.actorUsername ?? '', e.action, e.resource, e.resourceId ?? '', e.details ? JSON.stringify(e.details) : '', id(e)])]
    case 'attendance':
      return [['User ID', 'Date-time', 'Type', 'Imported', 'Record ID'], ...docs.map((p) => [p.userNo, p.at, p.type, p.importedAt, id(p)])]
  }
}

export async function exportSection(section: unknown, format: unknown): Promise<{ data: Uint8Array | string; ext: 'xlsx' | 'db'; count: number }> {
  if (!EXPORT_SECTIONS.includes(section as ExportSection)) throw new Error('EXPORT_SECTION_INVALID')
  if (format !== 'xlsx' && format !== 'db') throw new Error('EXPORT_FORMAT_INVALID')
  const s = section as ExportSection
  const hidden = Object.fromEntries((SECRET_FIELDS[s] ?? []).map((f) => [f, 0]))
  const sort = s === 'audit' ? { seq: 1 } : s === 'inventory' ? { name: 1 } : s === 'attendance' ? { at: 1 } : { createdAt: 1 }
  const docs = await requireDb().collection(COLLECTION[s]).find({}, { projection: hidden }).sort(sort as any).toArray()
  if (format === 'db') return { data: BSON.EJSON.stringify(docs, undefined, 1, { relaxed: false }), ext: 'db', count: docs.length }
  const { writeXlsx } = await import('./sheetWrite')
  return { data: writeXlsx(sheetRows(s, docs), s), ext: 'xlsx', count: docs.length }
}
