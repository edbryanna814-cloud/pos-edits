import { useEffect, useState, type FormEvent } from 'react'
import { confirmDelete, deleteLabel } from '../confirmDelete'
import { ExportButton, RecordId } from '../session'
import type { Customer } from '../../../shared/customers'
import type { Language } from '../../../shared/settings'

const strings = {
  en: {
    title: 'Customers',
    add: 'Add customer',
    edit: 'Edit customer',
    name: 'Name',
    nationalId: 'ID number',
    phone: 'Phone number',
    email: 'Email',
    address: 'Address',
    notes: 'Notes',
    discount: 'Discount (%)',
    active: 'Active',
    archived: 'Archived',
    save: 'Save customer',
    cancel: 'Cancel',
    search: 'Search by name, ID, phone, email or address',
    none: 'No customers yet.',
    saved: 'Saved.',
    archivedMsg: 'Customer archived.',
    restore: 'Restore',
    errors: {
      CUSTOMER_EMPTY: 'Fill at least one of name, ID number, phone number or email.',
      CUSTOMER_PHONE_INVALID: 'The phone number can hold digits, spaces, dashes and a leading +.',
      CUSTOMER_EMAIL_INVALID: 'Enter a valid email address.',
      CUSTOMER_DISCOUNT_INVALID: 'The discount must be from 0 to 100%.',
      other: 'The customer could not be saved.'
    }
  },
  ar: {
    title: 'العملاء',
    add: 'إضافة عميل',
    edit: 'تعديل عميل',
    name: 'الاسم',
    nationalId: 'رقم الهوية',
    phone: 'رقم الهاتف',
    email: 'البريد الإلكتروني',
    address: 'العنوان',
    notes: 'ملاحظات',
    discount: 'الخصم (%)',
    active: 'نشط',
    archived: 'مؤرشف',
    save: 'حفظ العميل',
    cancel: 'إلغاء',
    search: 'ابحث بالاسم أو الهوية أو الهاتف أو البريد أو العنوان',
    none: 'لا يوجد عملاء بعد.',
    saved: 'تم الحفظ.',
    archivedMsg: 'تمت أرشفة العميل.',
    restore: 'استعادة',
    errors: {
      CUSTOMER_EMPTY: 'املأ واحدًا على الأقل من الاسم أو رقم الهوية أو رقم الهاتف أو البريد الإلكتروني.',
      CUSTOMER_PHONE_INVALID: 'رقم الهاتف يقبل الأرقام والمسافات والشرطات و + في البداية.',
      CUSTOMER_EMAIL_INVALID: 'أدخل بريدًا إلكترونيًا صحيحًا.',
      CUSTOMER_DISCOUNT_INVALID: 'يجب أن يكون الخصم من 0 إلى 100%.',
      other: 'تعذر حفظ العميل.'
    }
  }
} as const

type ErrorCode = keyof (typeof strings)['en']['errors']

/** "12.5" -> 1250; '' -> 0; anything else -> NaN (the server refuses it with a clear code). */
export const percentInput = (value: string) => (value.trim() ? Math.round(Number(value.replace(',', '.')) * 100) : 0)
export const percentText = (basisPoints: number) => (basisPoints ? String(basisPoints / 100) : '')

export function customerErrorText(language: Language, err: unknown): string {
  const text = strings[language]
  const message = err instanceof Error ? err.message : String(err)
  const found = (Object.keys(text.errors) as ErrorCode[]).find((key) => key !== 'other' && message.includes(key))
  return text.errors[found ?? 'other']
}

export function matchesCustomer(customer: Customer, query: string): boolean {
  const q = query.trim().toLowerCase()
  return !q || [customer.name, customer.nationalId, customer.phone, customer.email ?? '', customer.address ?? '', customer.notes ?? ''].some((v) => String(v).toLowerCase().includes(q))
}

const emptyForm = { name: '', nationalId: '', phone: '', email: '', address: '', notes: '', discount: '', active: true }

export default function CustomersPage({ language }: { language: Language }) {
  const text = strings[language]
  const [customers, setCustomers] = useState<Customer[]>([])
  const [editing, setEditing] = useState<Customer | 'new' | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  async function load(): Promise<void> {
    setCustomers(await window.api.customersList())
  }

  useEffect(() => {
    void load().catch(() => setError(text.errors.other))
  }, [])

  function open(customer: Customer | 'new'): void {
    setEditing(customer)
    setError('')
    setSuccess('')
    setForm(customer === 'new'
      ? { ...emptyForm }
      : {
          name: customer.name,
          nationalId: customer.nationalId,
          phone: customer.phone,
          email: customer.email ?? '',
          address: customer.address ?? '',
          notes: customer.notes ?? '',
          discount: percentText(customer.discountBasisPoints),
          active: customer.active !== false
        })
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const input = {
        name: form.name,
        nationalId: form.nationalId,
        phone: form.phone,
        email: form.email,
        address: form.address,
        notes: form.notes,
        discountBasisPoints: percentInput(form.discount),
        active: form.active
      }
      if (editing && editing !== 'new' && editing._id) await window.api.customersUpdate(editing._id, input)
      else await window.api.customersCreate(input)
      setEditing(null)
      setSuccess(text.saved)
      await load()
    } catch (err) {
      setError(customerErrorText(language, err))
    } finally {
      setBusy(false)
    }
  }

  async function archive(customer: Customer): Promise<void> {
    setError('')
    setSuccess('')
    const err = await confirmDelete(language, customer.name || customer.phone || customer.nationalId, () => window.api.customersDelete(customer._id as string), () => void load())
    if (err) setError(err)
    else setSuccess(text.archivedMsg)
  }

  async function restore(customer: Customer): Promise<void> {
    setError('')
    setSuccess('')
    try {
      await window.api.customersUpdate(customer._id as string, {
        name: customer.name,
        nationalId: customer.nationalId,
        phone: customer.phone,
        email: customer.email ?? '',
        address: customer.address ?? '',
        notes: customer.notes ?? '',
        discountBasisPoints: customer.discountBasisPoints,
        active: true
      })
      setSuccess(text.saved)
      await load()
    } catch (err) {
      setError(customerErrorText(language, err))
    }
  }

  const shown = customers.filter((c) => matchesCustomer(c, query))

  return (
    <section className="panel" aria-labelledby="customers-title">
      <div className="section-header">
        <h2 id="customers-title">{text.title}</h2>
        <span className="section-actions">
          <ExportButton section="customers" language={language} />
          <button type="button" className="primary" onClick={() => open('new')}>{text.add}</button>
        </span>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {success ? <p className="success" role="status">{success}</p> : null}
      {editing ? (
        <form className="crud-form" onSubmit={(e) => void submit(e)}>
          <h3>{editing === 'new' ? text.add : text.edit}</h3>
          <div className="crud-grid">
            <label><span>{text.name}</span><input value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label><span>{text.nationalId}</span><input value={form.nationalId} maxLength={40} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} /></label>
            <label><span>{text.phone}</span><input dir="ltr" inputMode="tel" value={form.phone} maxLength={30} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label><span>{text.email}</span><input dir="ltr" type="email" value={form.email} maxLength={120} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label><span>{text.address}</span><input value={form.address} maxLength={240} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label><span>{text.notes}</span><input value={form.notes} maxLength={500} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <label><span>{text.discount}</span><input inputMode="decimal" value={form.discount} placeholder="0" onChange={(e) => setForm({ ...form, discount: e.target.value })} /></label>
            <label className="checkbox-field"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /><span>{text.active}</span></label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary" disabled={busy}>{text.save}</button>
            <button type="button" onClick={() => setEditing(null)}>{text.cancel}</button>
          </div>
        </form>
      ) : null}
      <input className="user-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={text.search} aria-label={text.search} />
      {shown.length === 0 ? (
        <div className="empty-state">{text.none}</div>
      ) : (
        <table>
          <thead>
            <tr><th>{text.name}</th><th>{text.nationalId}</th><th>{text.phone}</th><th>{text.email}</th><th>{text.discount}</th><th>{text.active}</th><th /></tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c._id}>
                <td>{c.name}<RecordId id={c._id} /></td>
                <td>{c.nationalId}</td>
                <td dir="ltr">{c.phone}</td>
                <td dir="ltr">{c.email ?? ''}</td>
                <td>{c.discountBasisPoints ? `${c.discountBasisPoints / 100}%` : ''}</td>
                <td><span className={`tag ${c.active === false ? '' : 'ok-tag'}`}>{c.active === false ? text.archived : text.active}</span></td>
                <td>
                  <button type="button" onClick={() => open(c)}>{text.edit}</button>
                  {c.active === false ? (
                    <button type="button" className="link-button" onClick={() => void restore(c)}>{text.restore}</button>
                  ) : (
                    <button type="button" className="danger-text" onClick={() => void archive(c)}>{deleteLabel(language)}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
