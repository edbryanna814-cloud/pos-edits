import { useMemo, useState, type FormEvent } from 'react'
import type { Product, PurchaseOrder, PurchaseOrderLine, Supplier } from '../../../shared/inventory'
import type { Language } from '../../../shared/settings'
import { formatDateTime, formatMoney, parseMoney } from '../money'

interface Props {
  products: Product[]
  suppliers: Supplier[]
  purchaseOrders: PurchaseOrder[]
  language: Language
  currency: string
  onChanged: () => void
}

const copy = {
  en: {
    title: 'Suppliers & purchasing',
    suppliers: 'Suppliers',
    orders: 'Purchase orders',
    addSupplier: 'Add supplier',
    supplierName: 'Supplier name',
    contact: 'Contact person',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    active: 'Active',
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    noSuppliers: 'No suppliers yet.',
    noOrders: 'No purchase orders yet.',
    newOrder: 'New purchase order',
    supplier: 'Supplier',
    status: 'Status',
    notes: 'Notes',
    lineProduct: 'Product',
    lineQuantity: 'Quantity',
    lineCost: 'Unit cost',
    addLine: 'Add line',
    remove: 'Remove',
    total: 'Total',
    createOrder: 'Create purchase order',
    orderLines: 'Lines',
    receive: 'Receive',
    receiving: 'Receiving...',
    received: 'Received',
    supplierRequired: 'Supplier name is required.',
    orderSupplierRequired: 'Choose a supplier.',
    orderLinesRequired: 'Add at least one product line with a quantity of 1 or more.',
    priceInvalid: 'Enter a valid cost.',
    error: 'Could not save',
    saved: 'Saved successfully.',
    statuses: { draft: 'Draft', ordered: 'Ordered', received: 'Received', canceled: 'Canceled' },
    supplierColumns: ['Supplier', 'Contact', 'Phone', 'Status'],
    orderColumns: ['Supplier', 'Status', 'Lines', 'Total', 'Created', ''],
    allProducts: 'Choose product'
  },
  ar: {
    title: 'الموردون والمشتريات',
    suppliers: 'الموردون',
    orders: 'أوامر الشراء',
    addSupplier: 'إضافة مورد',
    supplierName: 'اسم المورد',
    contact: 'مسؤول التواصل',
    phone: 'الهاتف',
    email: 'البريد الإلكتروني',
    address: 'العنوان',
    active: 'نشط',
    save: 'حفظ',
    saving: 'جارٍ الحفظ...',
    cancel: 'إلغاء',
    noSuppliers: 'لا يوجد موردون بعد.',
    noOrders: 'لا توجد أوامر شراء بعد.',
    newOrder: 'أمر شراء جديد',
    supplier: 'المورد',
    status: 'الحالة',
    notes: 'ملاحظات',
    lineProduct: 'المنتج',
    lineQuantity: 'الكمية',
    lineCost: 'سعر الوحدة',
    addLine: 'إضافة سطر',
    remove: 'حذف',
    total: 'الإجمالي',
    createOrder: 'إنشاء أمر شراء',
    orderLines: 'الأسطر',
    receive: 'استلام',
    receiving: 'جارٍ الاستلام...',
    received: 'تم الاستلام',
    supplierRequired: 'اسم المورد مطلوب.',
    orderSupplierRequired: 'اختر مورداً.',
    orderLinesRequired: 'أضف منتجاً واحداً على الأقل بكمية 1 أو أكثر.',
    priceInvalid: 'أدخل تكلفة صحيحة.',
    error: 'تعذر الحفظ',
    saved: 'تم الحفظ بنجاح.',
    statuses: { draft: 'مسودة', ordered: 'مطلوب', received: 'تم الاستلام', canceled: 'ملغى' },
    supplierColumns: ['المورد', 'مسؤول التواصل', 'الهاتف', 'الحالة'],
    orderColumns: ['المورد', 'الحالة', 'الأسطر', 'الإجمالي', 'التاريخ', ''],
    allProducts: 'اختر المنتج'
  }
} as const

interface SupplierForm {
  name: string
  contact: string
  phone: string
  email: string
  address: string
  active: boolean
}

interface OrderLineForm {
  productId: string
  quantity: string
  cost: string
}

const emptySupplier = (): SupplierForm => ({
  name: '',
  contact: '',
  phone: '',
  email: '',
  address: '',
  active: true
})

const emptyLine = (): OrderLineForm => ({ productId: '', quantity: '1', cost: '0.00' })

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function ProcurementPanel({
  products,
  suppliers,
  purchaseOrders,
  language,
  currency,
  onChanged
}: Props) {
  const text = copy[language]
  const [tab, setTab] = useState<'suppliers' | 'orders'>('suppliers')
  const [supplierForm, setSupplierForm] = useState<SupplierForm | null>(null)
  const [orderFormOpen, setOrderFormOpen] = useState(false)
  const [orderSupplier, setOrderSupplier] = useState('')
  const [orderStatus, setOrderStatus] = useState<'draft' | 'ordered'>('draft')
  const [orderNotes, setOrderNotes] = useState('')
  const [orderLines, setOrderLines] = useState<OrderLineForm[]>([emptyLine()])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const productNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const product of products) if (product._id) map.set(product._id, `${product.name} (${product.sku})`)
    return map
  }, [products])

  const supplierNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const supplier of suppliers) if (supplier._id) map.set(supplier._id, supplier.name)
    return map
  }, [suppliers])

  const orderTotal = useMemo(
    () =>
      orderLines.reduce((sum, line) => {
        const cost = parseMoney(line.cost) ?? 0
        const quantity = /^\d+$/.test(line.quantity.trim()) ? Number(line.quantity) : 0
        return sum + cost * quantity
      }, 0),
    [orderLines]
  )

  function resetMessages(): void {
    setError('')
    setSuccess('')
  }

  async function saveSupplier(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!supplierForm) return
    resetMessages()
    const name = supplierForm.name.trim()
    if (!name) return setError(text.supplierRequired)
    setBusy('supplier')
    try {
      await window.api.invSuppliersCreate({
        name,
        contact: supplierForm.contact.trim() || undefined,
        phone: supplierForm.phone.trim() || undefined,
        email: supplierForm.email.trim() || undefined,
        address: supplierForm.address.trim() || undefined,
        active: supplierForm.active
      })
      setSupplierForm(null)
      setSuccess(text.saved)
      onChanged()
    } catch (saveError) {
      setError(`${text.error}: ${message(saveError)}`)
    } finally {
      setBusy('')
    }
  }

  function updateLine(index: number, patch: Partial<OrderLineForm>): void {
    setOrderLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  async function createOrder(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    resetMessages()
    if (!orderSupplier) return setError(text.orderSupplierRequired)
    const lines: PurchaseOrderLine[] = []
    for (const line of orderLines) {
      if (!line.productId) continue
      const quantity = Number(line.quantity)
      if (!Number.isInteger(quantity) || quantity < 1) return setError(text.orderLinesRequired)
      const cost = parseMoney(line.cost)
      if (cost === null) return setError(text.priceInvalid)
      lines.push({ productId: line.productId, quantity, unitCostCents: cost })
    }
    if (lines.length === 0) return setError(text.orderLinesRequired)
    setBusy('order')
    try {
      await window.api.invPOCreate({
        supplierId: orderSupplier,
        status: orderStatus,
        lines,
        notes: orderNotes.trim() || undefined
      })
      setOrderFormOpen(false)
      setOrderSupplier('')
      setOrderStatus('draft')
      setOrderNotes('')
      setOrderLines([emptyLine()])
      setSuccess(text.saved)
      onChanged()
    } catch (createError) {
      setError(`${text.error}: ${message(createError)}`)
    } finally {
      setBusy('')
    }
  }

  async function receiveOrder(order: PurchaseOrder): Promise<void> {
    if (!order._id) return
    resetMessages()
    setBusy(order._id)
    try {
      await window.api.invPOReceive(order._id)
      setSuccess(text.saved)
      onChanged()
    } catch (receiveError) {
      setError(`${text.error}: ${message(receiveError)}`)
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="panel procurement-page" aria-labelledby="procurement-title">
      <div className="section-header">
        <div>
          <h2 id="procurement-title">{text.title}</h2>
        </div>
        <div className="row-actions">
          <button type="button" className={tab === 'suppliers' ? 'primary' : ''} onClick={() => setTab('suppliers')}>
            {text.suppliers}
          </button>
          <button type="button" className={tab === 'orders' ? 'primary' : ''} onClick={() => setTab('orders')}>
            {text.orders}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => (tab === 'suppliers' ? setSupplierForm(emptySupplier()) : setOrderFormOpen(true))}
          >
            {tab === 'suppliers' ? text.addSupplier : text.newOrder}
          </button>
        </div>
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {success ? <p className="success" role="status">{success}</p> : null}

      {tab === 'suppliers' ? (
        <>
          {supplierForm ? (
            <form className="crud-form" onSubmit={saveSupplier}>
              <div className="crud-form-header">
                <h3>{text.addSupplier}</h3>
                <button type="button" className="link-button" onClick={() => setSupplierForm(null)}>
                  {text.cancel}
                </button>
              </div>
              <div className="crud-grid">
                <label className="wide">
                  <span>{text.supplierName}</span>
                  <input
                    value={supplierForm.name}
                    onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })}
                    maxLength={120}
                    required
                  />
                </label>
                <label>
                  <span>{text.contact}</span>
                  <input
                    value={supplierForm.contact}
                    onChange={(event) => setSupplierForm({ ...supplierForm, contact: event.target.value })}
                    maxLength={120}
                  />
                </label>
                <label>
                  <span>{text.phone}</span>
                  <input
                    value={supplierForm.phone}
                    onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })}
                    maxLength={40}
                  />
                </label>
                <label>
                  <span>{text.email}</span>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })}
                    maxLength={120}
                  />
                </label>
                <label className="wide">
                  <span>{text.address}</span>
                  <input
                    value={supplierForm.address}
                    onChange={(event) => setSupplierForm({ ...supplierForm, address: event.target.value })}
                    maxLength={200}
                  />
                </label>
                <label className="checkbox wide">
                  <input
                    type="checkbox"
                    checked={supplierForm.active}
                    onChange={(event) => setSupplierForm({ ...supplierForm, active: event.target.checked })}
                  />
                  <span>{text.active}</span>
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="primary" disabled={busy === 'supplier'}>
                  {busy === 'supplier' ? text.saving : text.save}
                </button>
                <button type="button" onClick={() => setSupplierForm(null)}>
                  {text.cancel}
                </button>
              </div>
            </form>
          ) : null}

          {suppliers.length === 0 ? (
            <div className="empty-state">{text.noSuppliers}</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {text.supplierColumns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier._id ?? supplier.name} className={supplier.active === false ? 'row-muted' : ''}>
                      <td>
                        <strong>{supplier.name}</strong>
                        {supplier.address ? <small className="block-muted">{supplier.address}</small> : null}
                      </td>
                      <td>{supplier.contact || '-'}</td>
                      <td>{supplier.phone || '-'}</td>
                      <td>
                        <span className={`tag ${supplier.active === false ? '' : 'ok-tag'}`}>
                          {supplier.active === false ? '-' : text.active}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {orderFormOpen ? (
            <form className="crud-form" onSubmit={createOrder}>
              <div className="crud-form-header">
                <h3>{text.newOrder}</h3>
                <button type="button" className="link-button" onClick={() => setOrderFormOpen(false)}>
                  {text.cancel}
                </button>
              </div>
              <div className="crud-grid">
                <label>
                  <span>{text.supplier}</span>
                  <select value={orderSupplier} onChange={(event) => setOrderSupplier(event.target.value)} required>
                    <option value="">{text.orderSupplierRequired}</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier._id ?? supplier.name} value={supplier._id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{text.status}</span>
                  <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value as 'draft' | 'ordered')}>
                    <option value="draft">{text.statuses.draft}</option>
                    <option value="ordered">{text.statuses.ordered}</option>
                  </select>
                </label>
                <label className="wide">
                  <span>{text.notes}</span>
                  <input value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} maxLength={200} />
                </label>
              </div>

              <h4>{text.orderLines}</h4>
              <div className="order-lines">
                {orderLines.map((line, index) => (
                  <div className="order-line" key={index}>
                    <label>
                      <span>{text.lineProduct}</span>
                      <select
                        value={line.productId}
                        onChange={(event) => updateLine(index, { productId: event.target.value, cost: productCost(products, event.target.value) })}
                        required
                      >
                        <option value="">{text.allProducts}</option>
                        {products.map((product) => (
                          <option key={product._id ?? product.sku} value={product._id}>
                            {productNames.get(product._id ?? '') ?? product.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{text.lineQuantity}</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={line.quantity}
                        onChange={(event) => updateLine(index, { quantity: event.target.value })}
                        required
                      />
                    </label>
                    <label>
                      <span>{text.lineCost}</span>
                      <input
                        inputMode="decimal"
                        value={line.cost}
                        onChange={(event) => updateLine(index, { cost: event.target.value })}
                        required
                      />
                    </label>
                    <button
                      type="button"
                      className="link-button danger-text"
                      onClick={() => setOrderLines((current) => current.filter((_, i) => i !== index))}
                      disabled={orderLines.length === 1}
                    >
                      {text.remove}
                    </button>
                  </div>
                ))}
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setOrderLines((current) => [...current, emptyLine()])}>
                  {text.addLine}
                </button>
                <span className="tag">
                  {text.total}: {formatMoney(orderTotal, currency)}
                </span>
                <button type="submit" className="primary" disabled={busy === 'order'}>
                  {busy === 'order' ? text.saving : text.createOrder}
                </button>
                <button type="button" onClick={() => setOrderFormOpen(false)}>
                  {text.cancel}
                </button>
              </div>
            </form>
          ) : null}

          {purchaseOrders.length === 0 ? (
            <div className="empty-state">{text.noOrders}</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {text.orderColumns.map((column, index) => (
                      <th key={`${column}-${index}`}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((order) => (
                    <tr key={order._id ?? order.createdAt}>
                      <td>{supplierNames.get(order.supplierId) ?? '-'}</td>
                      <td>
                        <span className={`tag ${order.status === 'received' ? 'ok-tag' : order.status === 'canceled' ? 'danger-tag' : ''}`}>
                          {text.statuses[order.status]}
                        </span>
                      </td>
                      <td>{(order.lines ?? []).length}</td>
                      <td>{formatMoney(order.totalCents, currency)}</td>
                      <td>{formatDateTime(order.createdAt, language)}</td>
                      <td>
                        {order.status !== 'received' && order.status !== 'canceled' ? (
                          <button type="button" onClick={() => void receiveOrder(order)} disabled={busy === order._id}>
                            {busy === order._id ? text.receiving : text.receive}
                          </button>
                        ) : (
                          <span className="muted">{order.status === 'received' ? text.received : '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function productCost(products: Product[], productId: string): string {
  const product = products.find((item) => item._id === productId)
  if (!product) return '0.00'
  return (product.purchaseCostCents / 100).toFixed(2)
}
