export type SaleLine = {
  productId: string
  productName: string
  sku: string
  quantity: number
  /** 'base' on sales before 0.3.0 (= strip). */
  saleUnit?: 'base' | 'box' | 'strip' | 'pill'
  baseQuantity?: number
  unitsPerBox?: number
  unitPriceCents: number
  unitCostCents?: number
  discountCents: number
  taxCents: number
  lineTotalCents: number
}

export type Sale = {
  _id?: string
  invoiceNo: string
  clientRequestId?: string
  lines: SaleLine[]
  subtotalCents: number
  discountCents: number
  taxCents: number
  totalCents: number
  paymentMethod: 'cash' | 'card' | 'other'
  paidCents: number
  changeCents: number
  status: 'completed' | 'returned' | 'void'
  cashierUsername?: string
  createdAt: string
  updatedAt: string
}

export type Payment = {
  _id?: string
  saleId: string
  amountCents: number
  method: 'cash' | 'card' | 'other'
  createdAt: string
}

export type Return = {
  _id?: string
  saleId: string
  invoiceNo: string
  lines: { productId: string; quantity: number; amountCents: number }[]
  refundCents: number
  reason: string
  createdAt: string
  createdBy?: string
}

export type CashboxMovement = {
  _id?: string
  type: 'in' | 'out' | 'sale' | 'refund'
  amountCents: number
  reason: string
  reference?: string
  /** Who moved the cash: shifts are per cashier, so several tills can share one database. */
  cashierUsername?: string
  createdAt: string
}

export type CashierShift = {
  _id?: string
  cashierUsername: string
  openedAt: string
  closedAt?: string
  openingBalanceCents: number
  closingBalanceCents?: number
  status: 'open' | 'closed'
}
