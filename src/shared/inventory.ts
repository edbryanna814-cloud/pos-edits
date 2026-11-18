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
  /** 0.3.0: the product's own unit, and how it splits (see src/shared/packaging.ts). */
  packaging?: 'box' | 'strip' | 'pill'
  stripsPerBox?: number
  pillsPerStrip?: number
  stripPriceCents?: number
  /** Yellow warning this far above the minimum (smallest counted unit). */
  stockWarnMargin?: number
  /** Days a customer may return it; empty = cannot be returned. */
  returnDays?: number
  /** In the smallest counted unit (pill when pills per strip is set, else strip). */
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
  taxInfo?: string
  notes?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type PurchaseOrderLine = {
  productId: string
  quantity: number
  unitCostCents: number
  /** Accepted so far across supply orders (base units/line quantity). */
  receivedQuantity?: number
}

export type PurchaseOrder = {
  _id?: string
  /** Human-readable number for new orders; legacy orders may not have one. */
  orderNo?: string
  supplierId: string
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'ordered' | 'partially_received' | 'received' | 'completed' | 'canceled'
  lines: PurchaseOrderLine[]
  totalCents: number
  orderDate?: string
  expectedDeliveryDate?: string
  notes?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export type PurchaseReceiptLine = {
  productId: string
  /** Accepted quantity added to stock. */
  quantity: number
  damagedQuantity?: number
  remainingQuantity?: number
  unitCostCents?: number
}

export type PurchaseReceipt = {
  _id?: string
  /** Human-readable number for new supply orders; legacy receipts may not have one. */
  supplyNo?: string
  purchaseOrderId: string
  receivedAt: string
  receivedBy?: string
  lines: PurchaseReceiptLine[]
  notes?: string
  createdAt: string
}
