import { useState } from 'react'
import type { Language } from '../../../shared/settings'

// Sales and purchasing reports as Excel for a date range (Manager and Administrator).

const strings = {
  en: {
    title: 'Download a report (Excel)',
    from: 'From',
    to: 'To',
    sales: 'Sales report',
    purchasing: 'Purchasing report',
    done: (n: number, file: string) => `Saved ${file} (${n} records).`,
    range: 'Choose a period of at most one year, with “From” before “To”.',
    failed: 'The report could not be saved.'
  },
  ar: {
    title: 'تنزيل تقرير (إكسل)',
    from: 'من',
    to: 'إلى',
    sales: 'تقرير المبيعات',
    purchasing: 'تقرير المشتريات',
    done: (n: number, file: string) => `تم حفظ ${file} (${n} سجل).`,
    range: 'اختر فترة لا تزيد عن سنة، وتاريخ «من» قبل «إلى».',
    failed: 'تعذّر حفظ التقرير.'
  }
}

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function ReportDownloads({ language }: { language: Language }) {
  const text = strings[language]
  const now = new Date()
  const [from, setFrom] = useState(day(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [to, setTo] = useState(day(now))
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  async function download(kind: 'sales' | 'purchasing'): Promise<void> {
    setBusy(true)
    setNote('')
    try {
      const r = await window.api.reportExport(kind, { from, to })
      if (r) setNote(text.done(r.count, r.fileName))
    } catch (err) {
      setNote(String(err).includes('RANGE_INVALID') ? text.range : text.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel report-downloads">
      <h3>{text.title}</h3>
      <div className="form-actions">
        <label>
          <span>{text.from}</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          <span>{text.to}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" disabled={busy} onClick={() => void download('sales')}>{text.sales}</button>
        <button type="button" disabled={busy} onClick={() => void download('purchasing')}>{text.purchasing}</button>
      </div>
      {note ? <p className="muted" role="status">{note}</p> : null}
    </section>
  )
}
