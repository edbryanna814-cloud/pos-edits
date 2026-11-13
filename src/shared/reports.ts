export type SalesReport = {
  totalSalesCents: number
  totalCount: number
  grossCents: number
  discountCents: number
  taxCents: number
  returnsCents: number
  returnsCount: number
  cogsCents: number
  grossProfitCents: number
  byPaymentMethod: Record<string, { count: number; totalCents: number }>
  byCashier: Record<string, { count: number; totalCents: number }>
  byProduct: {
    productId: string
    productName: string
    quantity: number
    revenueCents: number
    costCents: number
    profitCents: number
  }[]
}

export type CashboxReport = {
  totalInCents: number
  totalOutCents: number
  balanceCents: number
}

export type InventoryReport = {
  totalProducts: number
  lowStock: number
  totalValueCents: number
}
