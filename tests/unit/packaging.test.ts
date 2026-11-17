import { describe, expect, it } from 'vitest'
import { breakdown, derivePackaging, saleUnits, unitPrice, unitSize } from '../../src/shared/packaging'

describe('box / strip / pill', () => {
  // A box of 3 strips x 12 pills for 90.00.
  const box = derivePackaging({ packaging: 'box', stripsPerBox: 3, pillsPerStrip: 12, priceCents: 9000 })

  it('divides the box price into strip and pill prices', () => {
    expect(box).toMatchObject({ unitsPerBox: 36, boxPriceCents: 9000, stripPriceCents: 3000, sellingPriceCents: 250 })
    expect(saleUnits(box)).toEqual(['box', 'strip', 'pill'])
    expect([unitSize(box, 'box'), unitSize(box, 'strip'), unitSize(box, 'pill')]).toEqual([36, 12, 1])
    expect([unitPrice(box, 'box'), unitPrice(box, 'strip'), unitPrice(box, 'pill')]).toEqual([9000, 3000, 250])
    // Uneven division rounds to the nearest cent.
    expect(derivePackaging({ packaging: 'box', stripsPerBox: 3, priceCents: 1000 })).toMatchObject({ stripPriceCents: 333, sellingPriceCents: 333 })
  })

  it('5 boxes, one pill sold: 4 boxes, 2 strips and a strip of 11 pills', () => {
    expect(breakdown(5 * 36 - 1, box)).toEqual({ boxes: 4, strips: 2, pills: 11 })
    expect(breakdown(0, box)).toEqual({ boxes: 0, strips: 0, pills: 0 })
  })

  it('without pills per strip the strip is the smallest unit (no pill sales)', () => {
    const noPills = derivePackaging({ packaging: 'box', stripsPerBox: 2, priceCents: 5000 })
    expect(saleUnits(noPills)).toEqual(['box', 'strip'])
    expect(unitPrice(noPills, 'strip')).toBe(2500)
    expect(breakdown(5, noPills)).toEqual({ boxes: 2, strips: 1, pills: 0 })
  })

  it('strip and single-pill products', () => {
    const strip = derivePackaging({ packaging: 'strip', pillsPerStrip: 10, priceCents: 1500 })
    expect(saleUnits(strip)).toEqual(['strip', 'pill'])
    expect(unitPrice(strip, 'pill')).toBe(150)
    expect(breakdown(25, strip)).toEqual({ boxes: 0, strips: 2, pills: 5 })
    const pill = derivePackaging({ packaging: 'pill', priceCents: 700 })
    expect(saleUnits(pill)).toEqual(['pill'])
    expect(breakdown(7, pill)).toEqual({ boxes: 0, strips: 0, pills: 7 })
  })

  it('products saved before 0.3.0 keep working (strip base, optional box)', () => {
    const legacy = { unitsPerBox: 3, boxPriceCents: 2700, sellingPriceCents: 1000 }
    expect(saleUnits(legacy)).toEqual(['box', 'strip'])
    expect([unitSize(legacy, 'box'), unitPrice(legacy, 'box'), unitPrice(legacy, 'strip')]).toEqual([3, 2700, 1000])
    expect(saleUnits({ sellingPriceCents: 500 })).toEqual(['strip'])
  })
})

describe('stock colours', () => {
  it('red at or below the minimum, yellow within the warning margin, else ok', async () => {
    const { stockLevel } = await import('../../src/shared/packaging')
    // Boxes of 36 pills: minimum 8 boxes, warn 8 boxes before it.
    const p = (boxes: number) => ({ stockQuantity: boxes * 36, minStock: 8 * 36, stockWarnMargin: 8 * 36 })
    expect([stockLevel(p(2)), stockLevel(p(8)), stockLevel(p(9)), stockLevel(p(16)), stockLevel(p(17)), stockLevel(p(0))]).toEqual(['min', 'min', 'near', 'near', 'ok', 'out'])
    expect(stockLevel({ stockQuantity: 5, minStock: 0 })).toBe('ok')
  })
})
