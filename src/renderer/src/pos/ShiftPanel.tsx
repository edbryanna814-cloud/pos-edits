import { useEffect, useState } from 'react'
import type { CashierShift } from '../../../shared/pos'
import type { Language } from '../../../shared/settings'
import { formatDateTime, formatMoney, parseMoney } from '../money'

interface Props {
  language: Language
  currency: string
  cashier: string
  onChanged: () => void
}

const copy = {
  en: {
    title: 'Cashier shifts',
    intro: 'Open a shift before collecting cash, then close it at the end of the day.',
    current: 'Current shift',
    noShift: 'No shift is open.',
    openedAt: 'Opened',
    openingBalance: 'Opening balance',
    close: 'Close shift',
    closing: 'Closing...',
    open: 'Open shift',
    opening: 'Opening...',
    openingBalanceLabel: 'Opening balance',
    history: 'Shift history',
    noHistory: 'No shifts recorded yet.',
    cashier: 'Cashier',
    status: 'Status',
    closedAt: 'Closed',
    closingBalance: 'Closing balance',
    openStatus: 'Open',
    closedStatus: 'Closed',
    amountInvalid: 'Enter a valid opening balance.',
    error: 'Could not update the shift',
    columns: ['Cashier', 'Opened', 'Opening', 'Closed', 'Closing', 'Status']
  },
  ar: {
    title: 'ورديات الكاشير',
    intro: 'افتح الوردية قبل تحصيل النقد ثم أغلقها في نهاية اليوم.',
    current: 'الوردية الحالية',
    noShift: 'لا توجد وردية مفتوحة.',
    openedAt: 'وقت الفتح',
    openingBalance: 'الرصيد الافتتاحي',
    close: 'إغلاق الوردية',
    closing: 'جارٍ الإغلاق...',
    open: 'فتح وردية',
    opening: 'جارٍ الفتح...',
    openingBalanceLabel: 'الرصيد الافتتاحي',
    history: 'سجل الورديات',
    noHistory: 'لا توجد ورديات مسجلة بعد.',
    cashier: 'الكاشير',
    status: 'الحالة',
    closedAt: 'وقت الإغلاق',
    closingBalance: 'رصيد الإغلاق',
    openStatus: 'مفتوحة',
    closedStatus: 'مغلقة',
    amountInvalid: 'أدخل رصيداً افتتاحياً صحيحاً.',
    error: 'تعذر تحديث الوردية',
    columns: ['الكاشير', 'وقت الفتح', 'الافتتاحي', 'وقت الإغلاق', 'رصيد الإغلاق', 'الحالة']
  }
} as const

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function ShiftPanel({ language, currency, cashier, onChanged }: Props) {
  const text = copy[language]
  const [shifts, setShifts] = useState<CashierShift[]>([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState('0.00')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load(): Promise<void> {
    setLoading(true)
    try {
      setShifts(await window.api.posShiftsList())
    } catch (loadError) {
      setError(`${text.error}: ${message(loadError)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const openShift = shifts.find((shift) => shift.status === 'open') ?? null

  async function handleOpen(): Promise<void> {
    const cents = parseMoney(balance)
    if (cents === null || cents < 0) return setError(text.amountInvalid)
    setBusy(true)
    setError('')
    try {
      await window.api.posShiftOpen(cents)
      setBalance('0.00')
      await load()
      onChanged()
    } catch (openError) {
      setError(`${text.error}: ${message(openError)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleClose(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      await window.api.posShiftClose()
      await load()
      onChanged()
    } catch (closeError) {
      setError(`${text.error}: ${message(closeError)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel shift-panel" aria-labelledby="shift-title">
      <div className="section-header">
        <div>
          <h3 id="shift-title">{text.title}</h3>
          <p className="muted">{text.intro}</p>
        </div>
        <span className={`tag ${openShift ? 'ok-tag' : ''}`}>
          {openShift ? text.openStatus : text.noShift}
        </span>
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}

      {openShift ? (
        <div className="shift-current">
          <dl className="status-grid">
            <div>
              <dt>{text.cashier}</dt>
              <dd>{openShift.cashierUsername || cashier}</dd>
            </div>
            <div>
              <dt>{text.openedAt}</dt>
              <dd>{formatDateTime(openShift.openedAt, language)}</dd>
            </div>
            <div>
              <dt>{text.openingBalance}</dt>
              <dd>{formatMoney(openShift.openingBalanceCents, currency)}</dd>
            </div>
          </dl>
          <button type="button" className="primary" onClick={() => void handleClose()} disabled={busy}>
            {busy ? text.closing : text.close}
          </button>
        </div>
      ) : (
        <div className="cash-form">
          <label>
            <span>{text.openingBalanceLabel}</span>
            <input inputMode="decimal" value={balance} onChange={(event) => setBalance(event.target.value)} placeholder="0.00" />
          </label>
          <div className="form-actions">
            <button type="button" className="primary" onClick={() => void handleOpen()} disabled={busy || loading}>
              {busy ? text.opening : text.open}
            </button>
          </div>
        </div>
      )}

      <h4>{text.history}</h4>
      {shifts.length === 0 ? (
        <div className="empty-state">{text.noHistory}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr>
                {text.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift._id ?? shift.openedAt}>
                  <td>{shift.cashierUsername || '-'}</td>
                  <td>{formatDateTime(shift.openedAt, language)}</td>
                  <td>{formatMoney(shift.openingBalanceCents, currency)}</td>
                  <td>{shift.closedAt ? formatDateTime(shift.closedAt, language) : '-'}</td>
                  <td>{shift.closingBalanceCents != null ? formatMoney(shift.closingBalanceCents, currency) : '-'}</td>
                  <td>
                    <span className={`tag ${shift.status === 'open' ? 'ok-tag' : ''}`}>
                      {shift.status === 'open' ? text.openStatus : text.closedStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
