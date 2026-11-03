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
  stockQuantity: number
  minStock: number
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

export type PurchaseOrder = {
  _id?: string
  supplierId: string
  status: 'draft' | 'ordered' | 'received' | 'canceled'
  totalCents: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export type PurchaseReceipt = {
  _id?: string
  purchaseOrderId: string
  receivedAt: string
  notes?: string
  createdAt: string
}
