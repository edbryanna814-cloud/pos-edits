import type { CashboxReport, InventoryReport, SalesReport } from '../../../shared/reports'
import type { Language } from '../../../shared/settings'
import type { Sale } from '../../../shared/pos'
import type { Product } from '../../../shared/inventory'
import { formatMoney, isToday } from '../money'
import ReportDownloads from './ReportDownloads'

interface Props {
  language: Language
  currency: string
  sales: Sale[]
  products: Product[]
  salesReport: SalesReport | null
  cashboxReport: CashboxReport | null
  inventoryReport: InventoryReport | null
}

type Bar = { label: string; value: string; ratio: number; tone?: 'ok' | 'warning' | 'danger' }

function BarList({ bars }: { bars: Bar[] }) {
  if (bars.length === 0) return <p className="muted">—</p>
  return (
    <div className="bar-list">
      {bars.map((bar) => (
        <div className="bar-row" key={bar.label}>
          <span className="bar-label" title={bar.label}>{bar.label}</span>
          <div className="bar-track">
            <span
              className={`bar-fill ${bar.tone ?? ''}`}
              style={{ width: `${Math.max(2, Math.round(bar.ratio * 100))}%` }}
            />
          </div>
          <span className="bar-value">{bar.value}</span>
        </div>
      ))}
    </div>
  )
}

const copy = {
  en: {
    title: 'Reports',
    intro: 'Sales, profit, inventory, and best sellers in one place.',
    sales: 'Sales trend (7 days)',
    paymentMethods: 'Payment methods',
    profitability: 'Profitability',
    inventory: 'Inventory',
    topProducts: 'Top selling products (30 days)',
    restock: 'Restock planner',
    cashiers: 'Cashier performance',
    totalSales: 'Total sales',
    invoices: 'Invoices',
    average: 'Average invoice',
    today: "Today's sales",
    grossSales: 'Gross sales',
    discounts: 'Discounts',
    taxes: 'Taxes',
    returns: 'Returns',
    cogs: 'Cost of goods sold',
    grossProfit: 'Gross profit',
    products: 'Products',
    lowStock: 'Low stock',
    stockValue: 'Stock value (cost)',
    totalIn: 'Cash in',
    totalOut: 'Cash out',
    balance: 'Cashbox balance',
    method: 'Method',
    count: 'Count',
    total: 'Total',
    product: 'Product',
    sold30: 'Sold (30d)',
    stock: 'Stock',
    dailyAverage: 'Daily avg',
    daysLeft: 'Days left',
    suggested: 'Suggested 30d',
    cashier: 'Cashier',
    none: 'No data yet.',
    noData: 'No report data yet.',
    methods: { cash: 'Cash', card: 'Card', other: 'Other' }
  },
  ar: {
    title: 'التقارير',
    intro: 'المبيعات والأرباح والمخزون والأكثر مبيعًا في مكان واحد.',
    sales: 'حركة المبيعات (7 أيام)',
    paymentMethods: 'طرق الدفع',
    profitability: 'الربحية',
    inventory: 'المخزون',
    topProducts: 'الأكثر مبيعًا (30 يومًا)',
    restock: 'خطة إعادة الطلب',
    cashiers: 'أداء الكاشير',
    totalSales: 'إجمالي المبيعات',
    invoices: 'الفواتير',
    average: 'متوسط الفاتورة',
    today: 'مبيعات اليوم',
    grossSales: 'إجمالي المبيعات قبل الخصم',
    discounts: 'الخصومات',
    taxes: 'الضرائب',
    returns: 'المرتجعات',
    cogs: 'تكلفة البضاعة المباعة',
    grossProfit: 'إجمالي الربح',
    products: 'المنتجات',
    lowStock: 'منخفض المخزون',
    stockValue: 'قيمة المخزون (بالتكلفة)',
    totalIn: 'إجمالي الوارد',
    totalOut: 'إجمالي الصادر',
    balance: 'رصيد الصندوق',
    method: 'الطريقة',
    count: 'العدد',
    total: 'الإجمالي',
    product: 'المنتج',
    sold30: 'المبيع (30 يومًا)',
    stock: 'الرصيد',
    dailyAverage: 'متوسط يومي',
    daysLeft: 'يكفي لـ',
    suggested: 'مقترح 30 يومًا',
    cashier: 'الكاشير',
    none: 'لا توجد بيانات بعد.',
    noData: 'لا توجد بيانات تقارير بعد.',
    methods: { cash: 'نقدًا', card: 'بطاقة', other: 'أخرى' }
  }
} as const

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function ReportsPage({
  language,
  currency,
  sales,
  products,
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

  const completed = sales.filter((sale) => sale.status === 'completed')
  const todayTotal = completed
    .filter((sale) => isToday(sale.createdAt))
    .reduce((sum, sale) => sum + sale.totalCents, 0)
  const averageCents =
    salesReport.totalCount > 0 ? Math.round(salesReport.totalSalesCents / salesReport.totalCount) : 0

  const daily: Bar[] = []
  const maxDaily = Math.max(
    1,
    ...Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      const key = dayKey(date)
      return completed
        .filter((sale) => dayKey(new Date(sale.createdAt)) === key)
        .reduce((sum, sale) => sum + sale.totalCents, 0)
    })
  )
  for (let index = 0; index < 7; index++) {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = dayKey(date)
    const total = completed
      .filter((sale) => dayKey(new Date(sale.createdAt)) === key)
      .reduce((sum, sale) => sum + sale.totalCents, 0)
    daily.push({
      label: date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', {
        weekday: 'short'
      }),
      value: formatMoney(total, currency),
      ratio: total / maxDaily,
      tone: index === 6 ? 'ok' : undefined
    })
  }

  const paymentBars: Bar[] = Object.entries(salesReport.byPaymentMethod)
    .sort((a, b) => b[1].totalCents - a[1].totalCents)
    .map(([method, value]) => ({
      label: text.methods[method as keyof typeof text.methods] ?? method,
      value: `${value.count} · ${formatMoney(value.totalCents, currency)}`,
      ratio: salesReport.totalSalesCents > 0 ? value.totalCents / salesReport.totalSalesCents : 0
    }))

  const cutoff = Date.now() - 30 * 86400000
  const sold = new Map<string, { name: string; quantity: number; revenueCents: number }>()
  for (const sale of completed) {
    if (new Date(sale.createdAt).getTime() < cutoff) continue
    for (const line of sale.lines) {
      const entry = sold.get(line.productId) ?? {
        name: line.productName,
        quantity: 0,
        revenueCents: 0
      }
      entry.quantity += line.quantity
      entry.revenueCents += line.lineTotalCents
      sold.set(line.productId, entry)
    }
  }
  const productById = new Map(products.map((product) => [product._id, product]))
  const topProducts = [...sold.entries()]
    .map(([productId, entry]) => {
      const product = productById.get(productId)
      const dailyAverage = entry.quantity / 30
      const stock = product?.stockQuantity ?? 0
      return {
        productId,
        name: entry.name,
        quantity: entry.quantity,
        revenueCents: entry.revenueCents,
        stock,
        dailyAverage,
        daysLeft: dailyAverage > 0 ? Math.floor(stock / dailyAverage) : null,
        suggested: Math.max(0, Math.ceil(dailyAverage * 30) - stock)
      }
    })
    .sort((a, b) => b.quantity - a.quantity)
  const maxSold = Math.max(1, ...topProducts.map((item) => item.quantity))
  const topBars: Bar[] = topProducts.slice(0, 8).map((item) => ({
    label: item.name,
    value: `${item.quantity}`,
    ratio: item.quantity / maxSold
  }))

  return (
    <section className="reports-page" aria-labelledby="reports-title">
      <div className="section-header">
        <div>
          <h2 id="reports-title">{text.title}</h2>
          <p className="muted">{text.intro}</p>
        </div>
      </div>

      <ReportDownloads language={language} />

      <div className="kpi-grid">
        <div className="kpi-card">
          <span>{text.totalSales}</span>
          <strong>{formatMoney(salesReport.totalSalesCents, currency)}</strong>
          <small>{salesReport.totalCount} · {text.invoices}</small>
        </div>
        <div className="kpi-card">
          <span>{text.grossProfit}</span>
          <strong className={salesReport.grossProfitCents < 0 ? 'danger-text' : 'ok-text'}>
            {formatMoney(salesReport.grossProfitCents, currency)}
          </strong>
          <small>{text.cogs}: {formatMoney(salesReport.cogsCents, currency)}</small>
        </div>
        <div className="kpi-card">
          <span>{text.today}</span>
          <strong>{formatMoney(todayTotal, currency)}</strong>
          <small>{text.average}: {formatMoney(averageCents, currency)}</small>
        </div>
        <div className="kpi-card">
          <span>{text.returns}</span>
          <strong className="danger-text">
            {formatMoney(salesReport.returnsCents, currency)}
          </strong>
          <small>{salesReport.returnsCount} {text.invoices}</small>
        </div>
      </div>

      <div className="report-grid">
        <section className="panel">
          <h3>{text.sales}</h3>
          <BarList bars={daily} />
        </section>

        <section className="panel">
          <h3>{text.paymentMethods}</h3>
          <BarList bars={paymentBars} />
        </section>

        <section className="panel">
          <h3>{text.profitability}</h3>
          <dl className="stat-list">
            <div><dt>{text.grossSales}</dt><dd>{formatMoney(salesReport.grossCents, currency)}</dd></div>
            <div><dt>{text.discounts}</dt><dd className="warning-text">{formatMoney(salesReport.discountCents, currency)}</dd></div>
            <div><dt>{text.taxes}</dt><dd>{formatMoney(salesReport.taxCents, currency)}</dd></div>
            <div><dt>{text.cogs}</dt><dd>{formatMoney(salesReport.cogsCents, currency)}</dd></div>
            <div className="total-row">
              <dt>{text.grossProfit}</dt>
              <dd className={salesReport.grossProfitCents < 0 ? 'danger-text' : 'ok-text'}>
                {formatMoney(salesReport.grossProfitCents, currency)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h3>{text.inventory}</h3>
          <dl className="stat-list">
            <div><dt>{text.products}</dt><dd>{inventoryReport.totalProducts}</dd></div>
            <div><dt>{text.lowStock}</dt><dd className={inventoryReport.lowStock > 0 ? 'warning-text' : ''}>{inventoryReport.lowStock}</dd></div>
            <div><dt>{text.stockValue}</dt><dd>{formatMoney(inventoryReport.totalValueCents, currency)}</dd></div>
          </dl>
        </section>

        <section className="panel">
          <h3>{text.topProducts}</h3>
          <BarList bars={topBars} />
        </section>
      </div>

      <section className="panel report-wide">
        <h3>{text.restock}</h3>
        {topProducts.length === 0 ? <p className="muted">{text.none}</p> : (
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>{text.product}</th>
                  <th>{text.sold30}</th>
                  <th>{text.stock}</th>
                  <th>{text.dailyAverage}</th>
                  <th>{text.daysLeft}</th>
                  <th>{text.suggested}</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((item) => (
                  <tr key={item.productId}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td className={item.stock <= 3 ? 'danger-text' : item.stock <= 6 ? 'warning-text' : ''}>
                      {item.stock}
                    </td>
                    <td>{item.dailyAverage.toFixed(1)}</td>
                    <td className={item.daysLeft !== null && item.daysLeft <= 7 ? 'warning-text' : ''}>
                      {item.daysLeft === null ? '—' : item.daysLeft}
                    </td>
                    <td><strong>{item.suggested}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="report-grid">
        <section className="panel">
          <h3>{text.cashiers}</h3>
          {Object.entries(salesReport.byCashier).length === 0 ? <p className="muted">{text.none}</p> : (
            <BarList
              bars={Object.entries(salesReport.byCashier)
                .sort((a, b) => b[1].totalCents - a[1].totalCents)
                .map(([cashier, value]) => ({
                  label: cashier,
                  value: `${value.count} · ${formatMoney(value.totalCents, currency)}`,
                  ratio: salesReport.totalSalesCents > 0 ? value.totalCents / salesReport.totalSalesCents : 0
                }))}
            />
          )}
        </section>
      </div>
    </section>
  )
}
