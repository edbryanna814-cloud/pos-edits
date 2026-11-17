import { useEffect, useState } from 'react'
import type { Customer } from '../../../shared/customers'
import type { Language } from '../../../shared/settings'
import { customerErrorText, matchesCustomer, percentInput } from '../customers/CustomersPage'

// POS: choose the customer for this sale (their discount % fills in), or add one on the spot.

const strings = {
  en: { customer: 'Customer', walkIn: 'Walk-in customer', search: 'Search name, ID or phone', clear: 'Remove', add: 'New customer', name: 'Name', phone: 'Phone number', nationalId: 'ID number', discount: 'Discount (%)', save: 'Add and choose' },
  ar: { customer: 'العميل', walkIn: 'عميل نقدي', search: 'ابحث بالاسم أو الهوية أو الهاتف', clear: 'إزالة', add: 'عميل جديد', name: 'الاسم', phone: 'رقم الهاتف', nationalId: 'رقم الهوية', discount: 'الخصم (%)', save: 'إضافة واختيار' }
} as const

const label = (c: Customer) => [c.name, c.phone, c.nationalId].filter(Boolean).join(' · ')

export default function CustomerPicker({ language, selected, onSelect }: { language: Language; selected: Customer | null; onSelect: (c: Customer | null) => void }) {
  const text = strings[language]
  const [customers, setCustomers] = useState<Customer[]>([])
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', nationalId: '', discount: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.customersList().then(setCustomers).catch(() => setCustomers([]))
  }, [])

  async function add(): Promise<void> {
    setError('')
    try {
      const created = await window.api.customersCreate({ ...form, discountBasisPoints: percentInput(form.discount) })
      setCustomers((list) => [...list, created])
      setAdding(false)
      setForm({ name: '', phone: '', nationalId: '', discount: '' })
      onSelect(created)
    } catch (err) {
      setError(customerErrorText(language, err))
    }
  }

  if (selected) {
    return (
      <div className="cart-field customer-chosen">
        <span>{text.customer}</span>
        <strong>{label(selected)}</strong>
        <button type="button" className="link-button" onClick={() => onSelect(null)}>{text.clear}</button>
      </div>
    )
  }

  const matches = query.trim() ? customers.filter((c) => matchesCustomer(c, query)).slice(0, 6) : []
  return (
    <div className="cart-field customer-picker">
      <span>{text.customer}</span>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${text.walkIn} · ${text.search}`} aria-label={text.customer} />
      {matches.map((c) => (
        <button key={c._id} type="button" className="link-button" onClick={() => { onSelect(c); setQuery('') }}>
          {label(c)}{c.discountBasisPoints ? ` (−${c.discountBasisPoints / 100}%)` : ''}
        </button>
      ))}
      {adding ? (
        <div className="customer-add">
          <input placeholder={text.name} aria-label={text.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder={text.phone} aria-label={text.phone} dir="ltr" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder={text.nationalId} aria-label={text.nationalId} value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
          <input placeholder={text.discount} aria-label={text.discount} inputMode="decimal" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
          <button type="button" onClick={() => void add()}>{text.save}</button>
        </div>
      ) : (
        <button type="button" className="link-button" onClick={() => setAdding(true)}>+ {text.add}</button>
      )}
      {error ? <p className="error" role="alert">{error}</p> : null}
    </div>
  )
}
