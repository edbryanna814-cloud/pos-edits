import type { Sale } from '../../../shared/pos'
import { UNIT_NAMES } from '../units'
import logo from '../assets/logo.png'

// Printed invoice (Arabic, RTL). Barcode value = sale.barcode ?? invoiceNo (scannable lookup).

const amount = (cents: number) => (Math.round(cents) / 100).toFixed(2)
const date = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')} / ${String(d.getMonth() + 1).padStart(2, '0')} / ${d.getFullYear()}`
}

export function pharmacyTitle(name: string): string {
  const n = name.trim()
  return n.startsWith('صيدلية') ? n : `صيدلية ${n}`.trim()
}

function Logo() {
  return <img className="invoice-logo" src={logo} alt="" />
}

// Minimal Code39 barcode SVG (no deps). Supports A-Z 0-9 space - . $ / + %.
const C39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn',
  G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww',
  M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn',
  S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
  $: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn'
}

function Barcode({ value }: { value: string }) {
  const text = `*${String(value).toUpperCase()}*`
  let x = 0
  const narrow = 1
  const wide = 2.5
  const h = 36
  const rects: any[] = []
  for (let i = 0; i < text.length; i++) {
    const pat = C39[text[i]] || C39['-']
    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0
      const w = pat[j] === 'w' ? wide : narrow
      if (isBar) rects.push(<rect key={`${i}-${j}`} x={x} y={0} width={w} height={h} fill="#000" />)
      x += w
    }
    x += narrow
  }
  return (
    <div className="invoice-barcode" dir="ltr">
      <svg viewBox={`0 0 ${x} ${h}`} preserveAspectRatio="xMidYMid meet" height={h} style={{ width: '100%', maxWidth: 260 }}>
        {rects}
      </svg>
      <div className="invoice-barcode-text">{value}</div>
    </div>
  )
}

export default function InvoicePrint({
  sale,
  companyName,
  companyPhone,
  companyAddress,
  invoiceFooterNote,
  cashier
}: {
  sale: Sale
  companyName: string
  companyPhone: string
  companyAddress?: string
  invoiceFooterNote?: string
  cashier: string
}) {
  const taxPercent =
    sale.subtotalCents - sale.discountCents > 0
      ? Math.round((sale.taxCents * 10000) / (sale.subtotalCents - sale.discountCents)) / 100
      : 0
  const code = sale.barcode || sale.invoiceNo
  return (
    <article className="invoice" dir="rtl" lang="ar">
      <header className="invoice-head">
        <div className="invoice-title">
          <h1>{pharmacyTitle(companyName)}</h1>
        </div>
        <Logo />
      </header>
      <Barcode value={code} />
      <hr />
      <section className="invoice-meta">
        <div><span>رقم الفاتورة :</span><b className="invoice-box" dir="ltr">{sale.invoiceNo}</b></div>
        <div><span>اسم العميل :</span><b>{sale.customerName || '....................'}</b></div>
        <div><span>التاريخ :</span><b className="invoice-box" dir="ltr">{date(sale.createdAt)}</b></div>
        <div><span>رقم الهاتف :</span><b dir="ltr">{sale.customerPhone || '....................'}</b></div>
        <div><span>البائع :</span><b>{sale.cashierUsername ?? cashier}</b></div>
      </section>
      <hr />
      <table className="invoice-items">
        <thead>
          <tr><th>م</th><th>اسم الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>
        </thead>
        <tbody>
          {sale.lines.map((line, i) => {
            const returned = line.returnedQuantity ?? 0
            return (
              <tr key={`${line.productId}:${i}`}>
                <td>{i + 1}</td>
                <td className="invoice-name">
                  {line.productName}
                  {returned > 0 ? <small className="block-muted">مرتجع: {returned}/{line.quantity}</small> : null}
                </td>
                <td>{line.quantity}{line.saleUnit && line.saleUnit !== 'base' ? ` ${UNIT_NAMES.ar[line.saleUnit as 'box' | 'strip' | 'pill'] ?? ''}` : ''}</td>
                <td>{amount(line.unitPriceCents)}</td>
                <td>{amount(line.lineTotalCents)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <table className="invoice-totals">
        <tbody>
          <tr><th>المجموع الفرعي</th><td>{amount(sale.subtotalCents)}</td></tr>
          <tr><th>خصم{sale.discountBasisPoints ? ` (${sale.discountBasisPoints / 100}%)` : ''}</th><td>{amount(sale.discountCents)}</td></tr>
          {sale.taxCents > 0 ? <tr><th>الضريبة ({taxPercent}%)</th><td>{amount(sale.taxCents)}</td></tr> : null}
          <tr className="invoice-grand"><th>المبلغ الكلي</th><td>{amount(sale.totalCents)}</td></tr>
          <tr><th>المدفوع</th><td>{amount(sale.paidCents)}</td></tr>
          <tr className="invoice-change"><th>الباقي</th><td>{amount(sale.changeCents)}</td></tr>
          {(sale.refundedCents ?? 0) > 0 ? <tr><th>المسترد</th><td>{amount(sale.refundedCents ?? 0)}</td></tr> : null}
        </tbody>
      </table>
      <footer className="invoice-foot">
        <p className="invoice-thanks"><strong>ANUBIS</strong> — {companyName}</p>
        {companyPhone ? <p dir="ltr">{companyPhone}</p> : null}
        {companyAddress ? <p>{companyAddress}</p> : null}
        {invoiceFooterNote ? <p>{invoiceFooterNote}</p> : null}
      </footer>
    </article>
  )
}