import { useEffect, useMemo, useRef, useState } from 'react'
import { ExportButton, RecordId } from '../session'
import ReturnablePanel, { returnErrorText } from './ReturnablePanel'
import type { Customer } from '../../../shared/customers'
import CustomerPicker from './CustomerPicker'
import { percentText } from '../customers/CustomersPage'
import { packOf, saleUnits, stockLevel, unitPrice, unitSize, type SaleUnit } from '../../../shared/packaging'
import { stockText, UNIT_NAMES } from '../units'
import type { CashboxMovement, Sale } from '../../../shared/pos'
import type { Product } from '../../../shared/inventory'
import type { Language } from '../../../shared/settings'
import { formatDateTime, formatMoney, parseMoney } from '../money'

interface Props {
  products: Product[]
  sales: Sale[]
  cashbox: CashboxMovement[]
  language: Language
  currency: string
  taxRateBasisPoints: number
  cashier: string
  companyName: string
  onChanged: () => void
}

const copy = {
  en: {
    title: 'Point of sale',
    intro: 'Search, add to cart, and complete the sale.',
    search: 'Search name, SKU, or barcode',
    cart: 'Cart',
    emptyCart: 'Cart is empty',
    emptyCartHint: 'Choose a product to start a sale.',
    noProducts: 'No products found',
    noProductsHint: 'Add products from the Inventory page first.',
    expired: 'Expired',
    expiredError: 'This product is expired and cannot be sold.',
    outOfStock: 'Out of stock',
    low: 'Low stock',
    quantity: 'Qty',
    strip: 'Strip',
    box: 'Box',
    boxPriceMissing: 'Box price is not set for this product.',
    remove: 'Remove',
    subtotal: 'Subtotal',
    discount: 'Discount',
    discountPercent: 'Discount (%)',
    tax: 'Tax',
    total: 'Total',
    paymentMethod: 'Payment method',
    cash: 'Cash',
    card: 'Card',
    other: 'Other',
    paid: 'Paid amount (leave empty for exact)',
    paidReceipt: 'Paid amount',
    change: 'Change',
    checkout: 'Complete sale',
    processing: 'Completing...',
    clear: 'Clear cart',
    receipt: 'Receipt',
    invoice: 'Invoice',
    date: 'Date',
    cashierLabel: 'Cashier',
    newSale: 'New sale',
    print: 'Print',
    recentSales: 'Recent sales',
    noSales: 'No sales yet.',
    returnLabel: 'Return',
    returnTitle: 'Return invoice',
    returnReason: 'Return reason',
    confirmReturn: 'Confirm return',
    cancel: 'Cancel',
    returned: 'Invoice returned.',
    cashbox: 'Cashbox',
    cashboxBalance: 'Balance',
    cashIn: 'Cash in',
    cashOut: 'Cash out',
    amount: 'Amount',
    reason: 'Reason',
    apply: 'Apply',
    noCashbox: 'No cashbox movements yet.',
    cartEmptyError: 'Add at least one product to the cart.',
    discountError: 'Enter a discount from 0 to 100%.',
    discountTooBig: 'Discount cannot exceed the subtotal.',
    paidError: 'Enter a valid paid amount.',
    paidTooLow: 'Paid amount is less than the total.',
    checkoutError: 'Could not complete the sale',
    returnError: 'Could not return the invoice',
    returnReasonError: 'Enter a reason for the return.',
    cashError: 'Enter a valid amount.',
    cashReasonError: 'Enter a reason.',
    cashboxError: 'Could not record the cashbox movement.',
    units: ['Invoice', 'Date', 'Total', 'Status', ''],
    status: { completed: 'Completed', returned: 'Returned', void: 'Void' },
    cashTypes: { in: 'Cash in', out: 'Cash out', sale: 'Sale', refund: 'Refund' }
  },
  ar: {
    title: 'نقطة البيع',
    intro: 'ابحث، أضف إلى السلة، وأتمم عملية البيع.',
    search: 'ابحث بالاسم أو الكود أو الباركود',
    cart: 'سلة البيع',
    emptyCart: 'السلة فارغة',
    emptyCartHint: 'اختر منتجًا لبدء عملية البيع.',
    noProducts: 'لا توجد منتجات مطابقة',
    noProductsHint: 'أضف منتجات من صفحة المخزون أولًا.',
    expired: 'منتهي الصلاحية',
    expiredError: 'هذا المنتج منتهي الصلاحية ولا يمكن بيعه.',
    outOfStock: 'نفد المخزون',
    low: 'منخفض',
    quantity: 'الكمية',
    strip: 'شريط',
    box: 'علبة',
    boxPriceMissing: 'سعر العلبة غير محدد لهذا المنتج.',
    remove: 'حذف',
    subtotal: 'الإجمالي الفرعي',
    discount: 'الخصم',
    discountPercent: 'الخصم (%)',
    tax: 'الضريبة',
    total: 'الإجمالي',
    paymentMethod: 'طريقة الدفع',
    cash: 'نقدًا',
    card: 'بطاقة',
    other: 'أخرى',
    paid: 'المبلغ المدفوع (اتركه فارغًا للمبلغ بالضبط)',
    paidReceipt: 'المبلغ المدفوع',
    change: 'الباقي',
    checkout: 'إتمام البيع',
    processing: 'جارٍ إتمام البيع...',
    clear: 'تفريغ السلة',
    receipt: 'الفاتورة',
    invoice: 'رقم الفاتورة',
    date: 'التاريخ',
    cashierLabel: 'الكاشير',
    newSale: 'بيع جديد',
    print: 'طباعة',
    recentSales: 'أحدث المبيعات',
    noSales: 'لا توجد مبيعات بعد.',
    returnLabel: 'مرتجع',
    returnTitle: 'إرجاع الفاتورة',
    returnReason: 'سبب الإرجاع',
    confirmReturn: 'تأكيد الإرجاع',
    cancel: 'إلغاء',
    returned: 'تم إرجاع الفاتورة.',
    cashbox: 'الصندوق',
    cashboxBalance: 'الرصيد',
    cashIn: 'إيداع',
    cashOut: 'سحب',
    amount: 'المبلغ',
    reason: 'السبب',
    apply: 'تنفيذ',
    noCashbox: 'لا توجد حركات صندوق بعد.',
    cartEmptyError: 'أضف منتجًا واحدًا على الأقل إلى السلة.',
    discountError: 'أدخل خصمًا من 0 إلى 100%.',
    discountTooBig: 'لا يمكن أن يتجاوز الخصم الإجمالي الفرعي.',
    paidError: 'أدخل مبلغًا مدفوعًا صحيحًا.',
    paidTooLow: 'المبلغ المدفوع أقل من الإجمالي.',
    checkoutError: 'تعذّر إتمام البيع',
    returnError: 'تعذّر إرجاع الفاتورة',
    returnReasonError: 'أدخل سبب الإرجاع.',
    cashError: 'أدخل مبلغًا صحيحًا.',
    cashReasonError: 'أدخل السبب.',
    cashboxError: 'تعذّر تسجيل حركة الصندوق.',
    units: ['الفاتورة', 'التاريخ', 'الإجمالي', 'الحالة', ''],
    status: { completed: 'مكتملة', returned: 'مرتجعة', void: 'ملغاة' },
    cashTypes: { in: 'إيداع', out: 'سحب', sale: 'بيع', refund: 'استرداد' }
  }
} as const

interface CartItem {
  productId: string
  quantity: number
  unit: SaleUnit
}

/** Stock units (smallest counted unit) this cart line takes. */
function baseOf(item: CartItem, product: Product | undefined): number {
  return product ? item.quantity * unitSize(product, item.unit) : item.quantity
}

/** A scan or a tap on the product sells its own unit (a box for boxed medicine). */
const ownUnit = (product: Product): SaleUnit => packOf(product).packaging

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isExpired(expiryDate: string | undefined): boolean {
  if (!expiryDate) return false
  const end = new Date(`${expiryDate.slice(0, 10)}T23:59:59`)
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now()
}

function newRequestId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined
  return cryptoApi?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** "12.5" → 1250 basis points; null when not a number from 0 to 100 with at most 2 decimals. */
function percentToBasisPoints(value: string): number | null {
  const text = value.trim().replace(',', '.')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null
  const bp = Math.round(Number(text) * 100)
  return bp <= 10000 ? bp : null
}

export default function PosPage({
  products,
  sales,
  cashbox,
  language,
  currency,
  taxRateBasisPoints,
  cashier,
  companyName,
  onChanged
}: Props) {
  const text = copy[language]
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountInput, setDiscountInput] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  /** Choosing a customer fills in their discount; the seller may still change it. */
  function chooseCustomer(next: Customer | null): void {
    setCustomer(next)
    setDiscountInput(next ? percentText(next.discountBasisPoints) : '')
  }
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'other'>('cash')
  const [paidInput, setPaidInput] = useState('')
  const [receipt, setReceipt] = useState<Sale | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [returnSale, setReturnSale] = useState<Sale | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [returnBusy, setReturnBusy] = useState(false)
  const [cashAmount, setCashAmount] = useState('')
  const [cashReason, setCashReason] = useState('')
  const [cashBusy, setCashBusy] = useState(false)
  const requestIdRef = useRef<string | null>(null)

  const byId = useMemo(() => {
    const map = new Map<string, Product>()
    for (const product of products) if (product._id) map.set(product._id, product)
    return map
  }, [products])

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return products
      .filter((product) => product.active !== false)
      .filter((product) => !isExpired(product.expiryDate))
      .filter((product) => (product.stockQuantity || 0) > 0)
      .filter((product) =>
        needle
          ? [product.name, product.sku, product.barcode ?? ''].some((value) =>
              value.toLowerCase().includes(needle)
            )
          : true
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 60)
  }, [products, query])

  const cartLines = useMemo(
    () =>
      cart.flatMap((item) => {
        const product = byId.get(item.productId)
        if (!product) return []
        const unitPriceCents = unitPrice(product, item.unit)
        return [
          {
            ...item,
            product,
            unitPriceCents,
            lineTotalCents: unitPriceCents * item.quantity
          }
        ]
      }),
    [cart, byId]
  )

  const subtotalCents = cartLines.reduce((sum, line) => sum + line.lineTotalCents, 0)
  const discountBasisPoints = discountInput.trim() ? percentToBasisPoints(discountInput) : 0
  // Same rounding as the server (src/main/pos.ts), which recomputes it.
  const safeDiscountCents = Math.round((subtotalCents * (discountBasisPoints ?? 0)) / 10000)
  const taxableCents = subtotalCents - safeDiscountCents
  const taxBasisPoints = Math.max(0, Math.min(10000, Math.round(Number(taxRateBasisPoints) || 0)))
  const taxCents = Math.round((taxableCents * taxBasisPoints) / 10000)
  const totalCents = taxableCents + taxCents
  const paidCents = paidInput.trim() ? parseMoney(paidInput) : totalCents
  const changeCents = (paidCents ?? 0) - totalCents
  const taxPercent = (taxBasisPoints / 100).toFixed(2)
  const cashboxBalance = cashbox.reduce((sum, movement) => sum + movement.amountCents, 0)

  useEffect(() => {
    requestIdRef.current = null
  }, [cart, discountInput, paymentMethod])

  useEffect(() => {
    let buffer = ''
    let last = 0
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      const now = Date.now()
      if (now - last > 120) buffer = ''
      last = now
      if (event.key === 'Enter') {
        const code = buffer.trim()
        buffer = ''
        if (code.length < 4) return
        const match = products.find((product) => product.barcode === code)
        if (match) {
          event.preventDefault()
          addProductRef.current(match)
          setQuery('')
        }
        return
      }
      if (event.key.length === 1) buffer += event.key
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [products])

  function addProduct(product: Product, unit: SaleUnit = ownUnit(product)): void {
    if (!product._id || product.stockQuantity <= 0) return
    if (isExpired(product.expiryDate)) {
      setError(`${text.expiredError} ${product.name}`)
      return
    }
    if (!saleUnits(product).includes(unit) || unitPrice(product, unit) <= 0) {
      setError(`${text.boxPriceMissing} ${product.name}`)
      return
    }
    const addBase = unitSize(product, unit)
    const reserved = cart.reduce(
      (sum, item) =>
        sum + (item.productId === product._id ? baseOf(item, product) : 0),
      0
    )
    if (reserved + addBase > product.stockQuantity) {
      setError(`${text.outOfStock}: ${product.name}`)
      return
    }
    setError('')
    setSuccess('')
    const existing = cart.find((item) => item.productId === product._id && item.unit === unit)
    if (existing) {
      setCart((current) =>
        current.map((item) =>
          item.productId === product._id && item.unit === unit
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      )
    } else {
      setCart((current) => [
        ...current,
        { productId: product._id as string, quantity: 1, unit }
      ])
    }
  }

  const addProductRef = useRef(addProduct)
  addProductRef.current = addProduct

  function setQuantity(productId: string, unit: SaleUnit, value: string): void {
    const product = byId.get(productId)
    if (!product) return
    const parsed = Number(value)
    const pool = Math.max(1, Math.trunc(parsed) || 1)
    const pack = unitSize(product, unit)
    const reservedElsewhere = cart.reduce(
      (sum, item) =>
        sum +
        (item.productId === productId && item.unit !== unit ? baseOf(item, product) : 0),
      0
    )
    const maxPacks = Math.max(1, Math.floor((product.stockQuantity - reservedElsewhere) / pack))
    const clamped = Math.max(1, Math.min(maxPacks, pool))
    setCart((current) =>
      current.map((item) =>
        item.productId === productId && item.unit === unit ? { ...item, quantity: clamped } : item
      )
    )
  }

  function removeLine(productId: string, unit: SaleUnit): void {
    setCart((current) => current.filter((item) => !(item.productId === productId && item.unit === unit)))
  }

  function clearCart(): void {
    setCart([])
    setCustomer(null)
    setDiscountInput('')
    setPaidInput('')
    setError('')
    requestIdRef.current = null
  }

  async function handleCheckout(): Promise<void> {
    setError('')
    setSuccess('')
    if (cartLines.length === 0) return setError(text.cartEmptyError)
    if (discountBasisPoints === null) return setError(text.discountError)
    if (paidCents === null) return setError(text.paidError)
    if (paidCents < totalCents) return setError(text.paidTooLow)

    setBusy(true)
    try {
      if (!requestIdRef.current) requestIdRef.current = newRequestId()
      const sale = await window.api.posCheckout({
        clientRequestId: requestIdRef.current,
        lines: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          saleUnit: item.unit
        })),
        discountBasisPoints: discountBasisPoints ?? 0,
        ...(customer?._id ? { customerId: customer._id } : {}),
        taxCents,
        paymentMethod,
        paidCents
      })
      setReceipt(sale)
      setCart([])
      setCustomer(null)
      setDiscountInput('')
      setPaidInput('')
      requestIdRef.current = null
      onChanged()
    } catch (checkoutError) {
      setError(`${text.checkoutError}: ${errorText(checkoutError)}`)
    } finally {
      setBusy(false)
    }
  }

  async function confirmReturn(): Promise<void> {
    if (!returnSale?._id) return
    const reason = returnReason.trim()
    if (!reason) return setError(text.returnReasonError)
    setReturnBusy(true)
    setError('')
    setSuccess('')
    try {
      await window.api.posReturn({ saleId: returnSale._id, reason })
      setReturnSale(null)
      setReturnReason('')
      setSuccess(text.returned)
      onChanged()
    } catch (returnError) {
      setError(returnErrorText(language, returnError) ?? `${text.returnError}: ${errorText(returnError)}`)
    } finally {
      setReturnBusy(false)
    }
  }

  async function moveCash(type: 'in' | 'out'): Promise<void> {
    const amount = parseMoney(cashAmount)
    if (amount === null || amount <= 0) return setError(text.cashError)
    const reason = cashReason.trim()
    if (!reason) return setError(text.cashReasonError)
    setCashBusy(true)
    setError('')
    setSuccess('')
    try {
      if (type === 'in') await window.api.posCashIn(amount, reason)
      else await window.api.posCashOut(amount, reason)
      setCashAmount('')
      setCashReason('')
      onChanged()
    } catch (cashError) {
      setError(`${text.cashboxError}: ${errorText(cashError)}`)
    } finally {
      setCashBusy(false)
    }
  }

  return (
    <section className="pos-page" aria-labelledby="pos-title">
      <div className="section-header">
        <div>
          <h2 id="pos-title">{text.title}</h2>
          <p className="muted">{text.intro}</p>
        </div>
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {success ? <p className="success" role="status">{success}</p> : null}

      {receipt ? (
        <section className="panel receipt-panel">
          <div className="receipt-panel-header">
            <h3>{text.receipt}</h3>
            <div className="row-actions">
              <button type="button" onClick={() => window.print()}>
                {text.print}
              </button>
              <button type="button" className="primary" onClick={() => setReceipt(null)}>
                {text.newSale}
              </button>
            </div>
          </div>
          <div className="receipt-brand">
            <strong>{companyName}</strong>
          </div>
          <div className="receipt-meta">
            <div>
              <span>{text.invoice}</span>
              <strong>{receipt.invoiceNo}</strong>
            </div>
            {receipt.customerName ? (
              <div>
                <span>{language === 'ar' ? 'العميل' : 'Customer'}</span>
                <strong>{receipt.customerName}</strong>
              </div>
            ) : null}
            <div>
              <span>{text.date}</span>
              <strong>{formatDateTime(receipt.createdAt, language)}</strong>
            </div>
            <div>
              <span>{text.cashierLabel}</span>
              <strong>{receipt.cashierUsername ?? cashier}</strong>
            </div>
          </div>
          <table className="data-table compact">
            <thead>
              <tr>
                <th>{text.quantity}</th>
                <th>{text.total}</th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.map((line) => (
                <tr key={line.productId}>
                  <td>
                    {line.productName} × {line.quantity}
                    {line.saleUnit && line.saleUnit !== 'base' ? ` ${UNIT_NAMES[language][line.saleUnit]}` : ''}
                  </td>
                  <td>{formatMoney(line.lineTotalCents, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="totals-list">
            <div>
              <dt>{text.subtotal}</dt>
              <dd>{formatMoney(receipt.subtotalCents, currency)}</dd>
            </div>
            <div>
              <dt>{text.discount}</dt>
              <dd>{formatMoney(receipt.discountCents, currency)}</dd>
            </div>
            {receipt.taxCents > 0 ? (
              <div>
                <dt>
                  {text.tax} ({taxPercent}%)
                </dt>
                <dd>{formatMoney(receipt.taxCents, currency)}</dd>
              </div>
            ) : null}
            <div className="total-row">
              <dt>{text.total}</dt>
              <dd>{formatMoney(receipt.totalCents, currency)}</dd>
            </div>
            <div>
              <dt>{text.paidReceipt}</dt>
              <dd>{formatMoney(receipt.paidCents, currency)}</dd>
            </div>
            <div>
              <dt>{text.change}</dt>
              <dd>{formatMoney(receipt.changeCents, currency)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {returnSale ? (
        <section className="panel inline-panel">
          <div className="crud-form-header">
            <h3>
              {text.returnTitle}: {returnSale.invoiceNo} · {formatMoney(returnSale.totalCents, currency)}
            </h3>
            <button type="button" className="link-button" onClick={() => setReturnSale(null)}>
              {text.cancel}
            </button>
          </div>
          <div className="crud-grid">
            <label className="wide">
              <span>{text.returnReason}</span>
              <input
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
                maxLength={200}
                required
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="primary" onClick={confirmReturn} disabled={returnBusy}>
              {returnBusy ? text.processing : text.confirmReturn}
            </button>
            <button type="button" onClick={() => setReturnSale(null)}>
              {text.cancel}
            </button>
          </div>
        </section>
      ) : null}

      <div className="pos-layout">
        <section className="panel pos-products">
          <div className="toolbar">
            <input
              className="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                const code = query.trim()
                const exact = products.find((product) => product.barcode === code)
                if (exact) addProduct(exact)
                else if (visibleProducts[0]) addProduct(visibleProducts[0])
              }}
              placeholder={text.search}
              aria-label={text.search}
            />
          </div>
          {products.filter((product) => product.active !== false).length === 0 ? (
            <div className="empty-state">
              <strong>{text.noProducts}</strong>
              <p>{text.noProductsHint}</p>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="empty-state">
              <p>{text.noProducts}</p>
            </div>
          ) : (
            <div className="product-grid">
              {visibleProducts.map((product) => {
                const level = stockLevel(product)
                const low = level !== 'ok'
                return (
                  <div key={product._id ?? product.sku} className={`product-card level-${level}`}>
                    <button
                      type="button"
                      className="product-card-main"
                      onClick={() => addProduct(product)}
                    >
                      <span className="product-name">{product.name}</span>
                      <span className="product-meta">
                        {product.sku}
                        {product.barcode ? ` · ${product.barcode}` : ''}
                      </span>
                      <span className="product-footer">
                        <strong>{UNIT_NAMES[language][ownUnit(product)]} {formatMoney(unitPrice(product, ownUnit(product)), currency)}</strong>
                        <span className={low ? 'warning-text' : 'muted'}>{stockText(product.stockQuantity, product, language)}</span>
                      </span>
                    </button>
                    {saleUnits(product)
                      .filter((unit) => unit !== ownUnit(product) && unitPrice(product, unit) > 0)
                      .map((unit) => (
                        <button
                          key={unit}
                          type="button"
                          className="product-card-box"
                          onClick={() => addProduct(product, unit)}
                        >
                          {UNIT_NAMES[language][unit]}: {formatMoney(unitPrice(product, unit), currency)}
                        </button>
                      ))}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="panel pos-cart">
          <div className="crud-form-header">
            <h3>{text.cart}</h3>
            {cartLines.length > 0 ? (
              <button type="button" className="link-button" onClick={clearCart}>
                {text.clear}
              </button>
            ) : null}
          </div>

          {cartLines.length === 0 ? (
            <div className="empty-state">
              <strong>{text.emptyCart}</strong>
              <p>{text.emptyCartHint}</p>
            </div>
          ) : (
            <div className="cart-lines">
              {cartLines.map((line) => (
                <div className="cart-line" key={`${line.product._id}:${line.unit}`}>
                  <div className="cart-line-main">
                    <strong>{line.product.name}</strong>
                    <span className="muted">
                      {`${UNIT_NAMES[language][line.unit]} · `}
                      {formatMoney(line.unitPriceCents, currency)}
                    </span>
                  </div>
                  <div className="cart-line-controls">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={line.quantity}
                      onChange={(event) =>
                        setQuantity(line.product._id as string, line.unit, event.target.value)
                      }
                      aria-label={text.quantity}
                    />
                    <strong>{formatMoney(line.lineTotalCents, currency)}</strong>
                    <button
                      type="button"
                      className="link-button danger-text"
                      onClick={() => removeLine(line.product._id as string, line.unit)}
                    >
                      {text.remove}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <CustomerPicker language={language} selected={customer} onSelect={chooseCustomer} />

          <label className="cart-field">
            <span>{text.discountPercent}</span>
            <input
              inputMode="decimal"
              value={discountInput}
              onChange={(event) => setDiscountInput(event.target.value)}
              placeholder="0"
            />
          </label>

          <dl className="totals-list">
            <div>
              <dt>{text.subtotal}</dt>
              <dd>{formatMoney(subtotalCents, currency)}</dd>
            </div>
            <div>
              <dt>{text.discount}</dt>
              <dd>{formatMoney(safeDiscountCents, currency)}</dd>
            </div>
            {taxBasisPoints > 0 ? (
              <div>
                <dt>
                  {text.tax} ({taxPercent}%)
                </dt>
                <dd>{formatMoney(taxCents, currency)}</dd>
              </div>
            ) : null}
            <div className="total-row">
              <dt>{text.total}</dt>
              <dd>{formatMoney(totalCents, currency)}</dd>
            </div>
          </dl>

          <div className="payment-row">
            <label>
              <span>{text.paymentMethod}</span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as 'cash' | 'card' | 'other')}
              >
                <option value="cash">{text.cash}</option>
                <option value="card">{text.card}</option>
                <option value="other">{text.other}</option>
              </select>
            </label>
            {paymentMethod === 'cash' ? (
              <label>
                <span>{text.paid}</span>
                <input
                  inputMode="decimal"
                  value={paidInput}
                  onChange={(event) => setPaidInput(event.target.value)}
                  placeholder={formatMoney(totalCents, currency)}
                />
              </label>
            ) : null}
          </div>

          {paymentMethod === 'cash' && paidInput.trim() ? (
            <p className={changeCents < 0 ? 'danger-text' : 'muted'}>
              {text.change}: {formatMoney(changeCents, currency)}
            </p>
          ) : null}

          <button
            type="button"
            className="primary checkout-button"
            onClick={handleCheckout}
            disabled={busy || cartLines.length === 0}
          >
            {busy ? text.processing : `${text.checkout} · ${formatMoney(totalCents, currency)}`}
          </button>
        </section>
      </div>

      <ReturnablePanel language={language} currency={currency} refreshKey={sales} onReturned={onChanged} />

      <div className="pos-bottom">
        <section className="panel">
          <div className="section-header">
            <h3>{text.recentSales}</h3>
            <ExportButton section="sales" language={language} />
          </div>
          {sales.length === 0 ? (
            <div className="empty-state">
              <p>{text.noSales}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table compact">
                <thead>
                  <tr>
                    {text.units.map((unit, index) => (
                      <th key={`${unit}-${index}`}>{unit}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 10).map((sale) => (
                    <tr key={sale._id ?? sale.invoiceNo}>
                      <td>{sale.invoiceNo}<RecordId id={sale._id} /></td>
                      <td>{formatDateTime(sale.createdAt, language)}</td>
                      <td>{formatMoney(sale.totalCents, currency)}</td>
                      <td>{text.status[sale.status]}</td>
                      <td>
                        {sale.status === 'completed' ? (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => {
                              setReturnSale(sale)
                              setReturnReason('')
                              setError('')
                              setSuccess('')
                            }}
                          >
                            {text.returnLabel}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-header">
            <h3>{text.cashbox}</h3>
            <span className="tag">
              {text.cashboxBalance}: {formatMoney(cashboxBalance, currency)}
            </span>
          </div>
          <div className="cash-form">
            <label>
              <span>{text.amount}</span>
              <input
                inputMode="decimal"
                value={cashAmount}
                onChange={(event) => setCashAmount(event.target.value)}
                placeholder="0.00"
              />
            </label>
            <label>
              <span>{text.reason}</span>
              <input
                value={cashReason}
                onChange={(event) => setCashReason(event.target.value)}
                maxLength={120}
              />
            </label>
            <div className="form-actions">
              <button type="button" onClick={() => moveCash('in')} disabled={cashBusy}>
                {text.cashIn}
              </button>
              <button type="button" onClick={() => moveCash('out')} disabled={cashBusy}>
                {text.cashOut}
              </button>
            </div>
          </div>
          {cashbox.length === 0 ? (
            <div className="empty-state">
              <p>{text.noCashbox}</p>
            </div>
          ) : (
            <ul className="movement-list">
              {cashbox.slice(0, 8).map((movement) => (
                <li key={movement._id ?? `${movement.createdAt}-${movement.amountCents}`}>
                  <span>
                    <strong>{text.cashTypes[movement.type]}</strong>
                    <small className="block-muted">{movement.reason}</small>
                  </span>
                  <span className={movement.amountCents < 0 ? 'danger-text' : 'ok-text'}>
                    {formatMoney(movement.amountCents, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  )
}
