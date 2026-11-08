import type { CashboxReport, InventoryReport, SalesReport } from '../../../shared/reports'
import type { Language } from '../../../shared/settings'
import type { Sale } from '../../../shared/pos'
import { formatMoney, isToday } from '../money'

interface Props {
  language: Language
  currency: string
  sales: Sale[]
  salesReport: SalesReport | null
  cashboxReport: CashboxReport | null
  inventoryReport: InventoryReport | null
}

const copy = {
  en: {
    title: 'Reports',
    intro: 'Sales, cashbox, and inventory totals.',
    sales: 'Sales',
    profitability: 'Profitability',
    grossSales: 'Gross sales',
    discounts: 'Discounts',
    taxes: 'Taxes',
    returns: 'Returns',
    returnsCount: 'Returned invoices',
    cogs: 'Cost of goods sold',
    grossProfit: 'Gross profit',
    cashierPerformance: 'Cashier performance',
    cashier: 'Cashier',
    customerReport: 'Customer performance',
    customer: 'Customer',
    productReport: 'Product performance',
    product: 'Product',
    quantity: 'Qty',
    revenue: 'Revenue',
    profit: 'Profit',
    none: 'None yet.',
    totalSales: 'Total sales',
    completedCount: 'Completed invoices',
    average: 'Average invoice',
    today: "Today's sales",
    byMethod: 'By payment method',
    method: 'Method',
    count: 'Count',
    total: 'Total',
    cashbox: 'Cashbox',
    totalIn: 'Total received',
    totalOut: 'Total paid out',
    balance: 'Balance',
    inventory: 'Inventory',
    products: 'Products',
    lowStock: 'Low stock',
    stockValue: 'Stock value (cost)',
    noData: 'No report data yet.',
    methods: { cash: 'Cash', card: 'Card', other: 'Other' }
  },
  ar: {
    title: 'التقارير',
    intro: 'إجماليات المبيعات والصندوق والمخزون.',
    sales: 'المبيعات',
    profitability: 'الربحية',
    grossSales: 'إجمالي المبيعات قبل الخصم',
    discounts: 'الخصومات',
    taxes: 'الضرائب',
    returns: 'المرتجعات',
    returnsCount: 'الفواتير المرتجعة',
    cogs: 'تكلفة البضاعة المباعة',
    grossProfit: 'إجمالي الربح',
    cashierPerformance: 'أداء الكاشير',
    cashier: 'الكاشير',
    customerReport: 'أداء العملاء',
    customer: 'العميل',
    productReport: 'أداء المنتجات',
    product: 'المنتج',
    quantity: 'الكمية',
    revenue: 'الإيراد',
    profit: 'الربح',
    none: 'لا يوجد بعد.',
    totalSales: 'إجمالي المبيعات',
    completedCount: 'الفواتير المكتملة',
    average: 'متوسط الفاتورة',
    today: 'مبيعات اليوم',
    byMethod: 'حسب طريقة الدفع',
    method: 'الطريقة',
    count: 'العدد',
    total: 'الإجمالي',
    cashbox: 'الصندوق',
    totalIn: 'إجمالي الوارد',
    totalOut: 'إجمالي الصادر',
    balance: 'الرصيد',
    inventory: 'المخزون',
    products: 'المنتجات',
    lowStock: 'منخفض المخزون',
    stockValue: 'قيمة المخزون (بالتكلفة)',
    noData: 'لا توجد بيانات تقارير بعد.',
    methods: { cash: 'نقدًا', card: 'بطاقة', other: 'أخرى' }
  }
} as const

export default function ReportsPage({
  language,
  currency,
  sales,
  salesReport,
  cashboxReport,
  inventoryReport
}: Props) {
  const text = copy[language]
  if (!salesReport || !cashboxReport || !inventoryReport) {
    return (
      <section className="panel">
        <div className="empty-state">
          <p>{text.noData}</p>
        </div>
      </section>
    )
  }

  const todayTotal = sales
    .filter((sale) => sale.status === 'completed' && isToday(sale.createdAt))
    .reduce((sum, sale) => sum + sale.totalCents, 0)
  const averageCents =
    salesReport.totalCount > 0 ? Math.round(salesReport.totalSalesCents / salesReport.totalCount) : 0

  return (
    <section className="reports-page" aria-labelledby="reports-title">
      <div className="section-header">
        <div>
          <h2 id="reports-title">{text.title}</h2>
          <p className="muted">{text.intro}</p>
        </div>
      </div>

      <div className="report-grid">
        <section className="panel">
          <h3>{text.sales}</h3>
          <dl className="stat-list">
            <div>
              <dt>{text.totalSales}</dt>
              <dd>{formatMoney(salesReport.totalSalesCents, currency)}</dd>
            </div>
            <div>
              <dt>{text.completedCount}</dt>
              <dd>{salesReport.totalCount}</dd>
            </div>
            <div>
              <dt>{text.average}</dt>
              <dd>{formatMoney(averageCents, currency)}</dd>
            </div>
            <div>
              <dt>{text.today}</dt>
              <dd>{formatMoney(todayTotal, currency)}</dd>
            </div>
          </dl>
          <h4>{text.byMethod}</h4>
          <table className="data-table compact">
            <thead>
              <tr>
                <th>{text.method}</th>
                <th>{text.count}</th>
                <th>{text.total}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(salesReport.byPaymentMethod).length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    {text.noData}
                  </td>
                </tr>
              ) : (
                Object.entries(salesReport.byPaymentMethod).map(([method, value]) => (
                  <tr key={method}>
                    <td>{text.methods[method as keyof typeof text.methods] ?? method}</td>
                    <td>{value.count}</td>
                    <td>{formatMoney(value.totalCents, currency)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h3>{text.cashbox}</h3>
          <dl className="stat-list">
            <div>
              <dt>{text.totalIn}</dt>
              <dd className="ok-text">{formatMoney(cashboxReport.totalInCents, currency)}</dd>
            </div>
            <div>
              <dt>{text.totalOut}</dt>
              <dd className="danger-text">{formatMoney(cashboxReport.totalOutCents, currency)}</dd>
            </div>
            <div>
              <dt>{text.balance}</dt>
              <dd className={cashboxReport.balanceCents < 0 ? 'danger-text' : ''}>
                {formatMoney(cashboxReport.balanceCents, currency)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h3>{text.inventory}</h3>
          <dl className="stat-list">
            <div>
              <dt>{text.products}</dt>
              <dd>{inventoryReport.totalProducts}</dd>
            </div>
            <div>
              <dt>{text.lowStock}</dt>
              <dd className={inventoryReport.lowStock > 0 ? 'warning-text' : ''}>
                {inventoryReport.lowStock}
              </dd>
            </div>
            <div>
              <dt>{text.stockValue}</dt>
              <dd>{formatMoney(inventoryReport.totalValueCents, currency)}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h3>{text.profitability}</h3>
          <dl className="stat-list">
            <div>
              <dt>{text.grossSales}</dt>
              <dd>{formatMoney(salesReport.grossCents, currency)}</dd>
            </div>
            <div>
              <dt>{text.discounts}</dt>
              <dd className="warning-text">{formatMoney(salesReport.discountCents, currency)}</dd>
            </div>
            <div>
              <dt>{text.taxes}</dt>
              <dd>{formatMoney(salesReport.taxCents, currency)}</dd>
            </div>
            <div>
              <dt>{text.cogs}</dt>
              <dd>{formatMoney(salesReport.cogsCents, currency)}</dd>
            </div>
            <div>
              <dt>{text.grossProfit}</dt>
              <dd className={salesReport.grossProfitCents < 0 ? 'danger-text' : 'ok-text'}>
                {formatMoney(salesReport.grossProfitCents, currency)}
              </dd>
            </div>
            <div>
              <dt>{text.returns}</dt>
              <dd className="danger-text">
                {formatMoney(salesReport.returnsCents, currency)} ({salesReport.returnsCount})
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="report-grid">
        <section className="panel">
          <h3>{text.cashierPerformance}</h3>
          {Object.entries(salesReport.byCashier).length === 0 ? (
            <p className="muted">{text.none}</p>
          ) : (
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>{text.cashier}</th>
                  <th>{text.count}</th>
                  <th>{text.total}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(salesReport.byCashier).map(([cashier, value]) => (
                  <tr key={cashier}>
                    <td>{cashier}</td>
                    <td>{value.count}</td>
                    <td>{formatMoney(value.totalCents, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <h3>{text.customerReport}</h3>
          {salesReport.byCustomer.length === 0 ? (
            <p className="muted">{text.none}</p>
          ) : (
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>{text.customer}</th>
                  <th>{text.count}</th>
                  <th>{text.total}</th>
                </tr>
              </thead>
              <tbody>
                {salesReport.byCustomer.map((customer) => (
                  <tr key={customer.customerId}>
                    <td>{customer.name}</td>
                    <td>{customer.count}</td>
                    <td>{formatMoney(customer.totalCents, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <h3>{text.productReport}</h3>
          {salesReport.byProduct.length === 0 ? (
            <p className="muted">{text.none}</p>
          ) : (
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>{text.product}</th>
                  <th>{text.quantity}</th>
                  <th>{text.revenue}</th>
                  <th>{text.profit}</th>
                </tr>
              </thead>
              <tbody>
                {salesReport.byProduct.map((product) => (
                  <tr key={product.productId}>
                    <td>{product.productName}</td>
                    <td>{product.quantity}</td>
                    <td>{formatMoney(product.revenueCents, currency)}</td>
                    <td className={product.profitCents < 0 ? 'danger-text' : 'ok-text'}>
                      {formatMoney(product.profitCents, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </section>
  )
}
