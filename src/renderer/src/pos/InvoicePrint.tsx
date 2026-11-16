import type { Sale } from '../../../shared/pos'
import { UNIT_NAMES } from '../units'

// The printed invoice, in the pharmacy's Arabic template: logo, "صيدلية" + the pharmacy's name, invoice
// number and date, customer, seller, items, totals with the paid amount and the change, thank-you lines.
// Always Arabic and right-to-left; it fills the paper width the printer gives (80 mm roll, A5 or A4).

const amount = (cents: number) => (Math.round(cents) / 100).toFixed(2)
const date = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${d.getFullYear()}`
}

/** "صيدلية" + name, without saying "صيدلية" twice when the name already starts with it. */
export function pharmacyTitle(name: string): string {
  const n = name.trim()
  return n.startsWith('صيدلية') ? n : `صيدلية ${n}`.trim()
}

/** Bowl of Hygieia (cup and serpent) inside a crescent, as in the template. */
function Logo() {
  return (
    <svg className="invoice-logo" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M78 14 A44 44 0 1 0 86 80" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M26 40 H74 A24 22 0 0 1 26 40 Z" fill="currentColor" />
      <path d="M50 62 V84 M40 86 H60" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M54 22 C66 24 64 32 56 34 C46 36 44 44 54 46 C62 48 60 56 50 58 C42 60 42 68 50 70 C58 72 58 78 50 80" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="52" cy="20" r="3.5" fill="currentColor" />
    </svg>
  )
}

export default function InvoicePrint({ sale, companyName, companyPhone, cashier }: { sale: Sale; companyName: string; companyPhone: string; cashier: string }) {
  const taxPercent = sale.subtotalCents - sale.discountCents > 0 ? Math.round((sale.taxCents * 10000) / (sale.subtotalCents - sale.discountCents)) / 100 : 0
  return (
    <article className="invoice" dir="rtl" lang="ar">
      <header className="invoice-head">
        {/* Right to left: the title comes first (right), the logo last (left), as in the template. */}
        <div className="invoice-title">
          <h1>{pharmacyTitle(companyName)}</h1>
          <p className="invoice-slogan"><span />صحتك .. تهمنا<span /></p>
        </div>
        <Logo />
      </header>
      <hr />
      <section className="invoice-meta">
        <div><span>رقم الفاتورة :</span><b className="invoice-box" dir="ltr">{sale.invoiceNo}</b></div>
        <div><span>اسم العميل :</span><b>{sale.customerName || '....................'}</b></div>
        <div><span>التاريخ :</span><b className="invoice-box" dir="ltr">{date(sale.createdAt)}</b></div>
        <div><span>رقم الهاتف :</span><b dir="ltr">{sale.customerPhone || '....................'}</b></div>
        <div><span>البائع :</span><b>{sale.cashierUsername ?? cashier}</b></div>
        {companyPhone ? <div><span>هاتف الصيدلية :</span><b dir="ltr">{companyPhone}</b></div> : null}
      </section>
      <hr />
      <table className="invoice-items">
        <thead>
          <tr><th>م</th><th>اسم الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>
        </thead>
        <tbody>
          {sale.lines.map((line, i) => (
            <tr key={`${line.productId}:${i}`}>
              <td>{i + 1}</td>
              <td className="invoice-name">{line.productName}</td>
              <td>{line.quantity}{line.saleUnit && line.saleUnit !== 'base' ? ` ${UNIT_NAMES.ar[line.saleUnit]}` : ''}</td>
              <td>{amount(line.unitPriceCents)}</td>
              <td>{amount(line.lineTotalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="invoice-totals">
        <tbody>
          <tr><th>المجموع الفرعي</th><td>{amount(sale.subtotalCents)}</td></tr>
          <tr><th>خصم{sale.discountBasisPoints ? ` (${sale.discountBasisPoints / 100}%)` : ''}</th><td>{amount(sale.discountCents)}</td></tr>
          {sale.taxCents > 0 ? <tr><th>الضريبة المضافة ({taxPercent}%)</th><td>{amount(sale.taxCents)}</td></tr> : null}
          <tr className="invoice-grand"><th>المبلغ الكلي</th><td>{amount(sale.totalCents)}</td></tr>
          <tr><th>المدفوع</th><td>{amount(sale.paidCents)}</td></tr>
          <tr className="invoice-change"><th>الباقي</th><td>{amount(sale.changeCents)}</td></tr>
        </tbody>
      </table>
      <footer className="invoice-foot">
        <p className="invoice-thanks"><span />شكراً لثقتكم بنا<span /></p>
        <p>مع تمنياتنا لكم بالصحة والعافية</p>
      </footer>
    </article>
  )
}
