import { useEffect, useState, type FormEvent } from 'react'
import type { DeviceActivation, License, ReplacementRequest } from '../../../shared/licensing'
import type { SoftwarePlan, SoftwareSubscription, SubscriptionPayment } from '../../../shared/subscription'
import type { Language } from '../../../shared/settings'
import { formatDateTime, formatMoney, parseMoney } from '../money'

interface Props {
  language: Language
  currency: string
  reviewer: string
}

const copy = {
  en: {
    title: 'Subscription & licensing',
    intro: 'Manage software plans, the current subscription, payments, device limits, and replacement approvals.',
    plans: 'Plans',
    subscription: 'Subscription',
    payments: 'Payments',
    licenses: 'Licenses',
    devices: 'Devices',
    replacements: 'Replacement requests',
    addPlan: 'Add plan',
    planName: 'Plan name',
    price: 'Price',
    billingPeriod: 'Billing period',
    monthly: 'Monthly',
    yearly: 'Yearly',
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    noPlans: 'No plans yet.',
    noSubscription: 'No subscription yet.',
    currentPlan: 'Plan',
    status: 'Status',
    start: 'Start',
    periodEnd: 'Period end',
    nextRenewal: 'Next renewal',
    renew: 'Renew subscription',
    creating: 'Creating...',
    createSubscription: 'Create subscription',
    noPayments: 'No payments yet.',
    amount: 'Amount',
    paidAt: 'Paid at',
    newLicense: 'New license',
    licenseId: 'License ID (leave empty to generate)',
    maxDevices: 'Maximum active devices',
    customerId: 'Customer ID (optional)',
    createLicense: 'Create license',
    noLicenses: 'No licenses yet.',
    limit: 'Device limit',
    saveLimit: 'Save limit',
    showDevices: 'Show devices',
    hideDevices: 'Hide devices',
    noDevices: 'No devices activated.',
    device: 'Device',
    fingerprint: 'Fingerprint',
    activated: 'Activated',
    lastValidation: 'Last validation',
    revokeReason: 'Revocation reason',
    revoke: 'Revoke',
    revoked: 'Revoked',
    noReplacements: 'No replacement requests.',
    requestedDevice: 'Requested device',
    requestDate: 'Requested',
    decisionReason: 'Decision reason',
    approve: 'Approve',
    reject: 'Reject',
    activeStatuses: 'active',
    errors: {
      planName: 'Plan name is required.',
      price: 'Enter a valid price.',
      plan: 'Choose a plan.',
      licenseId: 'License ID is invalid.',
      maxDevices: 'Device limit must be 1 or more.',
      reason: 'Enter a reason.',
      save: 'Could not save'
    },
    saved: 'Saved successfully.',
    columns: {
      plans: ['Name', 'Price', 'Period', 'Status'],
      payments: ['Amount', 'Status', 'Paid at'],
      licenses: ['License', 'Status', 'Active devices', 'Limit', 'Created'],
      devices: ['Device', 'Status', 'Activated', 'Last validation', ''],
      replacements: ['License', 'Existing device', 'Requested', 'Reason', 'Status', '']
    },
    statusLabels: {
      pending: 'Pending',
      trialing: 'Trialing',
      active: 'Active',
      past_due: 'Past due',
      canceled: 'Canceled',
      expired: 'Expired',
      suspended: 'Suspended',
      inactive: 'Inactive',
      revoked: 'Revoked',
      replacement_pending: 'Replacement pending',
      approved: 'Approved',
      rejected: 'Rejected',
      paid: 'Paid',
      failed: 'Failed',
      refunded: 'Refunded'
    }
  },
  ar: {
    title: 'الاشتراك والترخيص',
    intro: 'أدر خطط البرنامج والاشتراك الحالي والمدفوعات وحدود الأجهزة وموافقات الاستبدال.',
    plans: 'الخطط',
    subscription: 'الاشتراك',
    payments: 'المدفوعات',
    licenses: 'التراخيص',
    devices: 'الأجهزة',
    replacements: 'طلبات الاستبدال',
    addPlan: 'إضافة خطة',
    planName: 'اسم الخطة',
    price: 'السعر',
    billingPeriod: 'دورة الفوترة',
    monthly: 'شهري',
    yearly: 'سنوي',
    save: 'حفظ',
    saving: 'جارٍ الحفظ...',
    cancel: 'إلغاء',
    noPlans: 'لا توجد خطط بعد.',
    noSubscription: 'لا يوجد اشتراك بعد.',
    currentPlan: 'الخطة',
    status: 'الحالة',
    start: 'البداية',
    periodEnd: 'نهاية الفترة',
    nextRenewal: 'التجديد القادم',
    renew: 'تجديد الاشتراك',
    creating: 'جارٍ الإنشاء...',
    createSubscription: 'إنشاء اشتراك',
    noPayments: 'لا توجد مدفوعات بعد.',
    amount: 'المبلغ',
    paidAt: 'وقت الدفع',
    newLicense: 'ترخيص جديد',
    licenseId: 'معرف الترخيص (اتركه فارغاً للتوليد)',
    maxDevices: 'الحد الأقصى للأجهزة النشطة',
    customerId: 'معرف العميل (اختياري)',
    createLicense: 'إنشاء ترخيص',
    noLicenses: 'لا توجد تراخيص بعد.',
    limit: 'حد الأجهزة',
    saveLimit: 'حفظ الحد',
    showDevices: 'عرض الأجهزة',
    hideDevices: 'إخفاء الأجهزة',
    noDevices: 'لا توجد أجهزة مفعّلة.',
    device: 'الجهاز',
    fingerprint: 'البصمة',
    activated: 'وقت التفعيل',
    lastValidation: 'آخر تحقق',
    revokeReason: 'سبب الإلغاء',
    revoke: 'إلغاء',
    revoked: 'ملغى',
    noReplacements: 'لا توجد طلبات استبدال.',
    requestedDevice: 'الجهاز المطلوب',
    requestDate: 'وقت الطلب',
    decisionReason: 'سبب القرار',
    approve: 'موافقة',
    reject: 'رفض',
    activeStatuses: 'نشط',
    errors: {
      planName: 'اسم الخطة مطلوب.',
      price: 'أدخل سعراً صحيحاً.',
      plan: 'اختر خطة.',
      licenseId: 'معرف الترخيص غير صالح.',
      maxDevices: 'حد الأجهزة يجب أن يكون 1 أو أكثر.',
      reason: 'أدخل سبباً.',
      save: 'تعذر الحفظ'
    },
    saved: 'تم الحفظ بنجاح.',
    columns: {
      plans: ['الاسم', 'السعر', 'الدورة', 'الحالة'],
      payments: ['المبلغ', 'الحالة', 'وقت الدفع'],
      licenses: ['الترخيص', 'الحالة', 'الأجهزة النشطة', 'الحد', 'تاريخ الإنشاء'],
      devices: ['الجهاز', 'الحالة', 'وقت التفعيل', 'آخر تحقق', ''],
      replacements: ['الترخيص', 'الجهاز الحالي', 'الجهاز المطلوب', 'السبب', 'الحالة', '']
    },
    statusLabels: {
      pending: 'معلق',
      trialing: 'تجريبي',
      active: 'نشط',
      past_due: 'متأخر',
      canceled: 'ملغى',
      expired: 'منتهي',
      suspended: 'موقوف',
      inactive: 'غير نشط',
      revoked: 'ملغى',
      replacement_pending: 'بانتظار الاستبدال',
      approved: 'تمت الموافقة',
      rejected: 'مرفوض',
      paid: 'مدفوع',
      failed: 'فشل',
      refunded: 'مسترد'
    }
  }
} as const

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function SubscriptionLicensingPanel({ language, currency, reviewer }: Props) {
  const text = copy[language]
  const [plans, setPlans] = useState<SoftwarePlan[]>([])
  const [subscription, setSubscription] = useState<SoftwareSubscription | null>(null)
  const [payments, setPayments] = useState<SubscriptionPayment[]>([])
  const [licenses, setLicenses] = useState<License[]>([])
  const [replacements, setReplacements] = useState<ReplacementRequest[]>([])
  const [devices, setDevices] = useState<Record<string, DeviceActivation[]>>({})
  const [planForm, setPlanForm] = useState<{ name: string; price: string; period: 'monthly' | 'yearly' } | null>(null)
  const [licenseForm, setLicenseForm] = useState<{ licenseId: string; maxDevices: string; customerId: string } | null>(null)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [limits, setLimits] = useState<Record<string, string>>({})
  const [revokeReason, setRevokeReason] = useState('')
  const [decisionReason, setDecisionReason] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function refresh(): Promise<void> {
    if (!window.api) return
    const [p, s, pay, lic, repl] = await Promise.all([
      window.api.subPlansList(),
      window.api.subGet(),
      window.api.subPaymentsList(),
      window.api.licList(),
      window.api.licReplList()
    ])
    setPlans(p)
    setSubscription(s)
    setPayments(pay)
    setLicenses(lic)
    setReplacements(repl)
    setSelectedPlan((current) => current || (p[0]?._id ?? ''))
    setLimits((current) => {
      const next = { ...current }
      for (const license of lic) if (!next[license.licenseId]) next[license.licenseId] = String(license.maxActiveDevices)
      return next
    })
  }

  useEffect(() => {
    void refresh().catch((loadError) => setError(message(loadError)))
  }, [])

  function reset(): void {
    setError('')
    setSuccess('')
  }

  async function savePlan(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!planForm) return
    reset()
    const name = planForm.name.trim()
    if (!name) return setError(text.errors.planName)
    const price = parseMoney(planForm.price)
    if (price === null) return setError(text.errors.price)
    setBusy('plan')
    try {
      await window.api.subPlansCreate({ name, priceCents: price, currency, billingPeriod: planForm.period, active: true })
      setPlanForm(null)
      await refresh()
      setSuccess(text.saved)
    } catch (saveError) {
      setError(`${text.errors.save}: ${message(saveError)}`)
    } finally {
      setBusy('')
    }
  }

  async function createSubscription(): Promise<void> {
    reset()
    if (!selectedPlan) return setError(text.errors.plan)
    setBusy('subscription')
    try {
      await window.api.subCreate({ planId: selectedPlan, status: 'active' })
      await refresh()
      setSuccess(text.saved)
    } catch (createError) {
      setError(`${text.errors.save}: ${message(createError)}`)
    } finally {
      setBusy('')
    }
  }

  async function renew(): Promise<void> {
    reset()
    setBusy('renew')
    try {
      await window.api.subRenew()
      await refresh()
      setSuccess(text.saved)
    } catch (renewError) {
      setError(`${text.errors.save}: ${message(renewError)}`)
    } finally {
      setBusy('')
    }
  }

  async function changeStatus(status: string): Promise<void> {
    reset()
    setBusy('status')
    try {
      await window.api.subSetStatus(status)
      await refresh()
      setSuccess(text.saved)
    } catch (statusError) {
      setError(`${text.errors.save}: ${message(statusError)}`)
    } finally {
      setBusy('')
    }
  }

  async function createLicense(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!licenseForm) return
    reset()
    const limit = Number(licenseForm.maxDevices)
    if (!Number.isInteger(limit) || limit < 1) return setError(text.errors.maxDevices)
    setBusy('license')
    try {
      await window.api.licCreate({
        licenseId: licenseForm.licenseId.trim() || undefined,
        maxActiveDevices: limit,
        customerId: licenseForm.customerId.trim() || undefined,
        status: 'active'
      })
      setLicenseForm(null)
      await refresh()
      setSuccess(text.saved)
    } catch (createError) {
      setError(`${text.errors.save}: ${message(createError)}`)
    } finally {
      setBusy('')
    }
  }

  async function saveLimit(license: License): Promise<void> {
    reset()
    const limit = Number(limits[license.licenseId])
    if (!Number.isInteger(limit) || limit < 1) return setError(text.errors.maxDevices)
    setBusy(`limit-${license.licenseId}`)
    try {
      await window.api.licConfigureLimit(license.licenseId, limit)
      await refresh()
      setSuccess(text.saved)
    } catch (limitError) {
      setError(`${text.errors.save}: ${message(limitError)}`)
    } finally {
      setBusy('')
    }
  }

  async function toggleDevices(license: License): Promise<void> {
    reset()
    if (devices[license.licenseId]) {
      setDevices((current) => {
        const next = { ...current }
        delete next[license.licenseId]
        return next
      })
      return
    }
    setBusy(`devices-${license.licenseId}`)
    try {
      const list = await window.api.licDevicesList(license.licenseId)
      setDevices((current) => ({ ...current, [license.licenseId]: list }))
    } catch (deviceError) {
      setError(`${text.errors.save}: ${message(deviceError)}`)
    } finally {
      setBusy('')
    }
  }

  async function revoke(device: DeviceActivation): Promise<void> {
    reset()
    const reason = revokeReason.trim()
    if (!reason) return setError(text.errors.reason)
    setBusy(`revoke-${device.deviceId}`)
    try {
      await window.api.licRevoke(device.deviceId, reason)
      const list = await window.api.licDevicesList(device.licenseId)
      setDevices((current) => ({ ...current, [device.licenseId]: list }))
      await refresh()
      setSuccess(text.saved)
    } catch (revokeError) {
      setError(`${text.errors.save}: ${message(revokeError)}`)
    } finally {
      setBusy('')
    }
  }

  async function review(request: ReplacementRequest, decision: 'approve' | 'reject'): Promise<void> {
    reset()
    const reason = decisionReason.trim()
    if (!reason) return setError(text.errors.reason)
    setBusy(`replacement-${request.requestId}`)
    try {
      if (decision === 'approve') await window.api.licReplApprove(request.requestId, reviewer, reason)
      else await window.api.licReplReject(request.requestId, reviewer, reason)
      await refresh()
      setSuccess(text.saved)
    } catch (reviewError) {
      setError(`${text.errors.save}: ${message(reviewError)}`)
    } finally {
      setBusy('')
    }
  }

  const planName = (planId: string): string => plans.find((plan) => plan._id === planId)?.name ?? planId

  return (
    <section className="panel subscription-page" aria-labelledby="subscription-title">
      <div className="section-header">
        <div>
          <h2 id="subscription-title">{text.title}</h2>
          <p className="muted">{text.intro}</p>
        </div>
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {success ? <p className="success" role="status">{success}</p> : null}

      <div className="settings-split">
        <section>
          <div className="section-header">
            <h3>{text.plans}</h3>
            <button type="button" onClick={() => setPlanForm({ name: '', price: '0.00', period: 'monthly' })}>{text.addPlan}</button>
          </div>
          {planForm ? (
            <form className="crud-form compact-form" onSubmit={savePlan}>
              <div className="crud-grid">
                <label><span>{text.planName}</span><input value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} required maxLength={80} /></label>
                <label><span>{text.price}</span><input inputMode="decimal" value={planForm.price} onChange={(event) => setPlanForm({ ...planForm, price: event.target.value })} required /></label>
                <label><span>{text.billingPeriod}</span><select value={planForm.period} onChange={(event) => setPlanForm({ ...planForm, period: event.target.value as 'monthly' | 'yearly' })}><option value="monthly">{text.monthly}</option><option value="yearly">{text.yearly}</option></select></label>
              </div>
              <div className="form-actions"><button type="submit" className="primary" disabled={busy === 'plan'}>{busy === 'plan' ? text.saving : text.save}</button><button type="button" onClick={() => setPlanForm(null)}>{text.cancel}</button></div>
            </form>
          ) : null}
          {plans.length === 0 ? <p className="muted">{text.noPlans}</p> : (
            <div className="table-wrap">
              <table className="data-table compact">
                <thead><tr>{text.columns.plans.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                <tbody>{plans.map((plan) => (
                  <tr key={plan._id ?? plan.name}>
                    <td>{plan.name}</td>
                    <td>{formatMoney(plan.priceCents, plan.currency || currency)}</td>
                    <td>{plan.billingPeriod === 'yearly' ? text.yearly : text.monthly}</td>
                    <td><span className={`tag ${plan.active === false ? '' : 'ok-tag'}`}>{plan.active === false ? '-' : text.statusLabels.active}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <div className="section-header"><h3>{text.subscription}</h3></div>
          {subscription ? (
            <>
              <dl className="status-grid">
                <div><dt>{text.currentPlan}</dt><dd>{planName(subscription.planId)}</dd></div>
                <div><dt>{text.status}</dt><dd>{text.statusLabels[subscription.status] ?? subscription.status}</dd></div>
                <div><dt>{text.start}</dt><dd>{formatDateTime(subscription.startDate, language)}</dd></div>
                <div><dt>{text.periodEnd}</dt><dd>{formatDateTime(subscription.currentPeriodEnd, language)}</dd></div>
                <div><dt>{text.nextRenewal}</dt><dd>{formatDateTime(subscription.nextRenewalDate, language)}</dd></div>
              </dl>
              <div className="form-actions">
                <button type="button" className="primary" onClick={() => void renew()} disabled={busy === 'renew'}>{busy === 'renew' ? text.saving : text.renew}</button>
                <label>
                  <span>{text.status}</span>
                  <select value={subscription.status} onChange={(event) => void changeStatus(event.target.value)} disabled={busy === 'status'}>
                    {(['pending', 'trialing', 'active', 'past_due', 'canceled', 'expired', 'suspended'] as const).map((status) => (
                      <option key={status} value={status}>{text.statusLabels[status]}</option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          ) : (
            <div className="cash-form">
              <p className="muted">{text.noSubscription}</p>
              <label><span>{text.currentPlan}</span><select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value)}><option value="">-</option>{plans.map((plan) => <option key={plan._id} value={plan._id}>{plan.name}</option>)}</select></label>
              <div className="form-actions"><button type="button" className="primary" onClick={() => void createSubscription()} disabled={busy === 'subscription' || plans.length === 0}>{busy === 'subscription' ? text.creating : text.createSubscription}</button></div>
            </div>
          )}

          <h4>{text.payments}</h4>
          {payments.length === 0 ? <p className="muted">{text.noPayments}</p> : (
            <div className="table-wrap">
              <table className="data-table compact">
                <thead><tr>{text.columns.payments.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                <tbody>{payments.map((payment) => (
                  <tr key={payment._id ?? payment.createdAt}>
                    <td>{formatMoney(payment.amountCents, payment.currency || currency)}</td>
                    <td><span className="tag">{text.statusLabels[payment.status] ?? payment.status}</span></td>
                    <td>{payment.paidAt ? formatDateTime(payment.paidAt, language) : '-'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="section-header" style={{ marginTop: 24 }}>
        <h3>{text.licenses}</h3>
        <button type="button" onClick={() => setLicenseForm({ licenseId: '', maxDevices: '1', customerId: '' })}>{text.newLicense}</button>
      </div>

      {licenseForm ? (
        <form className="crud-form" onSubmit={createLicense}>
          <div className="crud-form-header"><h3>{text.newLicense}</h3><button type="button" className="link-button" onClick={() => setLicenseForm(null)}>{text.cancel}</button></div>
          <div className="crud-grid">
            <label><span>{text.licenseId}</span><input value={licenseForm.licenseId} onChange={(event) => setLicenseForm({ ...licenseForm, licenseId: event.target.value })} maxLength={120} /></label>
            <label><span>{text.maxDevices}</span><input type="number" min={1} step={1} value={licenseForm.maxDevices} onChange={(event) => setLicenseForm({ ...licenseForm, maxDevices: event.target.value })} required /></label>
            <label><span>{text.customerId}</span><input value={licenseForm.customerId} onChange={(event) => setLicenseForm({ ...licenseForm, customerId: event.target.value })} maxLength={120} /></label>
          </div>
          <div className="form-actions"><button type="submit" className="primary" disabled={busy === 'license'}>{busy === 'license' ? text.saving : text.createLicense}</button><button type="button" onClick={() => setLicenseForm(null)}>{text.cancel}</button></div>
        </form>
      ) : null}

      {licenses.length === 0 ? <p className="muted">{text.noLicenses}</p> : (
        <div className="license-list">
          {licenses.map((license) => (
            <div className="license-card" key={license._id ?? license.licenseId}>
              <div className="license-head">
                <div>
                  <strong>{license.licenseId}</strong>
                  <small className="block-muted">{text.status}: {text.statusLabels[license.status] ?? license.status} - {text.activeStatuses}: {license.currentActiveDeviceCount}</small>
                </div>
                <div className="row-actions">
                  <label className="inline-field">
                    <span>{text.limit}</span>
                    <input type="number" min={1} step={1} value={limits[license.licenseId] ?? String(license.maxActiveDevices)} onChange={(event) => setLimits({ ...limits, [license.licenseId]: event.target.value })} />
                  </label>
                  <button type="button" onClick={() => void saveLimit(license)} disabled={busy === `limit-${license.licenseId}`}>{text.saveLimit}</button>
                  <button type="button" onClick={() => void toggleDevices(license)} disabled={busy === `devices-${license.licenseId}`}>{devices[license.licenseId] ? text.hideDevices : text.showDevices}</button>
                </div>
              </div>
              <small className="muted">{formatDateTime(license.createdAt, language)}</small>
              {devices[license.licenseId] ? (
                <div className="device-list">
                  <label className="inline-field"><span>{text.revokeReason}</span><input value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} maxLength={200} /></label>
                  {devices[license.licenseId].length === 0 ? <p className="muted">{text.noDevices}</p> : (
                    <table className="data-table compact">
                      <thead><tr>{text.columns.devices.map((column, index) => <th key={`${column}-${index}`}>{column}</th>)}</tr></thead>
                      <tbody>{devices[license.licenseId].map((device) => (
                        <tr key={device.deviceId}>
                          <td><strong>{device.deviceDisplayName || device.deviceId}</strong><small className="block-muted">{device.fingerprintHash.slice(0, 16)}...</small></td>
                          <td><span className={`tag ${device.activationStatus === 'active' ? 'ok-tag' : ''}`}>{text.statusLabels[device.activationStatus] ?? device.activationStatus}</span></td>
                          <td>{formatDateTime(device.activationDate, language)}</td>
                          <td>{formatDateTime(device.lastValidationDate, language)}</td>
                          <td>{device.activationStatus === 'active' ? <button type="button" className="link-button danger-text" onClick={() => void revoke(device)} disabled={busy === `revoke-${device.deviceId}`}>{text.revoke}</button> : <span className="muted">-</span>}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="section-header" style={{ marginTop: 24 }}>
        <h3>{text.replacements}</h3>
        <label className="inline-field"><span>{text.decisionReason}</span><input value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} maxLength={200} /></label>
      </div>
      {replacements.length === 0 ? <p className="muted">{text.noReplacements}</p> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>{text.columns.replacements.map((column, index) => <th key={`${column}-${index}`}>{column}</th>)}</tr></thead>
            <tbody>{replacements.map((request) => (
              <tr key={request._id ?? request.requestId}>
                <td>{request.licenseId}</td>
                <td>{request.existingDeviceId}</td>
                <td>{request.requestedFingerprintHash.slice(0, 16)}...</td>
                <td>{request.reason}</td>
                <td><span className={`tag ${request.status === 'approved' ? 'ok-tag' : request.status === 'rejected' ? 'danger-tag' : 'warning-tag'}`}>{text.statusLabels[request.status] ?? request.status}</span></td>
                <td>{request.status === 'pending' ? (
                  <div className="row-actions">
                    <button type="button" onClick={() => void review(request, 'approve')} disabled={busy === `replacement-${request.requestId}`}>{text.approve}</button>
                    <button type="button" className="link-button danger-text" onClick={() => void review(request, 'reject')} disabled={busy === `replacement-${request.requestId}`}>{text.reject}</button>
                  </div>
                ) : <span className="muted">{text.requestDate}: {formatDateTime(request.requestDate, language)}</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}
