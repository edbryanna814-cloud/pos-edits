export type SalesReport = {
  totalSalesCents: number
  totalCount: number
  byPaymentMethod: Record<string, { count: number; totalCents: number }>
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
