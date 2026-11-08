import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Activity, Contact, Customer, Deal, Lead, Note } from '../../../shared/crm'
import type { Sale } from '../../../shared/pos'
import type { Language } from '../../../shared/settings'
import { formatDateTime, formatMoney } from '../money'

interface Props {
  language: Language
  currency: string
}

type Tab = 'customers' | 'leads' | 'deals' | 'activities'

const copy = {
  en: {
    title: 'Customers & relationships',
    intro: 'Keep customer profiles, contacts, notes, leads, deals, and follow-ups in one place.',
    customers: 'Customers',
    leads: 'Leads',
    deals: 'Deals',
    activities: 'Activities',
    add: 'Add',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    edit: 'Edit',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    company: 'Company',
    category: 'Category',
    tags: 'Tags (comma separated)',
    notes: 'Notes',
    active: 'Active',
    source: 'Source',
    status: 'Status',
    titleLabel: 'Title',
    value: 'Value',
    currency: 'Currency',
    stage: 'Stage',
    customer: 'Customer',
    type: 'Type',
    subject: 'Subject',
    dueDate: 'Due date',
    done: 'Done',
    noCustomers: 'No customers yet.',
    noLeads: 'No leads yet.',
    noDeals: 'No deals yet.',
    noActivities: 'No activities yet.',
    selectedCustomer: 'Selected customer',
    chooseCustomer: 'Choose a customer above to manage contacts and notes.',
    contacts: 'Contacts',
    addContact: 'Add contact',
    contactName: 'Contact name',
    role: 'Role',
    primary: 'Primary contact',
    noContacts: 'No contacts for this customer.',
    notesTitle: 'Notes',
    addNote: 'Add note',
    noteContent: 'Note',
    noNotes: 'No notes for this customer.',
    purchaseHistory: 'Purchase history',
    noPurchases: 'No purchases for this customer yet.',
    invoice: 'Invoice',
    total: 'Total',
    timeline: 'Timeline',
    noTimeline: 'No activity for this customer yet.',
    nameRequired: 'Name is required.',
    titleRequired: 'Title is required.',
    subjectRequired: 'Subject is required.',
    noteRequired: 'Write a note first.',
    customerRequired: 'Choose a customer.',
    error: 'Could not save',
    saved: 'Saved successfully.',
    columns: {
      customers: ['Name', 'Company', 'Phone', 'Category', 'Status', ''],
      leads: ['Name', 'Source', 'Status', 'Phone', 'Created'],
      deals: ['Title', 'Customer', 'Stage', 'Value', 'Created'],
      activities: ['Subject', 'Type', 'Customer', 'Due', 'Done']
    },
    statuses: {
      new: 'New',
      contacted: 'Contacted',
      qualified: 'Qualified',
      lost: 'Lost',
      converted: 'Converted',
      prospect: 'Prospect',
      proposal: 'Proposal',
      negotiation: 'Negotiation',
      won: 'Won'
    },
    activityTypes: { call: 'Call', email: 'Email', meeting: 'Meeting', task: 'Task' },
    createdBy: 'Created by'
  },
  ar: {
    title: 'العملاء والعلاقات',
    intro: 'احتفظ بملفات العملاء وجهات الاتصال والملاحظات والعملاء المحتملين والفرص والمتابعات في مكان واحد.',
    customers: 'العملاء',
    leads: 'العملاء المحتملون',
    deals: 'الفرص',
    activities: 'المتابعات',
    add: 'إضافة',
    cancel: 'إلغاء',
    save: 'حفظ',
    saving: 'جارٍ الحفظ...',
    edit: 'تعديل',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    company: 'الشركة',
    category: 'الفئة',
    tags: 'الوسوم (مفصولة بفواصل)',
    notes: 'ملاحظات',
    active: 'نشط',
    source: 'المصدر',
    status: 'الحالة',
    titleLabel: 'العنوان',
    value: 'القيمة',
    currency: 'العملة',
    stage: 'المرحلة',
    customer: 'العميل',
    type: 'النوع',
    subject: 'الموضوع',
    dueDate: 'تاريخ الاستحقاق',
    done: 'تم',
    noCustomers: 'لا يوجد عملاء بعد.',
    noLeads: 'لا يوجد عملاء محتملون بعد.',
    noDeals: 'لا توجد فرص بعد.',
    noActivities: 'لا توجد متابعات بعد.',
    selectedCustomer: 'العميل المحدد',
    chooseCustomer: 'اختر عميلاً من الأعلى لإدارة جهات الاتصال والملاحظات.',
    contacts: 'جهات الاتصال',
    addContact: 'إضافة جهة اتصال',
    contactName: 'اسم جهة الاتصال',
    role: 'الدور',
    primary: 'جهة الاتصال الرئيسية',
    noContacts: 'لا توجد جهات اتصال لهذا العميل.',
    notesTitle: 'الملاحظات',
    addNote: 'إضافة ملاحظة',
    noteContent: 'الملاحظة',
    noNotes: 'لا توجد ملاحظات لهذا العميل.',
    purchaseHistory: 'سجل المشتريات',
    noPurchases: 'لا توجد مشتريات لهذا العميل بعد.',
    invoice: 'الفاتورة',
    total: 'الإجمالي',
    timeline: 'الخط الزمني',
    noTimeline: 'لا يوجد نشاط لهذا العميل بعد.',
    nameRequired: 'الاسم مطلوب.',
    titleRequired: 'العنوان مطلوب.',
    subjectRequired: 'الموضوع مطلوب.',
    noteRequired: 'اكتب ملاحظة أولاً.',
    customerRequired: 'اختر عميلاً.',
    error: 'تعذر الحفظ',
    saved: 'تم الحفظ بنجاح.',
    columns: {
      customers: ['الاسم', 'الشركة', 'الهاتف', 'الفئة', 'الحالة', ''],
      leads: ['الاسم', 'المصدر', 'الحالة', 'الهاتف', 'التاريخ'],
      deals: ['العنوان', 'العميل', 'المرحلة', 'القيمة', 'التاريخ'],
      activities: ['الموضوع', 'النوع', 'العميل', 'الاستحقاق', 'تم']
    },
    statuses: {
      new: 'جديد',
      contacted: 'تم التواصل',
      qualified: 'مؤهل',
      lost: 'خسارة',
      converted: 'تم التحويل',
      prospect: 'احتمال',
      proposal: 'عرض',
      negotiation: 'تفاوض',
      won: 'فوز'
    },
    activityTypes: { call: 'اتصال', email: 'بريد', meeting: 'اجتماع', task: 'مهمة' },
    createdBy: 'أنشأه'
  }
} as const

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface CustomerForm {
  name: string
  email: string
  phone: string
  company: string
  category: string
  tags: string
  notes: string
  active: boolean
}

interface LeadForm {
  name: string
  email: string
  phone: string
  source: string
  status: Lead['status']
  notes: string
}

interface DealForm {
  customerId: string
  title: string
  value: string
  currency: string
  stage: Deal['stage']
  notes: string
}

interface ActivityForm {
  customerId: string
  type: Activity['type']
  subject: string
  dueDate: string
  notes: string
  done: boolean
}

interface ContactForm {
  name: string
  email: string
  phone: string
  role: string
  primary: boolean
}

const emptyCustomer = (): CustomerForm => ({ name: '', email: '', phone: '', company: '', category: '', tags: '', notes: '', active: true })
const emptyLead = (): LeadForm => ({ name: '', email: '', phone: '', source: '', status: 'new', notes: '' })
const emptyDeal = (): DealForm => ({ customerId: '', title: '', value: '', currency: '', stage: 'prospect', notes: '' })
const emptyActivity = (): ActivityForm => ({ customerId: '', type: 'task', subject: '', dueDate: '', notes: '', done: false })
const emptyContact = (): ContactForm => ({ name: '', email: '', phone: '', role: '', primary: false })

export default function CrmPage({ language, currency }: Props) {
  const text = copy[language]
  const [tab, setTab] = useState<Tab>('customers')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [purchases, setPurchases] = useState<Sale[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerForm, setCustomerForm] = useState<CustomerForm | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [leadForm, setLeadForm] = useState<LeadForm | null>(null)
  const [dealForm, setDealForm] = useState<DealForm | null>(null)
  const [activityForm, setActivityForm] = useState<ActivityForm | null>(null)
  const [contactForm, setContactForm] = useState<ContactForm | null>(null)
  const [noteContent, setNoteContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const timeline = useMemo(() => {
    const items: { id: string; at: string; label: string }[] = []
    for (const note of notes) {
      items.push({ id: `note-${note._id ?? note.createdAt}`, at: note.createdAt, label: note.content })
    }
    for (const activity of activities) {
      if (activity.customerId !== selectedCustomerId) continue
      items.push({
        id: `activity-${activity._id ?? activity.subject}`,
        at: activity.createdAt,
        label: `${text.activityTypes[activity.type]} · ${activity.subject}`
      })
    }
    for (const sale of purchases) {
      items.push({
        id: `sale-${sale._id ?? sale.invoiceNo}`,
        at: sale.createdAt,
        label: `${sale.invoiceNo} · ${formatMoney(sale.totalCents, currency)}`
      })
    }
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30)
  }, [notes, activities, purchases, selectedCustomerId, text, currency])

  const customerNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const customer of customers) if (customer._id) map.set(customer._id, customer.name)
    return map
  }, [customers])

  async function refresh(): Promise<void> {
    if (!window.api) return
    const [c, l, d, a] = await Promise.all([
      window.api.crmCustomersList(),
      window.api.crmLeadsList(),
      window.api.crmDealsList(),
      window.api.crmActivitiesList()
    ])
    setCustomers(c)
    setLeads(l)
    setDeals(d)
    setActivities(a)
  }

  async function loadCustomerDetails(customerId: string): Promise<void> {
    if (!window.api || !customerId) {
      setContacts([])
      setNotes([])
      setPurchases([])
      return
    }
    const [cs, ns, sales] = await Promise.all([
      window.api.crmContactsList(customerId),
      window.api.crmNotesList(customerId),
      window.api.posSalesList()
    ])
    setContacts(cs)
    setNotes(ns)
    setPurchases(sales.filter((sale) => sale.customerId === customerId))
  }

  useEffect(() => {
    void refresh().catch((loadError) => setError(message(loadError)))
  }, [])

  useEffect(() => {
    void loadCustomerDetails(selectedCustomerId).catch(() => undefined)
  }, [selectedCustomerId])

  function reset(): void {
    setError('')
    setSuccess('')
  }

  function markSaved(): void {
    setSuccess(text.saved)
    setError('')
  }

  function openCustomer(customer?: Customer): void {
    reset()
    setEditingCustomer(customer ?? null)
    setCustomerForm(
      customer
        ? {
            name: customer.name,
            email: customer.email ?? '',
            phone: customer.phone ?? '',
            company: customer.company ?? '',
            category: customer.category ?? '',
            tags: (customer.tags ?? []).join(', '),
            notes: customer.notes ?? '',
            active: customer.active !== false
          }
        : emptyCustomer()
    )
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!customerForm) return
    const name = customerForm.name.trim()
    if (!name) return setError(text.nameRequired)
    reset()
    setBusy(true)
    const payload = {
      name,
      email: customerForm.email.trim() || undefined,
      phone: customerForm.phone.trim() || undefined,
      company: customerForm.company.trim() || undefined,
      category: customerForm.category.trim() || undefined,
      tags: customerForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      notes: customerForm.notes.trim() || undefined,
      active: customerForm.active
    }
    try {
      if (editingCustomer?._id) await window.api.crmCustomersUpdate(editingCustomer._id, payload)
      else await window.api.crmCustomersCreate(payload)
      setCustomerForm(null)
      setEditingCustomer(null)
      await refresh()
      markSaved()
    } catch (saveError) {
      setError(`${text.error}: ${message(saveError)}`)
    } finally {
      setBusy(false)
    }
  }

  async function saveLead(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!leadForm) return
    const name = leadForm.name.trim()
    if (!name) return setError(text.nameRequired)
    reset()
    setBusy(true)
    try {
      await window.api.crmLeadsCreate({
        name,
        email: leadForm.email.trim() || undefined,
        phone: leadForm.phone.trim() || undefined,
        source: leadForm.source.trim() || undefined,
        status: leadForm.status,
        notes: leadForm.notes.trim() || undefined
      })
      setLeadForm(null)
      await refresh()
      markSaved()
    } catch (saveError) {
      setError(`${text.error}: ${message(saveError)}`)
    } finally {
      setBusy(false)
    }
  }

  async function saveDeal(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!dealForm) return
    const title = dealForm.title.trim()
    if (!title) return setError(text.titleRequired)
    reset()
    setBusy(true)
    try {
      await window.api.crmDealsCreate({
        customerId: dealForm.customerId || undefined,
        title,
        value: dealForm.value.trim() === '' ? undefined : Number(dealForm.value),
        currency: dealForm.currency.trim().toUpperCase() || undefined,
        stage: dealForm.stage,
        notes: dealForm.notes.trim() || undefined
      })
      setDealForm(null)
      await refresh()
      markSaved()
    } catch (saveError) {
      setError(`${text.error}: ${message(saveError)}`)
    } finally {
      setBusy(false)
    }
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!activityForm) return
    const subject = activityForm.subject.trim()
    if (!subject) return setError(text.subjectRequired)
    reset()
    setBusy(true)
    try {
      await window.api.crmActivitiesCreate({
        customerId: activityForm.customerId || undefined,
        type: activityForm.type,
        subject,
        dueDate: activityForm.dueDate || undefined,
        done: activityForm.done,
        notes: activityForm.notes.trim() || undefined
      })
      setActivityForm(null)
      await refresh()
      markSaved()
    } catch (saveError) {
      setError(`${text.error}: ${message(saveError)}`)
    } finally {
      setBusy(false)
    }
  }

  async function saveContact(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!contactForm) return
    if (!selectedCustomerId) return setError(text.customerRequired)
    const name = contactForm.name.trim()
    if (!name) return setError(text.nameRequired)
    reset()
    setBusy(true)
    try {
      await window.api.crmContactsCreate({
        customerId: selectedCustomerId,
        name,
        email: contactForm.email.trim() || undefined,
        phone: contactForm.phone.trim() || undefined,
        role: contactForm.role.trim() || undefined,
        primary: contactForm.primary
      })
      setContactForm(null)
      await loadCustomerDetails(selectedCustomerId)
      markSaved()
    } catch (saveError) {
      setError(`${text.error}: ${message(saveError)}`)
    } finally {
      setBusy(false)
    }
  }

  async function saveNote(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!selectedCustomerId) return setError(text.customerRequired)
    const content = noteContent.trim()
    if (!content) return setError(text.noteRequired)
    reset()
    setBusy(true)
    try {
      await window.api.crmNotesCreate({ customerId: selectedCustomerId, content })
      setNoteContent('')
      await loadCustomerDetails(selectedCustomerId)
      markSaved()
    } catch (saveError) {
      setError(`${text.error}: ${message(saveError)}`)
    } finally {
      setBusy(false)
    }
  }

  const selectedCustomer = customers.find((customer) => customer._id === selectedCustomerId) ?? null

  return (
    <section className="panel crm-page" aria-labelledby="crm-page-title">
      <div className="section-header">
        <div>
          <h2 id="crm-page-title">{text.title}</h2>
          <p className="muted">{text.intro}</p>
        </div>
        <div className="row-actions">
          {(['customers', 'leads', 'deals', 'activities'] as Tab[]).map((item) => (
            <button key={item} type="button" className={tab === item ? 'primary' : ''} onClick={() => setTab(item)}>
              {text[item]}
            </button>
          ))}
          <button
            type="button"
            className="primary"
            onClick={() => {
              reset()
              if (tab === 'customers') openCustomer()
              if (tab === 'leads') setLeadForm(emptyLead())
              if (tab === 'deals') setDealForm(emptyDeal())
              if (tab === 'activities') setActivityForm(emptyActivity())
            }}
          >
            {text.add}
          </button>
        </div>
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {success ? <p className="success" role="status">{success}</p> : null}

      {tab === 'customers' ? (
        <>
          {customerForm ? (
            <form className="crud-form" onSubmit={saveCustomer}>
              <div className="crud-form-header">
                <h3>{editingCustomer ? `${text.edit}: ${editingCustomer.name}` : text.customers}</h3>
                <button type="button" className="link-button" onClick={() => setCustomerForm(null)}>
                  {text.cancel}
                </button>
              </div>
              <div className="crud-grid">
                <label>
                  <span>{text.name}</span>
                  <input value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} required maxLength={120} />
                </label>
                <label>
                  <span>{text.company}</span>
                  <input value={customerForm.company} onChange={(event) => setCustomerForm({ ...customerForm, company: event.target.value })} maxLength={120} />
                </label>
                <label>
                  <span>{text.phone}</span>
                  <input value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} maxLength={40} />
                </label>
                <label>
                  <span>{text.email}</span>
                  <input type="email" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} maxLength={120} />
                </label>
                <label>
                  <span>{text.category}</span>
                  <input value={customerForm.category} onChange={(event) => setCustomerForm({ ...customerForm, category: event.target.value })} maxLength={60} />
                </label>
                <label>
                  <span>{text.tags}</span>
                  <input value={customerForm.tags} onChange={(event) => setCustomerForm({ ...customerForm, tags: event.target.value })} maxLength={200} />
                </label>
                <label className="wide">
                  <span>{text.notes}</span>
                  <input value={customerForm.notes} onChange={(event) => setCustomerForm({ ...customerForm, notes: event.target.value })} maxLength={500} />
                </label>
                <label className="checkbox wide">
                  <input type="checkbox" checked={customerForm.active} onChange={(event) => setCustomerForm({ ...customerForm, active: event.target.checked })} />
                  <span>{text.active}</span>
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="primary" disabled={busy}>{busy ? text.saving : text.save}</button>
                <button type="button" onClick={() => setCustomerForm(null)}>{text.cancel}</button>
              </div>
            </form>
          ) : null}

          {customers.length === 0 ? (
            <div className="empty-state">{text.noCustomers}</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>{text.columns.customers.map((column, index) => <th key={`${column}-${index}`}>{column}</th>)}</tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer._id ?? customer.name} className={customer._id === selectedCustomerId ? 'row-selected' : ''}>
                      <td><strong>{customer.name}</strong>{customer.tags?.length ? <small className="block-muted">{customer.tags.join(', ')}</small> : null}</td>
                      <td>{customer.company || '-'}</td>
                      <td>{customer.phone || '-'}</td>
                      <td>{customer.category || '-'}</td>
                      <td><span className={`tag ${customer.active === false ? '' : 'ok-tag'}`}>{customer.active === false ? '-' : text.active}</span></td>
                      <td>
                        <div className="row-actions">
                          <button type="button" onClick={() => setSelectedCustomerId(customer._id ?? '')}>{text.contacts}</button>
                          <button type="button" onClick={() => openCustomer(customer)}>{text.edit}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedCustomer ? (
            <div className="crm-details">
              <div className="section-header">
                <h3>{text.selectedCustomer}: {selectedCustomer.name}</h3>
                <button type="button" className="link-button" onClick={() => setSelectedCustomerId('')}>{text.cancel}</button>
              </div>

              <div className="crm-details-grid">
                <section>
                  <div className="crud-form-header">
                    <h4>{text.contacts}</h4>
                    <button type="button" className="link-button" onClick={() => setContactForm(emptyContact())}>{text.addContact}</button>
                  </div>
                  {contactForm ? (
                    <form className="crud-form compact-form" onSubmit={saveContact}>
                      <div className="crud-grid">
                        <label><span>{text.contactName}</span><input value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} required maxLength={120} /></label>
                        <label><span>{text.role}</span><input value={contactForm.role} onChange={(event) => setContactForm({ ...contactForm, role: event.target.value })} maxLength={80} /></label>
                        <label><span>{text.phone}</span><input value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} maxLength={40} /></label>
                        <label><span>{text.email}</span><input type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} maxLength={120} /></label>
                        <label className="checkbox wide"><input type="checkbox" checked={contactForm.primary} onChange={(event) => setContactForm({ ...contactForm, primary: event.target.checked })} /><span>{text.primary}</span></label>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="primary" disabled={busy}>{busy ? text.saving : text.save}</button>
                        <button type="button" onClick={() => setContactForm(null)}>{text.cancel}</button>
                      </div>
                    </form>
                  ) : null}
                  {contacts.length === 0 ? <p className="muted">{text.noContacts}</p> : (
                    <ul className="movement-list">
                      {contacts.map((contact) => (
                        <li key={contact._id ?? contact.name}>
                          <span><strong>{contact.name}</strong><small className="block-muted">{[contact.role, contact.phone, contact.email].filter(Boolean).join(' - ')}</small></span>
                          {contact.primary ? <span className="tag ok-tag">{text.primary}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <div className="crud-form-header">
                    <h4>{text.notesTitle}</h4>
                    <button type="button" className="link-button" onClick={() => setNoteContent('')}>{text.addNote}</button>
                  </div>
                  <form className="crud-form compact-form" onSubmit={saveNote}>
                    <label className="wide"><span>{text.noteContent}</span><input value={noteContent} onChange={(event) => setNoteContent(event.target.value)} maxLength={1000} /></label>
                    <div className="form-actions"><button type="submit" className="primary" disabled={busy}>{busy ? text.saving : text.save}</button></div>
                  </form>
                  {notes.length === 0 ? <p className="muted">{text.noNotes}</p> : (
                    <ul className="movement-list">
                      {notes.map((note) => (
                        <li key={note._id ?? note.createdAt}>
                          <span><strong>{note.content}</strong><small className="block-muted">{formatDateTime(note.createdAt, language)}{note.createdBy ? ` - ${text.createdBy}: ${note.createdBy}` : ''}</small></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <section>
                <h4>{text.purchaseHistory}</h4>
                {purchases.length === 0 ? <p className="muted">{text.noPurchases}</p> : (
                  <table className="data-table compact">
                    <thead><tr><th>{text.invoice}</th><th>{text.total}</th><th>{text.dueDate}</th></tr></thead>
                    <tbody>{purchases.map((sale) => (
                      <tr key={sale._id ?? sale.invoiceNo}>
                        <td>{sale.invoiceNo}</td>
                        <td>{formatMoney(sale.totalCents, currency)}</td>
                        <td>{formatDateTime(sale.createdAt, language)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </section>

              <section>
                <h4>{text.timeline}</h4>
                {timeline.length === 0 ? <p className="muted">{text.noTimeline}</p> : (
                  <ul className="movement-list">
                    {timeline.map((item) => (
                      <li key={item.id}>
                        <span>{item.label}</span>
                        <small className="block-muted">{formatDateTime(item.at, language)}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : (
            <p className="muted">{text.chooseCustomer}</p>
          )}
        </>
      ) : null}

      {tab === 'leads' ? (
        <>
          {leadForm ? (
            <form className="crud-form" onSubmit={saveLead}>
              <div className="crud-form-header">
                <h3>{text.leads}</h3>
                <button type="button" className="link-button" onClick={() => setLeadForm(null)}>{text.cancel}</button>
              </div>
              <div className="crud-grid">
                <label><span>{text.name}</span><input value={leadForm.name} onChange={(event) => setLeadForm({ ...leadForm, name: event.target.value })} required maxLength={120} /></label>
                <label><span>{text.phone}</span><input value={leadForm.phone} onChange={(event) => setLeadForm({ ...leadForm, phone: event.target.value })} maxLength={40} /></label>
                <label><span>{text.email}</span><input type="email" value={leadForm.email} onChange={(event) => setLeadForm({ ...leadForm, email: event.target.value })} maxLength={120} /></label>
                <label><span>{text.source}</span><input value={leadForm.source} onChange={(event) => setLeadForm({ ...leadForm, source: event.target.value })} maxLength={80} /></label>
                <label><span>{text.status}</span><select value={leadForm.status} onChange={(event) => setLeadForm({ ...leadForm, status: event.target.value as Lead['status'] })}>{(['new', 'contacted', 'qualified', 'lost', 'converted'] as const).map((status) => <option key={status} value={status}>{text.statuses[status]}</option>)}</select></label>
                <label className="wide"><span>{text.notes}</span><input value={leadForm.notes} onChange={(event) => setLeadForm({ ...leadForm, notes: event.target.value })} maxLength={500} /></label>
              </div>
              <div className="form-actions"><button type="submit" className="primary" disabled={busy}>{busy ? text.saving : text.save}</button><button type="button" onClick={() => setLeadForm(null)}>{text.cancel}</button></div>
            </form>
          ) : null}
          {leads.length === 0 ? <div className="empty-state">{text.noLeads}</div> : (
            <table className="data-table">
              <thead><tr>{text.columns.leads.map((column, index) => <th key={`${column}-${index}`}>{column}</th>)}</tr></thead>
              <tbody>{leads.map((lead) => (
                <tr key={lead._id ?? lead.name}>
                  <td>{lead.name}</td><td>{lead.source || '-'}</td><td><span className="tag">{text.statuses[lead.status]}</span></td><td>{lead.phone || '-'}</td><td>{formatDateTime(lead.createdAt, language)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </>
      ) : null}

      {tab === 'deals' ? (
        <>
          {dealForm ? (
            <form className="crud-form" onSubmit={saveDeal}>
              <div className="crud-form-header"><h3>{text.deals}</h3><button type="button" className="link-button" onClick={() => setDealForm(null)}>{text.cancel}</button></div>
              <div className="crud-grid">
                <label className="wide"><span>{text.titleLabel}</span><input value={dealForm.title} onChange={(event) => setDealForm({ ...dealForm, title: event.target.value })} required maxLength={120} /></label>
                <label><span>{text.customer}</span><select value={dealForm.customerId} onChange={(event) => setDealForm({ ...dealForm, customerId: event.target.value })}><option value="">-</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}</select></label>
                <label><span>{text.stage}</span><select value={dealForm.stage} onChange={(event) => setDealForm({ ...dealForm, stage: event.target.value as Deal['stage'] })}>{(['prospect', 'proposal', 'negotiation', 'won', 'lost'] as const).map((stage) => <option key={stage} value={stage}>{text.statuses[stage]}</option>)}</select></label>
                <label><span>{text.value}</span><input inputMode="decimal" value={dealForm.value} onChange={(event) => setDealForm({ ...dealForm, value: event.target.value })} /></label>
                <label><span>{text.currency}</span><input value={dealForm.currency} onChange={(event) => setDealForm({ ...dealForm, currency: event.target.value })} maxLength={3} /></label>
                <label className="wide"><span>{text.notes}</span><input value={dealForm.notes} onChange={(event) => setDealForm({ ...dealForm, notes: event.target.value })} maxLength={500} /></label>
              </div>
              <div className="form-actions"><button type="submit" className="primary" disabled={busy}>{busy ? text.saving : text.save}</button><button type="button" onClick={() => setDealForm(null)}>{text.cancel}</button></div>
            </form>
          ) : null}
          {deals.length === 0 ? <div className="empty-state">{text.noDeals}</div> : (
            <table className="data-table">
              <thead><tr>{text.columns.deals.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>{deals.map((deal) => (
                <tr key={deal._id ?? deal.title}>
                  <td>{deal.title}</td><td>{deal.customerId ? customerNames.get(deal.customerId) ?? '-' : '-'}</td><td><span className="tag">{text.statuses[deal.stage as keyof typeof text.statuses] ?? deal.stage}</span></td><td>{deal.value != null ? `${deal.value} ${deal.currency ?? ''}` : '-'}</td><td>{formatDateTime(deal.createdAt, language)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </>
      ) : null}

      {tab === 'activities' ? (
        <>
          {activityForm ? (
            <form className="crud-form" onSubmit={saveActivity}>
              <div className="crud-form-header"><h3>{text.activities}</h3><button type="button" className="link-button" onClick={() => setActivityForm(null)}>{text.cancel}</button></div>
              <div className="crud-grid">
                <label className="wide"><span>{text.subject}</span><input value={activityForm.subject} onChange={(event) => setActivityForm({ ...activityForm, subject: event.target.value })} required maxLength={120} /></label>
                <label><span>{text.type}</span><select value={activityForm.type} onChange={(event) => setActivityForm({ ...activityForm, type: event.target.value as Activity['type'] })}>{(['call', 'email', 'meeting', 'task'] as const).map((type) => <option key={type} value={type}>{text.activityTypes[type]}</option>)}</select></label>
                <label><span>{text.customer}</span><select value={activityForm.customerId} onChange={(event) => setActivityForm({ ...activityForm, customerId: event.target.value })}><option value="">-</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}</select></label>
                <label><span>{text.dueDate}</span><input type="date" value={activityForm.dueDate} onChange={(event) => setActivityForm({ ...activityForm, dueDate: event.target.value })} /></label>
                <label className="checkbox"><input type="checkbox" checked={activityForm.done} onChange={(event) => setActivityForm({ ...activityForm, done: event.target.checked })} /><span>{text.done}</span></label>
                <label className="wide"><span>{text.notes}</span><input value={activityForm.notes} onChange={(event) => setActivityForm({ ...activityForm, notes: event.target.value })} maxLength={500} /></label>
              </div>
              <div className="form-actions"><button type="submit" className="primary" disabled={busy}>{busy ? text.saving : text.save}</button><button type="button" onClick={() => setActivityForm(null)}>{text.cancel}</button></div>
            </form>
          ) : null}
          {activities.length === 0 ? <div className="empty-state">{text.noActivities}</div> : (
            <table className="data-table">
              <thead><tr>{text.columns.activities.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>{activities.map((activity) => (
                <tr key={activity._id ?? activity.subject}>
                  <td>{activity.subject}</td><td>{text.activityTypes[activity.type]}</td><td>{activity.customerId ? customerNames.get(activity.customerId) ?? '-' : '-'}</td><td>{activity.dueDate || '-'}</td><td>{activity.done ? text.done : '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </>
      ) : null}
    </section>
  )
}
