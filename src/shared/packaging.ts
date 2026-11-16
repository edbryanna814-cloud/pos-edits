// Box / strip / pill. Stock is kept in the smallest unit the product counts: the pill when "pills per
// strip" is set, otherwise the strip (as before). A box price is divided into strip and pill prices.
// Shared by the server (sales, stock) and the screens, so both always agree. No imports: unit-tested.

export type Packaging = 'box' | 'strip' | 'pill'
export type SaleUnit = 'box' | 'strip' | 'pill'

export type PackagingFields = {
  packaging?: Packaging
  stripsPerBox?: number
  pillsPerStrip?: number
  unitsPerBox?: number
  boxPriceCents?: number
  stripPriceCents?: number
  sellingPriceCents: number
}

const whole = (value: unknown, fallback: number) => {
  const n = Math.trunc(Number(value))
  return Number.isFinite(n) && n >= 1 ? n : fallback
}

/** Normalised packaging; products saved before 0.3.0 (no `packaging`) are strips, boxed when unitsPerBox > 1. */
export function packOf(p: PackagingFields) {
  const legacyBox = whole(p.unitsPerBox, 1)
  const packaging: Packaging = p.packaging ?? (legacyBox > 1 ? 'box' : 'strip')
  const pillsPerStrip = packaging === 'pill' ? 1 : whole(p.pillsPerStrip, 1)
  const stripsPerBox = packaging === 'box' ? whole(p.stripsPerBox, Math.max(1, Math.round(legacyBox / pillsPerStrip))) : 1
  return { packaging, stripsPerBox, pillsPerStrip, countsPills: packaging === 'pill' || pillsPerStrip > 1 }
}

/** Units the product can be sold in, largest first. */
export function saleUnits(p: PackagingFields): SaleUnit[] {
  const k = packOf(p)
  const units: SaleUnit[] = []
  if (k.packaging === 'box') units.push('box')
  if (k.packaging !== 'pill') units.push('strip')
  if (k.countsPills) units.push('pill')
  return units
}

/** How many stock units (the smallest counted unit) one sale unit takes. */
export function unitSize(p: PackagingFields, unit: SaleUnit): number {
  const k = packOf(p)
  if (unit === 'box') return k.stripsPerBox * k.pillsPerStrip
  if (unit === 'strip') return k.pillsPerStrip
  return 1
}

/** Price of one sale unit in cents (0 = not set). */
export function unitPrice(p: PackagingFields, unit: SaleUnit): number {
  const k = packOf(p)
  if (unit === 'box') return Math.max(0, Math.trunc(p.boxPriceCents ?? 0))
  if (unit === 'strip' && k.countsPills) return Math.max(0, Math.trunc(p.stripPriceCents ?? 0))
  return Math.max(0, Math.trunc(p.sellingPriceCents))
}

/**
 * From the price of the product's own unit (a box, a strip or a pill), the stored fields: the box price is
 * divided by the strips in it, and by all its pills for the pill price (rounded to the nearest cent).
 */
export function derivePackaging(input: { packaging: Packaging; stripsPerBox?: number; pillsPerStrip?: number; priceCents: number }) {
  const packaging = input.packaging
  const pills = packaging === 'pill' ? 1 : whole(input.pillsPerStrip, 1)
  const strips = packaging === 'box' ? whole(input.stripsPerBox, 1) : 1
  const price = Math.max(0, Math.trunc(input.priceCents))
  if (packaging === 'box') {
    return {
      packaging, stripsPerBox: strips, pillsPerStrip: pills, unitsPerBox: strips * pills, boxPriceCents: price,
      stripPriceCents: Math.round(price / strips), sellingPriceCents: Math.round(price / (strips * pills))
    }
  }
  if (packaging === 'strip') {
    return { packaging, stripsPerBox: 1, pillsPerStrip: pills, unitsPerBox: pills, boxPriceCents: undefined, stripPriceCents: price, sellingPriceCents: Math.round(price / pills) }
  }
  return { packaging, stripsPerBox: 1, pillsPerStrip: 1, unitsPerBox: 1, boxPriceCents: undefined, stripPriceCents: undefined, sellingPriceCents: price }
}

/** Stock split into whole boxes, strips and loose pills: 5 boxes minus one pill → 4 boxes, 2 strips, 11 pills. */
export function breakdown(stock: number, p: PackagingFields): { boxes: number; strips: number; pills: number } {
  const k = packOf(p)
  let rest = Math.max(0, Math.trunc(stock))
  const perBox = k.stripsPerBox * k.pillsPerStrip
  const boxes = k.packaging === 'box' ? Math.floor(rest / perBox) : 0
  rest -= boxes * perBox
  if (k.packaging === 'pill') return { boxes: 0, strips: 0, pills: rest }
  const strips = Math.floor(rest / k.pillsPerStrip)
  return { boxes, strips, pills: rest - strips * k.pillsPerStrip }
}
