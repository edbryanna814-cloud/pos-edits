import type { CashboxMovement, Sale } from '../../../shared/pos'
import type { Product } from '../../../shared/inventory'
import type { Language } from '../../../shared/settings'
import { formatDateTime, formatMoney, isToday } from '../money'
import { expiryState } from '../../../shared/expiry'

interface Props {
  language: Language
  currency: string
  products: Product[]
  sales: Sale[]
  cashbox: CashboxMovement[]
  onNavigate: (section: 'pos' | 'inventory') => void
}

const copy = {
  en: {
    title: 'Dashboard',
    intro: 'Today at a glance.',
    todaySales: "Today's sales",
    todayCount: 'Completed sales today',
    products: 'Products',
    lowStock: 'Low stock items',
    cashbox: 'Cashbox balance',
    lowStockTitle: 'Needs restocking',
    noLowStock: 'All products are above their minimum stock.',
    recentSales: 'Latest sales',
    noSales: 'No sales yet.',
    goPos: 'Open point of sale',
    goInventory: 'Manage inventory',
    units: 'units',
    expired: 'Expired',
    expiresSoon: 'Expires soon',
    columns: { product: 'Product', stock: 'Stock', minimum: 'Minimum', expiry: 'Expiry' },
    saleColumns: { invoice: 'Invoice', date: 'Date', total: 'Total' }
  },
  ar: {
    title: 'لوحة التحكم',
    intro: 'نظرة سريعة على اليوم.',
    todaySales: 'مبيعات اليوم',
    todayCount: 'المبيعات المكتملة اليوم',
    products: 'المنتجات',
    lowStock: 'منتجات منخفضة المخزون',
    cashbox: 'رصيد الصندوق',
    lowStockTitle: 'تحتاج إعادة تعبئة',
    noLowStock: 'كل المنتجات أعلى من الحد الأدنى.',
    recentSales: 'أحدث المبيعات',
    noSales: 'لا توجد مبيعات بعد.',
    goPos: 'فتح نقطة البيع',
    goInventory: 'إدارة المخزون',
    units: 'منتج',
    expired: 'منتهي الصلاحية',
    expiresSoon: 'قارب على الانتهاء',
    columns: { product: 'المنتج', stock: 'الرصيد', minimum: 'الحد الأدنى', expiry: 'الانتهاء' },
    saleColumns: { invoice: 'الفاتورة', date: 'التاريخ', total: 'الإجمالي' }
  }
} as const

export default function DashboardPage({ language, currency, products, sales, cashbox, onNavigate }: Props) {
  const text = copy[language]
  const todaySales = sales.filter((sale) => sale.status === 'completed' && isToday(sale.createdAt))
  const todayTotal = todaySales.reduce((sum, sale) => sum + sale.totalCents, 0)
  const daysLeft = (date: string | undefined): number | null => {
    if (!date) return null
    const target = new Date(`${date.slice(0, 10)}T00:00:00`)
    if (Number.isNaN(target.getTime())) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.round((target.getTime() - today.getTime()) / 86400000)
  }
  const lowStock = products
    .filter((product) => {
      if (product.active === false) return false
      const minStock = Math.max(0, Math.trunc(Number(product.minStock) || 0))
      const expiry = expiryState(product.expiryDate)
      return product.stockQuantity <= minStock || expiry === 'expired' || expiry === 'soon'
    })
    .sort((a, b) => {
      const ae = daysLeft(a.expiryDate)
      const be = daysLeft(b.expiryDate)
      if ((ae !== null && ae < 0) !== (be !== null && be < 0)) return ae !== null && ae < 0 ? -1 : 1
      return a.stockQuantity - b.stockQuantity
    })
  const cashboxBalance = cashbox.reduce((sum, movement) => sum + movement.amountCents, 0)

  return (
    <section className="dashboard-page" aria-labelledby="dashboard-title">
      <div className="section-header">
        <div>
          <h2 id="dashboard-title">{text.title}</h2>
          <p className="muted">{text.intro}</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => onNavigate('inventory')}>
            {text.goInventory}
          </button>
          <button type="button" className="primary" onClick={() => onNavigate('pos')}>
            {text.goPos}
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span>{text.todaySales}</span>
          <strong>{formatMoney(todayTotal, currency)}</strong>
          <small>
            {todaySales.length} · {text.todayCount}
          </small>
        </div>
        <div className="kpi-card">
          <span>{text.products}</span>
          <strong>{products.length}</strong>
          <small>{text.units}</small>
        </div>
        <div className="kpi-card">
          <span>{text.lowStock}</span>
          <strong className={lowStock.length > 0 ? 'warning-text' : ''}>{lowStock.length}</strong>
          <small>{text.lowStockTitle}</small>
        </div>
        <div className="kpi-card">
          <span>{text.cashbox}</span>
          <strong className={cashboxBalance < 0 ? 'danger-text' : ''}>
            {formatMoney(cashboxBalance, currency)}
          </strong>
          <small>{cashbox.length}</small>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <h3>{text.lowStockTitle}</h3>
          </div>
          {lowStock.length === 0 ? (
            <div className="empty-state">
              <p>{text.noLowStock}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>{text.columns.product}</th>
                    <th>{text.columns.stock}</th>
                    <th>{text.columns.minimum}</th>
                    <th>{text.columns.expiry}</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.slice(0, 8).map((product) => {
                    const expiry = expiryState(product.expiryDate)
                    const expired = expiry === 'expired'
                    return (
                      <tr key={product._id ?? product.sku}>
                        <td>{product.name}</td>
                        <td className={product.stockQuantity <= 3 || expired ? 'danger-text' : 'warning-text'}>
                          {product.stockQuantity}
                        </td>
                        <td>{product.minStock}</td>
                        <td>
                          {expiry === 'expired' || expiry === 'soon' ? (
                            <span className={`tag ${expired ? 'danger-tag' : 'warning-tag'}`}>
                              {expired ? text.expired : text.expiresSoon} · {product.expiryDate!.slice(0, 10)}
                            </span>
                          ) : product.expiryDate ? (
                            <span>{product.expiryDate.slice(0, 10)}</span>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
                    <th>{text.saleColumns.invoice}</th>
                    <th>{text.saleColumns.date}</th>
                    <th>{text.saleColumns.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 6).map((sale) => (
                    <tr key={sale._id ?? sale.invoiceNo}>
                      <td>{sale.invoiceNo}</td>
                      <td>{formatDateTime(sale.createdAt, language)}</td>
                      <td>{formatMoney(sale.totalCents, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
