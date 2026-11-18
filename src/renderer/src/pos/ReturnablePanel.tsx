import { useEffect, useState } from 'react'
import type { ReturnableLine } from '../../../shared/returns'
import type { Language } from '../../../shared/settings'
import { formatDateTime, formatMoney } from '../money'
import { UNIT_NAMES } from '../units'

const strings = {
  en: {
    title: 'Returnable items',
    search: 'Search invoice, product or customer',
    reason: 'Reason (optional)',
    defaultReason: 'Customer return',
    invoice: 'Invoice',
    product: 'Product',
    qty: 'Qty',
    refund: 'Refund',
    until: 'Returnable until',
    return: 'Return',
    none: 'Nothing can be returned right now.',
    done: 'Returned',
    errors: {
      RETURN_NOT_ALLOWED: 'This product cannot be returned.',
      RETURN_PERIOD_OVER: 'The return period has ended.',
      RETURN_QTY_INVALID: 'Invalid return quantity.',
      other: 'The return failed.'
    } as Record<string, string>
  },
  ar: {
    title: 'عناصر قابلة للإرجاع',
    search: 'ابحث برقم الفاتورة أو المنتج أو العميل',
    reason: 'السبب (اختياري)',
    defaultReason: 'إرجاع من العميل',
    invoice: 'الفاتورة',
    product: 'المنتج',
    qty: 'الكمية',
    refund: 'المبلغ',
    until: 'قابل للإرجاع حتى',
    return: 'إرجاع',
    none: 'لا يوجد ما يمكن إرجاعه الآن.',
    done: 'تم الإرجاع',
    errors: {
      RETURN_NOT_ALLOWED: 'هذا المنتج غير قابل للإرجاع.',
      RETURN_PERIOD_OVER: 'انتهت مدة الإرجاع.',
      RETURN_QTY_INVALID: 'كمية الإرجاع غير صالحة.',
      other: 'فشل الإرجاع.'
    } as Record<string, string>
  }
}

export function returnErrorText(language: Language, err: unknown): string | null {
  const m = err instanceof Error ? err.message : String(err)
  const key = Object.keys(strings[language].errors).find((k) => m.includes(k))
  return key ? strings[language].errors[key] : null
}

export default function ReturnablePanel({
  language,
  currency,
  refreshKey,
  onReturned
}: {
  language: Language
  currency: string
  refreshKey: unknown
  onReturned: () => void
}) {
  const text = strings[language]
  const [items, setItems] = useState<ReturnableLine[]>([])
  const [query, setQuery] = useState('')
  const [reason, setReason] = useState('')
  const [qtyByKey, setQtyByKey] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = () =>
    window.api
      .posReturnable()
      .then((list) => {
        setItems(list)
        setQtyByKey((prev) => {
          const next: Record<string, number> = {}
          for (const i of list) {
            const k = `${i.saleId}:${i.lineIndex}`
            next[k] = Math.min(Math.max(1, prev[k] ?? i.quantity), i.quantity)
          }
          return next
        })
      })
      .catch(() => setItems([]))

  useEffect(() => {
    void load()
  }, [refreshKey])

  async function giveBack(item: ReturnableLine): Promise<void> {
    const key = `${item.saleId}:${item.lineIndex}`
    const take = Math.max(1, Math.min(Math.trunc(qtyByKey[key] ?? item.quantity), item.quantity))
    setBusy(key)
    setError('')
    setMessage('')
    try {
      const ret = await window.api.posReturn({
        saleId: item.saleId,
        lineIndex: item.lineIndex,
        quantity: take,
        reason: reason.trim() || text.defaultReason
      })
      setMessage(`${text.done} ${item.productName} ×${take} — ${formatMoney(ret.refundCents, currency)}`)
      await load()
      onReturned()
    } catch (err) {
      setError(returnErrorText(language, err) ?? text.errors.other)
    } finally {
      setBusy('')
    }
  }

  const q = query.trim().toLowerCase()
  const shown = items.filter(
    (i) => !q || [i.invoiceNo, i.productName, i.customerName ?? ''].some((v) => v.toLowerCase().includes(q))
  )

  return (
    <section className="panel" aria-labelledby="returnable-title">
      <h3 id="returnable-title">{text.title}</h3>
      <div className="range-inputs">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={text.search} aria-label={text.search} />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={text.reason} aria-label={text.reason} maxLength={120} />
      </div>
      {message ? <p className="success" role="status">{message}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {shown.length === 0 ? (
        <div className="empty-state">{text.none}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{text.invoice}</th>
                <th>{text.product}</th>
                <th>{text.qty}</th>
                <th>{text.refund}</th>
                <th>{text.until}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const key = `${i.saleId}:${i.lineIndex}`
                return (
                  <tr key={key}>
                    <td>
                      {i.invoiceNo}
                      {i.customerName ? <small className="block-muted">{i.customerName}</small> : null}
                    </td>
                    <td>{i.productName}</td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={i.quantity}
                        value={qtyByKey[key] ?? i.quantity}
                        onChange={(e) =>
                          setQtyByKey((m) => ({
                            ...m,
                            [key]: Math.max(1, Math.min(i.quantity, Math.trunc(Number(e.target.value) || 1)))
                          }))
                        }
                        style={{ width: 64 }}
                        aria-label={text.qty}
                      />
                      {i.saleUnit && i.saleUnit !== 'base' ? (
                        <small className="block-muted">/ {i.quantity} {UNIT_NAMES[language][i.saleUnit as 'box' | 'strip' | 'pill'] ?? ''}</small>
                      ) : (
                        <small className="block-muted">/ {i.quantity}</small>
                      )}
                    </td>
                    <td>{formatMoney(i.refundCents, currency)}</td>
                    <td>{formatDateTime(i.deadline, language)}</td>
                    <td>
                      <button type="button" disabled={busy !== ''} onClick={() => void giveBack(i)}>
                        {text.return}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}