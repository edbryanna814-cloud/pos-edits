import { randomUUID } from 'node:crypto'
import { derivePackaging, unitSize, type Packaging } from '../shared/packaging'
import { excelDate } from './sheet'

// Products from an Excel/CSV sheet: the first row names the columns (English or Arabic). Every row is
// checked and shown to the user; nothing is added until they confirm. Prices are in the currency's
// main unit (12.50); stock and minimum are in the product's own unit (boxes for a box product).

export type ImportRow = {
  line: number
  name: string
  sku: string
  packaging: Packaging
  unitPriceCents: number
  stock: number
  errors: string[]
  /** What createProduct receives (only when errors is empty). */
  input?: Record<string, unknown>
}

const COLUMNS: Record<string, string[]> = {
  name: ['name', 'product', 'product name', 'الاسم', 'اسم المنتج', 'المنتج'],
  sku: ['sku', 'code', 'item code', 'الكود', 'كود', 'رمز'],
  barcode: ['barcode', 'الباركود', 'باركود'],
  unit: ['unit', 'unit type', 'الوحدة', 'نوع الوحدة'],
  strips: ['strips', 'strips per box', 'strips in box', 'عدد الشرائط', 'الشرائط'],
  pills: ['pills', 'pills per strip', 'pills in strip', 'عدد الأقراص', 'الأقراص'],
  price: ['price', 'selling price', 'unit price', 'السعر', 'سعر البيع'],
  cost: ['cost', 'purchase cost', 'purchase price', 'التكلفة', 'سعر الشراء'],
  stock: ['stock', 'quantity', 'qty', 'opening stock', 'الكمية', 'المخزون'],
  minStock: ['min stock', 'minimum stock', 'minimum', 'الحد الأدنى'],
  expiry: ['expiry', 'expiry date', 'expires', 'الصلاحية', 'تاريخ الانتهاء']
}

const UNITS: Record<string, Packaging> = { box: 'box', boxes: 'box', علبة: 'box', strip: 'strip', strips: 'strip', شريط: 'strip', pill: 'pill', pills: 'pill', piece: 'pill', قرص: 'pill' }

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** "12.5" / "12,50" → 1250 cents; null when not a non-negative amount with up to 2 decimals. */
export function moneyCents(value: string): number | null {
  const t = value.trim().replace(',', '.')
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null
  return Math.round(Number(t) * 100)
}

const wholeOr = (value: string, fallback: number | null) => {
  if (!value.trim()) return fallback
  return /^\d{1,9}$/.test(value.trim()) ? Number(value) : NaN
}

function expiryOf(value: string): string | null | undefined {
  const v = value.trim()
  if (!v) return undefined
  const fromExcel = excelDate(v)
  const d = fromExcel ?? (() => {
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v)
    const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v)
    return iso ? new Date(+iso[1], +iso[2] - 1, +iso[3]) : dmy ? new Date(+dmy[3], +dmy[2] - 1, +dmy[1]) : null
  })()
  if (!d || Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Checks every row; `existingSkus` are already in the database (lower-cased). */
export function checkProductRows(rows: string[][], existingSkus: Set<string>): ImportRow[] {
  const header = (rows[0] ?? []).map(norm)
  const col: Record<string, number> = {}
  for (const [field, names] of Object.entries(COLUMNS)) col[field] = header.findIndex((h) => names.includes(h))
  if (col.name < 0 || col.price < 0) throw new Error('IMPORT_COLUMNS_MISSING')
  const seen = new Set<string>()
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((r, i) => {
    const get = (field: string) => (col[field] >= 0 ? String(r[col[field]] ?? '') : '')
    const errors: string[] = []
    const name = get('name').trim().slice(0, 200)
    if (!name) errors.push('NAME_MISSING')
    const sku = (get('sku').trim() || get('barcode').trim()).slice(0, 60)
    if (!sku) errors.push('SKU_MISSING')
    else if (existingSkus.has(sku.toLowerCase())) errors.push('SKU_EXISTS')
    else if (seen.has(sku.toLowerCase())) errors.push('SKU_REPEATED')
    seen.add(sku.toLowerCase())
    const unitText = norm(get('unit'))
    const packaging = unitText ? UNITS[unitText] : 'box'
    if (!packaging) errors.push('UNIT_INVALID')
    const strips = wholeOr(get('strips'), 1)
    const pills = wholeOr(get('pills'), null)
    if (!(strips! >= 1) || (pills !== null && !(pills >= 1))) errors.push('SPLIT_INVALID')
    const price = moneyCents(get('price'))
    if (price === null || price <= 0) errors.push('PRICE_INVALID')
    const cost = get('cost').trim() ? moneyCents(get('cost')) : 0
    if (cost === null) errors.push('COST_INVALID')
    const stock = wholeOr(get('stock'), 0)
    const minStock = wholeOr(get('minStock'), 0)
    if (Number.isNaN(stock) || Number.isNaN(minStock)) errors.push('STOCK_INVALID')
    const expiryDate = expiryOf(get('expiry'))
    if (expiryDate === null) errors.push('EXPIRY_INVALID')

    const row: ImportRow = { line: i + 2, name, sku, packaging: packaging ?? 'box', unitPriceCents: price ?? 0, stock: Number(stock) || 0, errors }
    if (errors.length === 0) {
      const pack = derivePackaging({ packaging, stripsPerBox: strips!, pillsPerStrip: pills ?? undefined, priceCents: price! })
      const size = unitSize(pack, packaging)
      row.input = {
        name, sku, barcode: get('barcode').trim() || undefined, packaging, stripsPerBox: strips, pillsPerStrip: pills ?? undefined,
        unitPriceCents: price, purchaseCostCents: Math.round(cost! / size), stockQuantity: stock! * size, minStock: minStock! * size,
        ...(expiryDate ? { expiryDate } : {})
      }
    }
    return row
  })
}

/** Checked sheets waiting for the user's confirmation (in memory, 30 minutes, one use). */
const pending = new Map<string, { rows: ImportRow[]; until: number }>()

export function holdImport(rows: ImportRow[]): string {
  for (const [id, p] of pending) if (p.until < Date.now()) pending.delete(id)
  const id = randomUUID()
  pending.set(id, { rows, until: Date.now() + 30 * 60_000 })
  return id
}

export function takeImport(id: unknown): ImportRow[] {
  const p = typeof id === 'string' ? pending.get(id) : undefined
  if (!p || p.until < Date.now()) throw new Error('IMPORT_EXPIRED')
  pending.delete(id as string)
  return p.rows
}
