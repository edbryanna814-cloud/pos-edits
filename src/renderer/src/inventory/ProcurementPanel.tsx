import { useMemo, useState, type FormEvent } from 'react'
import { confirmDelete, deleteLabel } from '../confirmDelete'
import { useCan } from '../session'
import type { Product, PurchaseOrder, PurchaseReceipt, Supplier } from '../../../shared/inventory'
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
    orders: 'Purchase orders / supply receipts',
    addSupplier: 'Add supplier',
    editSupplier: 'Edit supplier',
    supplierName: 'Supplier name',
    contact: 'Contact person',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    taxInfo: 'Tax info',
    notes: 'Notes',
    active: 'Active',
    archived: 'Archived',
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    noSuppliers: 'No suppliers yet.',
    noOrders: 'No purchase orders yet.',
    newOrder: 'New purchase order',
    editOrder: 'Edit purchase order',
    supplier: 'Supplier',
    status: 'Status',
    orderNo: 'PO no.',
    orderDate: 'Order date',
    expectedDeliveryDate: 'Expected delivery',
    createdBy: 'Created by',
    lineProduct: 'Product',
    lineQuantity: 'Ordered qty',
    receivedQty: 'Received',
    remainingQty: 'Remaining',
    lineCost: 'Unit cost',
    addLine: 'Add line',
    remove: 'Remove',
    total: 'Total',
    createOrder: 'Create purchase order',
    updateOrder: 'Update purchase order',
    orderLines: 'Lines',
    receive: 'Receive goods',
    receiving: 'Receiving...',
    history: 'Receipts',
    noReceipts: 'No supply receipts yet.',
    supplyNo: 'Supply no.',
    receivedAt: 'Received at',
    receivedBy: 'Received by',
    damaged: 'Damaged',
    accepted: 'Accepted',
    receiveQty: 'Receive now',
    damageQty: 'Damaged now',
    receiptNotes: 'Receipt notes',
    confirmReceive: 'Confirm receipt',
    close: 'Close',
    partial: 'Partial receipt allowed.',
    supplierRequired: 'Supplier name is required.',
    orderSupplierRequired: 'Choose a supplier.',
    orderLinesRequired: 'Add at least one product line with a quantity of 1 or more.',
    receiveRequired: 'Enter quantities to receive (accepted quantity must be greater than zero).',
    overReceive: 'Received/damaged quantities exceed remaining quantity.',
    priceInvalid: 'Enter a valid cost.',
    error: 'Could not save',
    saved: 'Saved successfully.',
    receivedMsg: 'Goods received.',
    statuses: {
      draft: 'Draft',
      pending_approval: 'Pending approval',
      approved: 'Approved',
      sent: 'Sent',
      ordered: 'Ordered',
      partially_received: 'Partially received',
      received: 'Received',
      completed: 'Completed',
      canceled: 'Canceled'
    },
    supplierColumns: ['Supplier', 'Contact', 'Phone', 'Status', ''],
    orderColumns: ['PO', 'Supplier', 'Status', 'Lines', 'Ordered/Received', 'Total', 'Created', ''],
    allProducts: 'Choose product'
  },
  ar: {
    title: 'الموردون والمشتريات',
    suppliers: 'الموردون',
    orders: 'أوامر الشراء / استلام البضاعة',
    addSupplier: 'إضافة مورد',
    editSupplier: 'تعديل مورد',
    supplierName: 'اسم المورد',
    contact: 'جهة الاتصال',
    phone: 'الهاتف',
    email: 'البريد الإلكتروني',
    address: 'العنوان',
    taxInfo: 'معلومات ضريبية',
    notes: 'ملاحظات',
    active: 'نشط',
    archived: 'مؤرشف',
    save: 'حفظ',
    saving: 'جارٍ الحفظ...',
    cancel: 'إلغاء',
    noSuppliers: 'لا يوجد موردون بعد.',
    noOrders: 'لا توجد أوامر شراء بعد.',
    newOrder: 'أمر شراء جديد',
    editOrder: 'تعديل أمر الشراء',
    supplier: 'المورد',
    status: 'الحالة',
    orderNo: 'رقم الأمر',
    orderDate: 'تاريخ الأمر',
    expectedDeliveryDate: 'تاريخ التسليم المتوقع',
    createdBy: 'أنشئ بواسطة',
    lineProduct: 'المنتج',
    lineQuantity: 'الكمية المطلوبة',
    receivedQty: 'المستلم',
    remainingQty: 'المتبقي',
    lineCost: 'تكلفة الوحدة',
    addLine: 'إضافة سطر',
    remove: 'إزالة',
    total: 'الإجمالي',
    createOrder: 'إنشاء أمر شراء',
    updateOrder: 'تحديث أمر الشراء',
    orderLines: 'السطور',
    receive: 'استلام بضاعة',
    receiving: 'جارٍ الاستلام...',
    history: 'سندات الاستلام',
    noReceipts: 'لا توجد سندات استلام بعد.',
    supplyNo: 'رقم التوريد',
    receivedAt: 'تاريخ الاستلام',
    receivedBy: 'استلم بواسطة',
    damaged: 'تالف',
    accepted: 'مقبول',
    receiveQty: 'الكمية المستلمة الآن',
    damageQty: 'الكمية التالفة الآن',
    receiptNotes: 'ملاحظات الاستلام',
    confirmReceive: 'تأكيد الاستلام',
    close: 'إغلاق',
    partial: 'يسمح بالاستلام الجزئي.',
    supplierRequired: 'اسم المورد مطلوب.',
    orderSupplierRequired: 'اختر موردًا.',
    orderLinesRequired: 'أضف سطر منتج واحدًا على الأقل بكمية 1 أو أكثر.',
    receiveRequired: 'أدخل كميات للاستلام (يجب أن تكون الكمية المقبولة أكبر من صفر).',
    overReceive: 'الكميات المستلمة/التالفة تتجاوز الكمية المتبقية.',
    priceInvalid: 'أدخل تكلفة صحيحة.',
    error: 'تعذر الحفظ',
    saved: 'تم الحفظ بنجاح.',
    receivedMsg: 'تم استلام البضاعة.',
    statuses: {
      draft: 'مسودة',
      pending_approval: 'بانتظار الاعتماد',
      approved: 'معتمد',
      sent: 'مرسل',
      ordered: 'مطلوب',
      partially_received: 'مستلم جزئيًا',
      received: 'مستلم',
      completed: 'مكتمل',
      canceled: 'ملغى'
    },
    supplierColumns: ['المورد', 'جهة الاتصال', 'الهاتف', 'الحالة', ''],
    orderColumns: ['الأمر', 'المورد', 'الحالة', 'السطور', 'مطلوب/مستلم', 'الإجمالي', 'التاريخ', ''],
    allProducts: 'اختر منتجًا'
  }
} as const

const FINAL = new Set(['received', 'completed', 'canceled'])
const EDITABLE = new Set(['draft', 'pending_approval', 'approved', 'sent', 'ordered', 'partially_received'])

interface SupplierForm {
  name: string
  contact: string
  phone: string
  email: string
  address: string
  taxInfo: string
  notes: string
  active: boolean
}

interface OrderLineForm {
  productId: string
  quantity: string
  cost: string
  receivedQuantity?: number
}

const emptySupplier = (): SupplierForm => ({ name: '', contact: '', phone: '', email: '', address: '', taxInfo: '', notes: '', active: true })
const emptyLine = (): OrderLineForm => ({ productId: '', quantity: '1', cost: '0.00' })

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function ProcurementPanel({ products, suppliers, purchaseOrders, language, currency, onChanged }: Props) {
  const text = copy[language]
  const canDelete = useCan('catalog.delete')
  const [tab, setTab] = useState<'suppliers' | 'orders'>('suppliers')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [supplierFormOpen, setSupplierFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplier())
  const [orderFormOpen, setOrderFormOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null)
  const [orderSupplier, setOrderSupplier] = useState('')
  const [orderStatus, setOrderStatus] = useState<PurchaseOrder['status']>('draft')
  const [orderNotes, setOrderNotes] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [orderLines, setOrderLines] = useState<OrderLineForm[]>([emptyLine()])
  const [receiveOrderId, setReceiveOrderId] = useState<string | null>(null)
  const [receiveInputs, setReceiveInputs] = useState<Record<string, { receive: string; damaged: string }>>({})
  const [receiveNotes, setReceiveNotes] = useState('')
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null)
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([])

  const supplierNames = useMemo(() => new Map(suppliers.map((s) => [s._id ?? '', s.name])), [suppliers])
  const productNames = useMemo(() => new Map(products.map((p) => [p._id ?? '', `${p.name} (${p.sku})`])), [products])

  const orderTotal = useMemo(
    () => orderLines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0) * (parseMoney(line.cost) ?? 0), 0),
    [orderLines]
  )

  function openSupplierCreate() {
    setEditingSupplier(null); setSupplierForm(emptySupplier()); setSupplierFormOpen(true); setError(''); setSuccess('')
  }
  function openSupplierEdit(s: Supplier) {
    setEditingSupplier(s)
    setSupplierForm({ name: s.name, contact: s.contact ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', taxInfo: s.taxInfo ?? '', notes: s.notes ?? '', active: s.active !== false })
    setSupplierFormOpen(true); setError(''); setSuccess('')
  }

  async function saveSupplier(event: FormEvent) {
    event.preventDefault()
    if (!supplierForm.name.trim()) return setError(text.supplierRequired)
    setBusy('supplier'); setError(''); setSuccess('')
    try {
      const input = {
        name: supplierForm.name.trim(),
        contact: supplierForm.contact.trim() || undefined,
        phone: supplierForm.phone.trim() || undefined,
        email: supplierForm.email.trim() || undefined,
        address: supplierForm.address.trim() || undefined,
        taxInfo: supplierForm.taxInfo.trim() || undefined,
        notes: supplierForm.notes.trim() || undefined,
        active: supplierForm.active
      }
      if (editingSupplier?._id) await window.api.invSuppliersUpdate(editingSupplier._id, input)
      else await window.api.invSuppliersCreate(input)
      setSupplierFormOpen(false); setEditingSupplier(null); setSuccess(text.saved); onChanged()
    } catch (e) { setError(`${text.error}: ${message(e)}`) } finally { setBusy(null) }
  }

  async function archiveSupplier(s: Supplier) {
    setError(''); setSuccess('')
    const err = await confirmDelete(language, s.name, () => window.api.invSuppliersDelete(s._id as string), onChanged)
    if (err) setError(err)
    else setSuccess(text.saved)
  }

  function openOrderCreate() {
    setEditingOrder(null); setOrderSupplier(''); setOrderStatus('draft'); setOrderNotes(''); setOrderDate(new Date().toISOString().slice(0, 10)); setExpectedDeliveryDate(''); setOrderLines([emptyLine()]); setOrderFormOpen(true); setError(''); setSuccess('')
  }
  function openOrderEdit(o: PurchaseOrder) {
    setEditingOrder(o); setOrderSupplier(o.supplierId); setOrderStatus(o.status); setOrderNotes(o.notes ?? ''); setOrderDate((o.orderDate ?? o.createdAt ?? '').slice(0, 10)); setExpectedDeliveryDate(o.expectedDeliveryDate ?? '')
    setOrderLines((o.lines ?? []).map((l) => ({ productId: l.productId, quantity: String(l.quantity), cost: ((l.unitCostCents ?? 0) / 100).toFixed(2), receivedQuantity: l.receivedQuantity ?? 0 })))
    setOrderFormOpen(true); setError(''); setSuccess('')
  }

  function updateLine(index: number, patch: Partial<OrderLineForm>) {
    setOrderLines((cur) => cur.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  async function saveOrder(event: FormEvent) {
    event.preventDefault()
    if (!orderSupplier) return setError(text.orderSupplierRequired)
    const lines = orderLines
      .map((l) => ({ productId: l.productId, quantity: Math.max(0, Number(l.quantity) || 0), unitCostCents: parseMoney(l.cost) }))
      .filter((l) => l.productId && l.quantity >= 1)
    if (lines.length === 0 || lines.some((l) => l.unitCostCents === null)) return setError(text.orderLinesRequired)
    setBusy('order'); setError(''); setSuccess('')
    try {
      const input = {
        supplierId: orderSupplier,
        status: orderStatus,
        orderDate: orderDate || undefined,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        notes: orderNotes.trim() || undefined,
        lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCostCents: l.unitCostCents as number }))
      }
      if (editingOrder?._id) await window.api.invPOUpdate(editingOrder._id, input)
      else await window.api.invPOCreate(input)
      setOrderFormOpen(false); setEditingOrder(null); setSuccess(text.saved); onChanged()
    } catch (e) { setError(`${text.error}: ${message(e)}`) } finally { setBusy(null) }
  }

  function openReceive(order: PurchaseOrder) {
    const init: Record<string, { receive: string; damaged: string }> = {}
    for (const l of order.lines ?? []) {
      const rem = Math.max(0, l.quantity - (l.receivedQuantity ?? 0))
      init[l.productId] = { receive: rem ? String(rem) : '0', damaged: '0' }
    }
    setReceiveInputs(init); setReceiveNotes(''); setReceiveOrderId(order._id ?? null); setError(''); setSuccess('')
  }

  async function confirmReceive() {
    if (!receiveOrderId) return
    const order = purchaseOrders.find((o) => o._id === receiveOrderId)
    if (!order) return
    const lines = (order.lines ?? []).map((l) => {
      const v = receiveInputs[l.productId] ?? { receive: '0', damaged: '0' }
      return { productId: l.productId, receivedQuantity: Math.max(0, Number(v.receive) || 0), damagedQuantity: Math.max(0, Number(v.damaged) || 0) }
    })
    const any = lines.some((l) => l.receivedQuantity > 0)
    if (!any) return setError(text.receiveRequired)
    if (lines.some((l) => l.damagedQuantity > l.receivedQuantity)) return setError(text.overReceive)
    for (const l of order.lines ?? []) {
      const rem = Math.max(0, l.quantity - (l.receivedQuantity ?? 0))
      const sub = lines.find((x) => x.productId === l.productId)
      const accepted = (sub?.receivedQuantity ?? 0) - (sub?.damagedQuantity ?? 0)
      if (accepted > rem || (sub?.receivedQuantity ?? 0) > rem) return setError(text.overReceive)
    }
    setBusy(receiveOrderId); setError(''); setSuccess('')
    try {
      await window.api.invPOReceive(receiveOrderId, { lines, notes: receiveNotes.trim() || undefined })
      setReceiveOrderId(null); setSuccess(text.receivedMsg); onChanged()
    } catch (e) { setError(`${text.error}: ${message(e)}`) } finally { setBusy(null) }
  }

  async function openHistory(orderId: string) {
    setHistoryOrderId(orderId); setReceipts([])
    try { setReceipts(await window.api.invPOReceiptsList(orderId)) } catch (e) { setError(message(e)) }
  }

  const receiveOrder = receiveOrderId ? purchaseOrders.find((o) => o._id === receiveOrderId) : null

  return (
    <section className="panel">
      <div className="section-header">
        <h2>{text.title}</h2>
        <div className="tab-row">
          <button type="button" className={tab === 'suppliers' ? 'tab active' : 'tab'} onClick={() => setTab('suppliers')}>{text.suppliers}</button>
          <button type="button" className={tab === 'orders' ? 'tab active' : 'tab'} onClick={() => setTab('orders')}>{text.orders}</button>
        </div>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {success ? <p className="success" role="status">{success}</p> : null}

      {tab === 'suppliers' ? (
        <>
          <div className="section-header"><span /><button type="button" className="primary" onClick={openSupplierCreate}>{text.addSupplier}</button></div>
          {supplierFormOpen ? (
            <form className="crud-form" onSubmit={saveSupplier}>
              <h3>{editingSupplier ? text.editSupplier : text.addSupplier}</h3>
              <div className="crud-grid">
                <label><span>{text.supplierName}</span><input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} required maxLength={120} /></label>
                <label><span>{text.contact}</span><input value={supplierForm.contact} onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })} maxLength={120} /></label>
                <label><span>{text.phone}</span><input dir="ltr" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} maxLength={30} /></label>
                <label><span>{text.email}</span><input dir="ltr" type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} maxLength={120} /></label>
                <label><span>{text.address}</span><input value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} maxLength={240} /></label>
                <label><span>{text.taxInfo}</span><input value={supplierForm.taxInfo} onChange={(e) => setSupplierForm({ ...supplierForm, taxInfo: e.target.value })} maxLength={120} /></label>
                <label className="wide"><span>{text.notes}</span><input value={supplierForm.notes} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} maxLength={500} /></label>
                <label className="checkbox-field"><input type="checkbox" checked={supplierForm.active} onChange={(e) => setSupplierForm({ ...supplierForm, active: e.target.checked })} /><span>{text.active}</span></label>
              </div>
              <div className="form-actions">
                <button type="submit" className="primary" disabled={busy === 'supplier'}>{busy === 'supplier' ? text.saving : text.save}</button>
                <button type="button" onClick={() => { setSupplierFormOpen(false); setEditingSupplier(null) }}>{text.cancel}</button>
              </div>
            </form>
          ) : null}
          {suppliers.length === 0 ? <div className="empty-state">{text.noSuppliers}</div> : (
            <div className="table-wrap"><table className="data-table"><thead><tr>{text.supplierColumns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>
              {suppliers.map((s) => (
                <tr key={s._id ?? s.name}>
                  <td>{s.name}</td><td>{s.contact || '-'}</td><td dir="ltr">{s.phone || '-'}</td>
                  <td><span className={`tag ${s.active === false ? '' : 'ok-tag'}`}>{s.active === false ? text.archived : text.active}</span></td>
                  <td>
                    <button type="button" onClick={() => openSupplierEdit(s)}>{text.editSupplier}</button>
                    {s.active !== false && canDelete ? <button type="button" className="danger-text" onClick={() => void archiveSupplier(s)}>{deleteLabel(language)}</button> : null}
                  </td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </>
      ) : (
        <>
          <div className="section-header"><span /><button type="button" className="primary" onClick={openOrderCreate}>{text.newOrder}</button></div>
          {orderFormOpen ? (
            <form className="crud-form" onSubmit={saveOrder}>
              <h3>{editingOrder ? text.editOrder : text.newOrder}</h3>
              <div className="crud-grid">
                <label><span>{text.supplier}</span><select value={orderSupplier} onChange={(e) => setOrderSupplier(e.target.value)} required><option value="">{text.orderSupplierRequired}</option>{suppliers.filter((s) => s.active !== false || s._id === orderSupplier).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label>
                <label><span>{text.status}</span><select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value as PurchaseOrder['status'])}>{(Object.keys(text.statuses) as Array<keyof typeof text.statuses>).map((k) => <option key={k} value={k}>{text.statuses[k]}</option>)}</select></label>
                <label><span>{text.orderDate}</span><input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></label>
                <label><span>{text.expectedDeliveryDate}</span><input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} /></label>
                <label className="wide"><span>{text.notes}</span><input value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} maxLength={500} /></label>
              </div>
              <h4>{text.orderLines}</h4>
              <div className="order-lines">
                {orderLines.map((line, i) => (
                  <div className="order-line" key={i}>
                    <label><span>{text.lineProduct}</span><select value={line.productId} onChange={(e) => { const p = products.find((x) => x._id === e.target.value); updateLine(i, { productId: e.target.value, cost: p ? ((p.purchaseCostCents ?? 0) / 100).toFixed(2) : line.cost }) }} required><option value="">{text.allProducts}</option>{products.map((p) => <option key={p._id} value={p._id}>{productNames.get(p._id ?? '') ?? p.name}</option>)}</select></label>
                    <label><span>{text.lineQuantity}</span><input type="number" min={1} step={1} value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} required /></label>
                    <label><span>{text.lineCost}</span><input inputMode="decimal" value={line.cost} onChange={(e) => updateLine(i, { cost: e.target.value })} required /></label>
                    {line.receivedQuantity ? <span className="muted">{text.receivedQty}: {line.receivedQuantity}</span> : null}
                    <button type="button" className="link-button danger-text" onClick={() => setOrderLines((cur) => cur.filter((_, j) => j !== i))} disabled={orderLines.length === 1}>{text.remove}</button>
                  </div>
                ))}
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setOrderLines((cur) => [...cur, emptyLine()])}>{text.addLine}</button>
                <span className="tag">{text.total}: {formatMoney(orderTotal, currency)}</span>
                <button type="submit" className="primary" disabled={busy === 'order'}>{busy === 'order' ? text.saving : editingOrder ? text.updateOrder : text.createOrder}</button>
                <button type="button" onClick={() => { setOrderFormOpen(false); setEditingOrder(null) }}>{text.cancel}</button>
              </div>
            </form>
          ) : null}

          {receiveOrder ? (
            <div className="crud-form">
              <h3>{text.receive}: {receiveOrder.orderNo ?? receiveOrder._id?.slice(-6)}</h3>
              <p className="muted">{text.partial}</p>
              <div className="table-wrap"><table className="data-table"><thead><tr><th>{text.lineProduct}</th><th>{text.lineQuantity}</th><th>{text.receivedQty}</th><th>{text.remainingQty}</th><th>{text.receiveQty}</th><th>{text.damageQty}</th></tr></thead><tbody>
                {(receiveOrder.lines ?? []).map((l) => {
                  const rem = Math.max(0, l.quantity - (l.receivedQuantity ?? 0))
                  const v = receiveInputs[l.productId] ?? { receive: '0', damaged: '0' }
                  return <tr key={l.productId}><td>{productNames.get(l.productId) ?? l.productId}</td><td>{l.quantity}</td><td>{l.receivedQuantity ?? 0}</td><td>{rem}</td><td><input type="number" min={0} max={rem} step={1} value={v.receive} disabled={rem === 0} onChange={(e) => setReceiveInputs((c) => ({ ...c, [l.productId]: { ...c[l.productId], receive: e.target.value } }))} /></td><td><input type="number" min={0} max={Number(v.receive) || 0} step={1} value={v.damaged} disabled={rem === 0} onChange={(e) => setReceiveInputs((c) => ({ ...c, [l.productId]: { ...c[l.productId], damaged: e.target.value } }))} /></td></tr>
                })}
              </tbody></table></div>
              <label className="wide"><span>{text.receiptNotes}</span><input value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)} maxLength={500} /></label>
              <div className="form-actions">
                <button type="button" className="primary" onClick={() => void confirmReceive()} disabled={busy === receiveOrderId}>{busy === receiveOrderId ? text.receiving : text.confirmReceive}</button>
                <button type="button" onClick={() => setReceiveOrderId(null)}>{text.cancel}</button>
              </div>
            </div>
          ) : null}

          {historyOrderId ? (
            <div className="crud-form">
              <h3>{text.history}</h3>
              {receipts.length === 0 ? <p className="muted">{text.noReceipts}</p> : receipts.map((r) => (
                <div key={r._id} className="panel inline-panel">
                  <p><strong>{r.supplyNo ?? r._id?.slice(-6)}</strong> - {formatDateTime(r.receivedAt, language)} {r.receivedBy ? `- ${text.receivedBy}: ${r.receivedBy}` : ''}</p>
                  <ul>{(r.lines ?? []).map((l, i) => <li key={i}>{productNames.get(l.productId) ?? l.productId}: {text.accepted} {l.quantity}{l.damagedQuantity ? `, ${text.damaged} ${l.damagedQuantity}` : ''}{l.remainingQuantity !== undefined ? `, ${text.remainingQty} ${l.remainingQuantity}` : ''}</li>)}</ul>
                  {r.notes ? <p className="muted">{r.notes}</p> : null}
                </div>
              ))}
              <div className="form-actions"><button type="button" onClick={() => setHistoryOrderId(null)}>{text.close}</button></div>
            </div>
          ) : null}

          {purchaseOrders.length === 0 ? <div className="empty-state">{text.noOrders}</div> : (
            <div className="table-wrap"><table className="data-table"><thead><tr>{text.orderColumns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>
              {purchaseOrders.map((o) => {
                const ordered = (o.lines ?? []).reduce((s, l) => s + l.quantity, 0)
                const received = (o.lines ?? []).reduce((s, l) => s + (l.receivedQuantity ?? 0), 0)
                return (
                  <tr key={o._id ?? o.createdAt}>
                    <td>{o.orderNo ?? o._id?.slice(-6) ?? '-'}</td>
                    <td>{supplierNames.get(o.supplierId) ?? '-'}</td>
                    <td><span className={`tag ${o.status === 'received' || o.status === 'completed' ? 'ok-tag' : o.status === 'canceled' ? 'danger-tag' : ''}`}>{text.statuses[o.status] ?? o.status}</span></td>
                    <td>{(o.lines ?? []).length}</td>
                    <td>{ordered} / {received}</td>
                    <td>{formatMoney(o.totalCents, currency)}</td>
                    <td>{formatDateTime(o.orderDate ?? o.createdAt, language)}</td>
                    <td>
                      {EDITABLE.has(o.status) ? <button type="button" onClick={() => openOrderEdit(o)}>{text.editOrder}</button> : null}
                      {!FINAL.has(o.status) ? <button type="button" onClick={() => openReceive(o)}>{text.receive}</button> : null}
                      <button type="button" className="link-button" onClick={() => void openHistory(o._id as string)}>{text.history}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody></table></div>
          )}
        </>
      )}
    </section>
  )
}
