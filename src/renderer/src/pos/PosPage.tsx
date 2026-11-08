import { useEffect, useMemo, useRef, useState } from 'react'
import type { CashboxMovement, Sale } from '../../../shared/pos'
import type { Product } from '../../../shared/inventory'
import type { Customer } from '../../../shared/crm'
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
    outOfStock: 'Out of stock',
    low: 'Low stock',
    quantity: 'Qty',
    remove: 'Remove',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax',
    total: 'Total',
    paymentMethod: 'Payment method',
    customer: 'Customer (optional)',
    noCustomer: 'Walk-in customer',
    cash: 'Cash',
    card: 'Card',
    other: 'Other',
    paid: 'Paid amount (leave empty for exact)',
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
    discountError: 'Enter a valid discount.',
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
    outOfStock: 'نفد المخزون',
    low: 'منخفض',
    quantity: 'الكمية',
    remove: 'حذف',
    subtotal: 'الإجمالي الفرعي',
    discount: 'الخصم',
    tax: 'الضريبة',
    total: 'الإجمالي',
    paymentMethod: 'طريقة الدفع',
    customer: 'العميل (اختياري)',
    noCustomer: 'عميل عابر',
    cash: 'نقدًا',
    card: 'بطاقة',
    other: 'أخرى',
    paid: 'المبلغ المدفوع (اتركه فارغًا للمبلغ بالضبط)',
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
    discountError: 'أدخل خصمًا صحيحًا.',
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
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function newRequestId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined
  return cryptoApi?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function PosPage({
  products,
  sales,
  cashbox,
  language,
  currency,
  taxRateBasisPoints,
  cashier,
  onChanged
}: Props) {
  const text = copy[language]
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountInput, setDiscountInput] = useState('')
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
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState('')
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
        return [
          {
            product,
            quantity: item.quantity,
            lineTotalCents: product.sellingPriceCents * item.quantity
          }
        ]
      }),
    [cart, byId]
  )

  const subtotalCents = cartLines.reduce((sum, line) => sum + line.lineTotalCents, 0)
  const discountCents = discountInput.trim() ? parseMoney(discountInput) : 0
  const safeDiscountCents = Math.min(Math.max(0, discountCents ?? 0), subtotalCents)
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
    window.api?.crmCustomersList()
      .then((list) => setCustomers(list.filter((customer: Customer) => customer.active !== false)))
      .catch(() => undefined)
  }, [])

  function addProduct(product: Product): void {
    if (!product._id || product.stockQuantity <= 0) return
    const existing = cart.find((item) => item.productId === product._id)
    if (existing && existing.quantity >= product.stockQuantity) {
      setError(`${text.outOfStock}: ${product.name}`)
      return
    }
    setError('')
    setSuccess('')
    if (existing) {
      setCart((current) =>
        current.map((item) =>
          item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item
        )
      )
    } else {
      setCart((current) => [...current, { productId: product._id as string, quantity: 1 }])
    }
  }

  function setQuantity(productId: string, value: string): void {
    const product = byId.get(productId)
    if (!product) return
    const parsed = Number(value)
    const quantity = Number.isFinite(parsed) ? Math.trunc(parsed) : 1
    const clamped = Math.max(1, Math.min(product.stockQuantity, quantity))
    setCart((current) =>
      current.map((item) => (item.productId === productId ? { ...item, quantity: clamped } : item))
    )
  }

  function removeLine(productId: string): void {
    setCart((current) => current.filter((item) => item.productId !== productId))
  }

  function clearCart(): void {
    setCart([])
    setDiscountInput('')
    setPaidInput('')
    setError('')
    requestIdRef.current = null
  }

  async function handleCheckout(): Promise<void> {
    setError('')
    setSuccess('')
    if (cartLines.length === 0) return setError(text.cartEmptyError)
    if (discountInput.trim() && discountCents === null) return setError(text.discountError)
    if ((discountCents ?? 0) > subtotalCents) return setError(text.discountTooBig)
    if (paidCents === null) return setError(text.paidError)
    if (paidCents < totalCents) return setError(text.paidTooLow)

    setBusy(true)
    try {
      if (!requestIdRef.current) requestIdRef.current = newRequestId()
      const sale = await window.api.posCheckout({
        clientRequestId: requestIdRef.current,
        lines: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        discountCents: safeDiscountCents,
        taxCents,
        paymentMethod,
        paidCents,
        customerId: customerId || undefined
      })
      setReceipt(sale)
      setCart([])
      setDiscountInput('')
      setPaidInput('')
      setCustomerId('')
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
      setError(`${text.returnError}: ${errorText(returnError)}`)
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
          <div className="receipt-meta">
            <div>
              <span>{text.invoice}</span>
              <strong>{receipt.invoiceNo}</strong>
            </div>
            <div>
              <span>{text.date}</span>
              <strong>{formatDateTime(receipt.createdAt, language)}</strong>
            </div>
            <div>
              <span>{text.cashierLabel}</span>
              <strong>{receipt.cashierUsername ?? cashier}</strong>
            </div>
            {receipt.customerId ? (
              <div>
                <span>{text.customer}</span>
                <strong>
                  {customers.find((customer) => customer._id === receipt.customerId)?.name ?? '-'}
                </strong>
              </div>
            ) : null}
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
            <div>
              <dt>
                {text.tax} ({taxPercent}%)
              </dt>
              <dd>{formatMoney(receipt.taxCents, currency)}</dd>
            </div>
            <div className="total-row">
              <dt>{text.total}</dt>
              <dd>{formatMoney(receipt.totalCents, currency)}</dd>
            </div>
            <div>
              <dt>{text.paid}</dt>
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
                if (event.key === 'Enter' && visibleProducts[0]) addProduct(visibleProducts[0])
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
                const low = product.stockQuantity <= product.minStock
                return (
                  <button
                    key={product._id ?? product.sku}
                    type="button"
                    className="product-card"
                    onClick={() => addProduct(product)}
                  >
                    <span className="product-name">{product.name}</span>
                    <span className="product-meta">
                      {product.sku}
                      {product.barcode ? ` · ${product.barcode}` : ''}
                    </span>
                    <span className="product-footer">
                      <strong>{formatMoney(product.sellingPriceCents, currency)}</strong>
                      <span className={low ? 'warning-text' : 'muted'}>{product.stockQuantity}</span>
                    </span>
                  </button>
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
                <div className="cart-line" key={line.product._id}>
                  <div className="cart-line-main">
                    <strong>{line.product.name}</strong>
                    <span className="muted">{formatMoney(line.product.sellingPriceCents, currency)}</span>
                  </div>
                  <div className="cart-line-controls">
                    <input
                      type="number"
                      min={1}
                      max={line.product.stockQuantity}
                      step={1}
                      value={line.quantity}
                      onChange={(event) => setQuantity(line.product._id as string, event.target.value)}
                      aria-label={text.quantity}
                    />
                    <strong>{formatMoney(line.lineTotalCents, currency)}</strong>
                    <button type="button" className="link-button danger-text" onClick={() => removeLine(line.product._id as string)}>
                      {text.remove}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <label className="cart-field">
            <span>{text.discount}</span>
            <input
              inputMode="decimal"
              value={discountInput}
              onChange={(event) => setDiscountInput(event.target.value)}
              placeholder="0.00"
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
            <div>
              <dt>
                {text.tax} ({taxPercent}%)
              </dt>
              <dd>{formatMoney(taxCents, currency)}</dd>
            </div>
            <div className="total-row">
              <dt>{text.total}</dt>
              <dd>{formatMoney(totalCents, currency)}</dd>
            </div>
          </dl>

          <label className="cart-field">
            <span>{text.customer}</span>
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">{text.noCustomer}</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>

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

      <div className="pos-bottom">
        <section className="panel">
          <div className="section-header">
            <h3>{text.recentSales}</h3>
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
                      <td>{sale.invoiceNo}</td>
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
