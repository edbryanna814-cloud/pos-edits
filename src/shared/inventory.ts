export type Category = {
  _id?: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export type Unit = {
  _id?: string
  name: string
  abbreviation: string
  createdAt: string
  updatedAt: string
}

export type Product = {
  _id?: string
  name: string
  sku: string
  barcode?: string
  categoryId?: string
  unitId?: string
  purchaseCostCents: number
  sellingPriceCents: number
  unitsPerBox?: number
  boxPriceCents?: number
  stockQuantity: number
  minStock: number
  expiryDate?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type StockMovement = {
  _id?: string
  productId: string
  type: 'purchase' | 'sale' | 'adjustment' | 'transfer' | 'return'
  quantity: number
  reason: string
  reference?: string
  createdAt: string
  createdBy?: string
}

export type Supplier = {
  _id?: string
  name: string
  contact?: string
  phone?: string
  email?: string
  address?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type PurchaseOrderLine = {
  productId: string
  quantity: number
  unitCostCents: number
}

export type PurchaseOrder = {
  _id?: string
  supplierId: string
  status: 'draft' | 'ordered' | 'received' | 'canceled'
  lines: PurchaseOrderLine[]
  totalCents: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export type PurchaseReceipt = {
  _id?: string
  purchaseOrderId: string
  receivedAt: string
  lines: PurchaseOrderLine[]
  notes?: string
  createdAt: string
}
