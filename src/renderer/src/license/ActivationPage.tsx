import { useState } from 'react'
import type { Language } from '../../../shared/settings'
import type { LicenseState } from '../../../shared/ipc'

interface Props {
  state: LicenseState
  language: Language
  onActivated: (state: LicenseState) => void
}

const strings = {
  en: {
    title: 'Activate this device',
    subtitle: 'Send the device details below to the supplier, then paste the license code you receive.',
    mac: 'MAC address',
    deviceId: 'Device ID',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy failed, select the text manually.',
    missing: 'No license code is active on this device.',
    expired: 'The license expired. Enter a new code to continue.',
    invalid: 'The saved license is not valid.',
    code: 'License code',
    placeholder: 'PHM1...',
    activate: 'Activate',
    activating: 'Activating...',
    help: 'License codes are issued per device and expire at the end of the purchased period.'
  },
  ar: {
    title: 'تفعيل هذا الجهاز',
    subtitle: 'ابعت بيانات الجهاز دي للمورد، وبعدها الصق كود الترخيص اللي هيوصلك.',
    mac: 'عنوان MAC',
    deviceId: 'معرّف الجهاز',
    copy: 'نسخ',
    copied: 'تم النسخ',
    copyFailed: 'تعذر النسخ، حدد النص يدويًا.',
    missing: 'لا يوجد كود ترخيص مفعّل على هذا الجهاز.',
    expired: 'انتهت صلاحية الترخيص. أدخل كودًا جديدًا للمتابعة.',
    invalid: 'الترخيص المحفوظ غير صالح.',
    code: 'كود الترخيص',
    placeholder: 'PHM1...',
    activate: 'تفعيل',
    activating: 'جارٍ التفعيل...',
    help: 'أكواد الترخيص تُصدر لكل جهاز على حدة وتنتهي بانتهاء المدة المشتراة.'
  }
} as const

export default function ActivationPage({ state, language, onActivated }: Props) {
  const text = strings[language]
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState('')

  async function copy(label: string, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      setError(text.copyFailed)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await window.api.licenseApply(code)
      onActivated(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const notice =
    state.status === 'expired'
      ? `${text.expired}${state.expiresAt ? ` (${new Date(state.expiresAt).toLocaleDateString()})` : ''}`
      : state.status === 'invalid'
        ? `${text.invalid}${state.reason ? ` ${state.reason}` : ''}`
        : text.missing

  return (
    <div className="login-shell">
      <section className="login-panel license-panel">
        <div className="login-brand">
          <span className="login-logo" aria-hidden="true">P</span>
          <div>
            <strong>{text.title}</strong>
            <small>Pharmacy POS &amp; Management</small>
          </div>
        </div>

        <p className="license-subtitle">{text.subtitle}</p>

        <p className={`license-notice ${state.status}`} role="status">{notice}</p>

        <dl className="license-info">
          <div>
            <dt>{text.mac}</dt>
            <dd dir="ltr">{state.mac || '-'}</dd>
          </div>
          <div>
            <dt>{text.deviceId}</dt>
            <dd dir="ltr">{state.deviceId || '-'}</dd>
          </div>
        </dl>

        <div className="license-copy-actions">
          <button type="button" onClick={() => void copy('mac', state.mac)}>
            {copied === 'mac' ? text.copied : `${text.copy} MAC`}
          </button>
          <button type="button" onClick={() => void copy('id', state.deviceId)}>
            {copied === 'id' ? text.copied : `${text.copy} ID`}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form license-form">
          <label>
            <span>{text.code}</span>
            <textarea
              className="license-code"
              dir="ltr"
              rows={3}
              placeholder={text.placeholder}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? text.activating : text.activate}
          </button>
        </form>

        <p className="hint">{text.help}</p>
      </section>
    </div>
  )
}
