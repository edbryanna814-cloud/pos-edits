import { describe, expect, it } from 'vitest'
import { checkProductRows, holdImport, moneyCents, takeImport } from '../../src/main/productImport'

describe('product import', () => {
  it('reads English or Arabic headers and converts to stored units', () => {
    const [row] = checkProductRows([
      ['Name', 'SKU', 'Unit', 'Strips per box', 'Pills per strip', 'Price', 'Cost', 'Stock', 'Min stock', 'Expiry'],
      ['Panadol', 'PAN-1', 'Box', '3', '12', '90', '72', '5', '1', '31/12/2027']
    ], new Set())
    expect(row.errors).toEqual([])
    expect(row.input).toMatchObject({ packaging: 'box', stripsPerBox: 3, pillsPerStrip: 12, unitPriceCents: 9000, purchaseCostCents: 200, stockQuantity: 180, minStock: 36, expiryDate: '2027-12-31' })
    const [ar] = checkProductRows([['الاسم', 'الكود', 'الوحدة', 'السعر', 'الكمية'], ['بنادول', 'P2', 'شريط', '15,5', '10']], new Set())
    expect(ar.input).toMatchObject({ packaging: 'strip', unitPriceCents: 1550, stockQuantity: 10 })
  })

  it('flags each bad row with reasons; good rows still pass', () => {
    const rows = checkProductRows([
      ['name', 'sku', 'unit', 'price', 'stock', 'expiry'],
      ['A', 'OLD', 'box', '10', '1', ''],
      ['B', 'B1', 'bottle', 'x', '-1', 'soon'],
      ['C', 'C1', '', '5', '', ''],
      ['D', 'c1', 'pill', '5', '', ''],
      ['', '', '', '', '', '']
    ], new Set(['old']))
    expect(rows.map((r) => [r.line, r.errors])).toEqual([
      [2, ['SKU_EXISTS']],
      [3, ['UNIT_INVALID', 'PRICE_INVALID', 'STOCK_INVALID', 'EXPIRY_INVALID']],
      [4, []],
      [5, ['SKU_REPEATED']]
    ])
    expect(() => checkProductRows([['sku', 'stock']], new Set())).toThrow('IMPORT_COLUMNS_MISSING')
  })

  it('a checked sheet is used once', () => {
    const id = holdImport([])
    expect(takeImport(id)).toEqual([])
    expect(() => takeImport(id)).toThrow('IMPORT_EXPIRED')
    expect(moneyCents('12.345')).toBeNull()
  })
})
