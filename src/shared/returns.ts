// Returns: a sale line can be returned while its product's return period (days, saved on the line when it
// was sold) has not ended. No period = cannot be returned. No imports: unit-tested.

export type ReturnableLine = {
  saleId: string
  invoiceNo: string
  lineIndex: number
  productName: string
  /** Remaining quantity that can still be returned (sale unit). */
  quantity: number
  saleUnit?: string
  /** Refund for returning the remaining quantity on this line. */
  refundCents: number
  soldAt: string
  /** Last moment it can be returned. */
  deadline: string
  customerName?: string
}

type LineLike = { lineTotalCents: number; returnDays?: number; returnedQuantity?: number; quantity: number }
type SaleLike = { createdAt: string; subtotalCents: number; totalCents: number; refundedCents?: number; lines: LineLike[] }

const DAY = 86400000

/** When this line can no longer be returned, or null when it cannot be returned at all. */
export function returnDeadline(sale: { createdAt: string }, line: { returnDays?: number }): Date | null {
  const days = Math.trunc(line.returnDays ?? 0)
  if (!(days > 0)) return null
  return new Date(new Date(sale.createdAt).getTime() + days * DAY)
}

export const isLineOpen = (line: LineLike) => (line.returnedQuantity ?? 0) < line.quantity

function remainingSaleUnits(sale: SaleLike): number {
  return sale.lines.reduce((sum, l) => sum + (isLineOpen(l) ? l.quantity - (l.returnedQuantity ?? 0) : 0), 0)
}

/**
 * Money back for returning `qty` units of a line (sale unit). The final return that closes the whole sale
 * gets whatever is left so all refunds sum to the sale total exactly.
 */
export function lineRefund(sale: SaleLike, index: number, qty?: number): number {
  const line = sale.lines[index]
  const remaining = line.quantity - (line.returnedQuantity ?? 0)
  const take = Math.max(0, Math.min(Math.trunc(qty ?? remaining), remaining))
  if (take <= 0) return 0
  if (take === remainingSaleUnits(sale)) return sale.totalCents - (sale.refundedCents ?? 0)
  if (sale.subtotalCents <= 0) return 0
  return Math.round((line.lineTotalCents * (take / line.quantity) * sale.totalCents) / sale.subtotalCents)
}
