import { BSON, type Db } from 'mongodb'
import { getDb } from './db'
import { packOf, unitPrice, unitSize } from '../shared/packaging'
import { breakdown } from '../shared/packaging'
import type { Cell } from './sheetWrite'
import { isAdminViewer, listAdminUsernames } from './auth'
import { checkRange } from './attendance'

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
      return [['Name', 'ID number', 'Phone', 'Email', 'Address', 'Notes', 'Discount %', 'Active', 'Created', 'Record ID'], ...docs.map((c) => [c.name, c.nationalId, c.phone, c.email ?? '', c.address ?? '', c.notes ?? '', (c.discountBasisPoints ?? 0) / 100, c.active === false ? 'no' : 'yes', c.createdAt, id(c)])]
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

export const REPORT_KINDS = ['sales', 'purchasing'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]

/**
 * Managers' reports (reports.view): one Excel sheet for a date range of at most a year, with a totals
 * row. No record IDs, and administrator accounts stay hidden from everyone else (cashier left empty).
 */
export async function exportReport(kind: unknown, range: unknown): Promise<{ data: Uint8Array; count: number; name: string }> {
  if (!REPORT_KINDS.includes(kind as ReportKind)) throw new Error('EXPORT_SECTION_INVALID')
  const { from, to, fromIso, toIso } = checkRange(range)
  const db = requireDb()
  const when = { createdAt: { $gte: fromIso, $lt: toIso } }
  const { writeXlsx } = await import('./sheetWrite')
  const name = `${kind}-report-${from}-to-${to}`
  const sum = (rows: Cell[][], col: number) => Math.round(rows.reduce((t, r) => t + (Number(r[col]) || 0), 0) * 100) / 100

  if (kind === 'sales') {
    const hidden = isAdminViewer() ? new Set<string>() : new Set(await listAdminUsernames())
    const docs = (await db.collection('pos_sales').find(when).sort({ createdAt: 1 }).toArray())
      .map((s) => (hidden.has(s.cashierUsername) ? { ...s, cashierUsername: '' } : s))
    const [head, ...rows] = sheetRows('sales', docs).map((r) => r.slice(0, -1)) // drop Record ID
    const totals: Cell[] = ['Total', '', '', '', '', sum(rows, 5), sum(rows, 6), sum(rows, 7), sum(rows, 8), sum(rows, 9), '', '']
    return { data: writeXlsx([head, ...rows, totals], 'sales'), count: rows.length, name }
  }

  const orders = await db.collection('inv_purchase_orders').find(when).sort({ createdAt: 1 }).toArray()
  const supplierIds = [...new Set(orders.map((o) => o.supplierId))]
  const productIds = [...new Set(orders.flatMap((o) => (o.lines ?? []).map((l: any) => l.productId)))]
  const asIds = (ids: string[]) => ids.filter((x) => BSON.ObjectId.isValid(x)).map((x) => new BSON.ObjectId(x))
  const suppliers = new Map((await db.collection('inv_suppliers').find({ _id: { $in: asIds(supplierIds) } }).toArray()).map((s) => [String(s._id), s.name]))
  const products = new Map((await db.collection('inv_products').find({ _id: { $in: asIds(productIds) } }).toArray()).map((p) => [String(p._id), p]))
  const receipts = await db.collection('inv_purchase_receipts').find({ purchaseOrderId: { $in: orders.map((o) => String(o._id)) } }).toArray()
  const receivedAt = new Map<string, string>()
  for (const r of receipts) {
    const key = String(r.purchaseOrderId)
    const at = String(r.receivedAt ?? r.createdAt ?? '')
    if (!receivedAt.has(key) || at > (receivedAt.get(key) ?? '')) receivedAt.set(key, at)
  }
  const rows: Cell[][] = orders.flatMap((o) =>
    (o.lines ?? []).map((l: any) => {
      const p = products.get(l.productId)
      const ordered = Number(l.quantity) || 0
      const receivedQty = Number(l.receivedQuantity) || 0
      return [
        String(o.orderDate ?? o.createdAt ?? '').slice(0, 10), o.orderNo ?? '', o.status, suppliers.get(o.supplierId) ?? '', p?.name ?? '', p?.sku ?? '',
        ordered, receivedQty, Math.max(0, ordered - receivedQty), money(l.unitCostCents), money(ordered * l.unitCostCents), receivedAt.get(String(o._id)) ?? '', o.notes ?? ''
      ]
    })
  )
  const head: Cell[] = ['Order date', 'PO no.', 'Status', 'Supplier', 'Product', 'SKU', 'Ordered', 'Received', 'Remaining', 'Unit cost', 'Line total', 'Last received', 'Notes']
  const totals: Cell[] = ['Total', '', '', '', '', '', sum(rows, 6), sum(rows, 7), sum(rows, 8), '', sum(rows, 10), '', '']
  return { data: writeXlsx([head, ...rows, totals], 'purchasing'), count: orders.length, name }
}
