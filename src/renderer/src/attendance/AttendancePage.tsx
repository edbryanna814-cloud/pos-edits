import { useEffect, useState } from 'react'
import { ExportButton, useCan } from '../session'
import type { AttendanceDay, AttendanceImportResult, SellerKpi } from '../../../shared/attendance'
import type { Language } from '../../../shared/settings'
import { formatMoney } from '../money'

// Attendance from the fingerprint machine, and the sellers' KPIs for the dashboard.

const strings = {
  en: {
    title: 'Attendance',
    import: 'Import from the fingerprint machine',
    hint: 'On the machine: export the attendance log to a USB stick (Excel or attlog.dat), then choose that file here. People are matched by their user ID (Users page) = the machine’s user number. Importing the same file again adds nothing twice.',
    from: 'From', to: 'To',
    user: 'User', id: 'ID', day: 'Day', firstIn: 'Clock in', lastOut: 'Clock out', breaks: 'Breaks', worked: 'Worked',
    open: 'no clock-out', none: 'Nothing recorded in this period.',
    result: (r: AttendanceImportResult) => `Added ${r.added} punches${r.duplicates ? `, ${r.duplicates} already imported` : ''}${r.skipped ? `, ${r.skipped} unreadable rows skipped` : ''}.`,
    unknown: (n: number[]) => `Machine user numbers with no user here: ${n.join(', ')}. Give those people that user ID on the Users page.`,
    kpiTitle: 'Sellers',
    sales: 'Sales', money: 'Sold for', items: 'Items', returns: 'Returns', days: 'Days', hours: 'Hours',
    h: 'h', m: 'm',
    errors: {
      SHEET_TYPE_UNSUPPORTED: 'Choose an .xlsx, .csv, .txt or .dat file.',
      SHEET_UNREADABLE: 'The file could not be read.',
      SHEET_TOO_LARGE: 'The file is too large.',
      RANGE_INVALID: 'Choose a period of at most one year, "from" before "to".',
      other: 'Something went wrong.'
    } as Record<string, string>
  },
  ar: {
    title: 'الحضور',
    import: 'استيراد من جهاز البصمة',
    hint: 'من الجهاز: صدّر سجل الحضور إلى فلاشة (إكسل أو attlog.dat)، ثم اختر الملف هنا. تتم المطابقة برقم المستخدم (صفحة المستخدمين) = رقم المستخدم على الجهاز. استيراد نفس الملف مرة أخرى لا يكرر شيئًا.',
    from: 'من', to: 'إلى',
    user: 'المستخدم', id: 'الرقم', day: 'اليوم', firstIn: 'الحضور', lastOut: 'الانصراف', breaks: 'الاستراحات', worked: 'ساعات العمل',
    open: 'بدون انصراف', none: 'لا يوجد تسجيل في هذه الفترة.',
    result: (r: AttendanceImportResult) => `تمت إضافة ${r.added} بصمة${r.duplicates ? `، و${r.duplicates} مستوردة من قبل` : ''}${r.skipped ? `، وتخطي ${r.skipped} صف غير مقروء` : ''}.`,
    unknown: (n: number[]) => `أرقام على الجهاز بدون مستخدم هنا: ${n.join('، ')}. أعطِ هؤلاء الأشخاص هذا الرقم في صفحة المستخدمين.`,
    kpiTitle: 'البائعون',
    sales: 'المبيعات', money: 'القيمة', items: 'القطع', returns: 'المرتجعات', days: 'الأيام', hours: 'الساعات',
    h: 'س', m: 'د',
    errors: {
      SHEET_TYPE_UNSUPPORTED: 'اختر ملف .xlsx أو .csv أو .txt أو .dat.',
      SHEET_UNREADABLE: 'تعذّرت قراءة الملف.',
      SHEET_TOO_LARGE: 'الملف كبير جدًا.',
      RANGE_INVALID: 'اختر فترة لا تزيد عن سنة، وتاريخ البداية قبل النهاية.',
      other: 'حدث خطأ.'
    } as Record<string, string>
  }
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** This month so far. */
function thisMonth() {
  const now = new Date()
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) }
}

function useRange() {
  const [range, setRange] = useState(thisMonth)
  return { range, setRange }
}

function RangeInputs({ language, range, onChange }: { language: Language; range: { from: string; to: string }; onChange: (r: { from: string; to: string }) => void }) {
  const text = strings[language]
  return (
    <div className="range-inputs">
      <label><span>{text.from}</span><input type="date" value={range.from} onChange={(e) => onChange({ ...range, from: e.target.value })} /></label>
      <label><span>{text.to}</span><input type="date" value={range.to} onChange={(e) => onChange({ ...range, to: e.target.value })} /></label>
    </div>
  )
}

const hm = (minutes: number, language: Language) => `${Math.floor(minutes / 60)}${strings[language].h} ${String(minutes % 60).padStart(2, '0')}${strings[language].m}`
const clock = (value: string | null) => (value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')

function errorText(language: Language, err: unknown): string {
  const errors = strings[language].errors
  const m = err instanceof Error ? err.message : String(err)
  return errors[Object.keys(errors).find((k) => m.includes(k)) ?? 'other']
}

export default function AttendancePage({ language }: { language: Language }) {
  const text = strings[language]
  const { range, setRange } = useRange()
  const [days, setDays] = useState<AttendanceDay[]>([])
  const [message, setMessage] = useState('')
  const [warning, setWarning] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const canTransfer = useCan('data.transfer')

  async function load(): Promise<void> {
    try {
      setDays(await window.api.attendanceDays(range))
      setError('')
    } catch (err) {
      setError(errorText(language, err))
    }
  }

  useEffect(() => {
    void load()
  }, [range.from, range.to])

  async function importFile(): Promise<void> {
    setBusy(true)
    setMessage('')
    setWarning('')
    setError('')
    try {
      const r = await window.api.attendanceImport()
      if (r) {
        setMessage(text.result(r))
        if (r.unknownUserNos.length) setWarning(text.unknown(r.unknownUserNos))
        await load()
      }
    } catch (err) {
      setError(errorText(language, err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="attendance-title">
      <div className="section-header">
        <h2 id="attendance-title">{text.title}</h2>
        {canTransfer ? (
          <span className="section-actions">
            <ExportButton section="attendance" language={language} />
            <button type="button" className="primary" disabled={busy} onClick={() => void importFile()}>{text.import}</button>
          </span>
        ) : null}
      </div>
      {canTransfer ? <p className="hint">{text.hint}</p> : null}
      {message ? <p className="success" role="status">{message}</p> : null}
      {warning ? <p className="warning-text">{warning}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      <RangeInputs language={language} range={range} onChange={setRange} />
      {days.length === 0 ? (
        <div className="empty-state">{text.none}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>{text.day}</th><th>{text.id}</th><th>{text.user}</th><th>{text.firstIn}</th><th>{text.lastOut}</th><th>{text.breaks}</th><th>{text.worked}</th></tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={`${d.userNo}-${d.day}`}>
                  <td>{d.day}</td>
                  <td>{d.userNo}</td>
                  <td>{d.username}</td>
                  <td>{clock(d.firstIn)}</td>
                  <td>{d.open ? <span className="warning-text">{text.open}</span> : clock(d.lastOut)}</td>
                  <td>{hm(d.breakMinutes, language)}</td>
                  <td>{hm(d.workedMinutes, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** Dashboard: what each seller sold, for how much, and their hours (Manager and Administrator). */
export function SellerKpis({ language, currency }: { language: Language; currency: string }) {
  const text = strings[language]
  const { range, setRange } = useRange()
  const [rows, setRows] = useState<SellerKpi[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.kpiSellers(range).then((r) => { setRows(r); setError('') }, (err) => setError(errorText(language, err)))
  }, [range.from, range.to])

  return (
    <section className="panel" aria-labelledby="kpi-title">
      <h2 id="kpi-title">{text.kpiTitle}</h2>
      <RangeInputs language={language} range={range} onChange={setRange} />
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>{text.id}</th><th>{text.user}</th><th>{text.sales}</th><th>{text.money}</th><th>{text.items}</th><th>{text.returns}</th><th>{text.days}</th><th>{text.hours}</th><th>{text.breaks}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.username}>
                <td>{r.userNo ?? ''}</td>
                <td>{r.username} <small className="muted">{r.role}</small></td>
                <td>{r.salesCount}</td>
                <td>{formatMoney(r.salesCents, currency)}</td>
                <td>{r.itemsSold}</td>
                <td>{r.returnsCount ? `${r.returnsCount} · ${formatMoney(r.returnsCents, currency)}` : '0'}</td>
                <td>{r.daysPresent}</td>
                <td>{hm(r.workedMinutes, language)}</td>
                <td>{hm(r.breakMinutes, language)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
