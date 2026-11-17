// Returns: a sale line can be returned while its product's return period (days, saved on the line when it
// was sold) has not ended. No period = cannot be returned. No imports: unit-tested.

export type ReturnableLine = {
  saleId: string
  invoiceNo: string
  lineIndex: number
  productName: string
  quantity: number
  saleUnit?: string
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

/**
 * The money back for one line: its share of what the customer paid (after the sale's discount and tax).
 * The last open line gets whatever is left, so all refunds add up to the sale total exactly.
 */
export function lineRefund(sale: SaleLike, index: number): number {
  const open = sale.lines.filter(isLineOpen)
  if (open.length === 1 && isLineOpen(sale.lines[index])) return sale.totalCents - (sale.refundedCents ?? 0)
  if (sale.subtotalCents <= 0) return 0
  return Math.round((sale.lines[index].lineTotalCents * sale.totalCents) / sale.subtotalCents)
}
