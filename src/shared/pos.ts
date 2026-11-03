export type SaleLine = {
  productId: string
  productName: string
  sku: string
  quantity: number
  unitPriceCents: number
  discountCents: number
  taxCents: number
  lineTotalCents: number
}

export type Sale = {
  _id?: string
  invoiceNo: string
  customerId?: string
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
