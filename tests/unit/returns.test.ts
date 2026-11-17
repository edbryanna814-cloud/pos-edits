import { describe, expect, it } from 'vitest'
import { isLineOpen, lineRefund, returnDeadline } from '../../src/shared/returns'

describe('returns', () => {
  it('a return period runs from the sale; no period = cannot be returned', () => {
    expect(returnDeadline({ createdAt: '2026-11-16T10:00:00.000Z' }, { returnDays: 7 })!.toISOString()).toBe('2026-11-23T10:00:00.000Z')
    expect(returnDeadline({ createdAt: '2026-11-16T10:00:00.000Z' }, {})).toBeNull()
    expect(returnDeadline({ createdAt: '2026-11-16T10:00:00.000Z' }, { returnDays: 0 })).toBeNull()
  })

  it('refunds each line its share of what was paid; the last one gets the rest exactly', () => {
    // 3 lines worth 10, 10, 10 with 10% off: paid 27.00; shares 9.00 each.
    const sale = { createdAt: '', subtotalCents: 3000, totalCents: 2700, refundedCents: 0, lines: [0, 1, 2].map(() => ({ lineTotalCents: 1000, quantity: 1, returnedQuantity: 0 })) }
    expect(lineRefund(sale, 0)).toBe(900)
    sale.lines[0].returnedQuantity = 1
    sale.refundedCents = 900
    sale.lines[1].returnedQuantity = 1
    sale.refundedCents = 1800
    expect(isLineOpen(sale.lines[2])).toBe(true)
    expect(lineRefund(sale, 2)).toBe(900)
    // Uneven shares: 1/3 of 1000 → rounding is absorbed by the last line.
    const odd = { createdAt: '', subtotalCents: 300, totalCents: 1000, refundedCents: 333 * 2, lines: [{ lineTotalCents: 100, quantity: 1, returnedQuantity: 1 }, { lineTotalCents: 100, quantity: 1, returnedQuantity: 1 }, { lineTotalCents: 100, quantity: 1 }] }
    expect(lineRefund(odd, 2)).toBe(334)
  })
})
