import { useState } from 'react'
import type { Language } from '../../../shared/settings'
import type { LicenseState } from '../../../shared/ipc'
import logo from '../assets/logo.png'

interface Props {
  state: LicenseState
  language: Language
  onActivated: (state: LicenseState) => void
}

const strings = {
  en: {
    title: 'Activate this device',
    subtitle: 'Send the device code below to your supplier, then paste the license code you receive.',
    deviceCode: 'Device code',
    copy: 'Copy code',
    copied: 'Copied',
    copyFailed: 'Copy failed, select the text manually.',
    missing: 'No license code is active on this device.',
    expired: 'The license expired. Enter a new code to continue.',
    invalid: 'The saved license is not valid.',
    code: 'License code',
    placeholder: 'Paste the code you received',
    activate: 'Activate',
    activating: 'Activating...',
    help: 'License codes are issued per device and expire at the end of the purchased period.',
    errWrongDevice: 'This code was issued for a different device.',
    errAlreadyActive: 'This device is already activated.',
    errTooMany: 'Too many attempts. Try again in an hour.',
    errExpiredCode: 'This code has already expired.',
    errShorterCode: 'This code would shorten the current license. Contact your supplier.',
    errInvalidCode: 'The code could not be verified. Check it and try again.',
    loadFile: 'Or choose the license file (.anbc)',
    errWrongProduct: 'This license is for a different product.',
    errAppTooOld: 'This license needs a newer version of the app. Contact your supplier.',
    errNotYetValid: 'This license is not valid yet. Check the date and time on this PC.'
  },
  ar: {
    title: 'تفعيل هذا الجهاز',
    subtitle: 'ابعت كود الجهاز التالي للمورد، وبعدها الصق كود الترخيص اللي هيوصلك.',
    deviceCode: 'كود الجهاز',
    copy: 'نسخ الكود',
    copied: 'تم النسخ',
    copyFailed: 'تعذر النسخ، حدد النص يدويًا.',
    missing: 'لا يوجد كود ترخيص مفعّل على هذا الجهاز.',
    expired: 'انتهت صلاحية الترخيص. أدخل كودًا جديدًا للمتابعة.',
    invalid: 'الترخيص المحفوظ غير صالح.',
    code: 'كود الترخيص',
    placeholder: 'الصق الكود اللي وصلك',
    activate: 'تفعيل',
    activating: 'جارٍ التفعيل...',
    help: 'أكواد الترخيص تُصدر لكل جهاز على حدة وتنتهي بانتهاء المدة المشتراة.',
    errWrongDevice: 'هذا الكود صادر لجهاز آخر.',
    errAlreadyActive: 'هذا الجهاز مفعّل بالفعل.',
    errTooMany: 'محاولات كثيرة. حاول مرة أخرى بعد ساعة.',
    errExpiredCode: 'هذا الكود انتهت صلاحيته بالفعل.',
    errShorterCode: 'هذا الكود أقصر من الترخيص الحالي. تواصل مع المورد.',
    errInvalidCode: 'تعذر التحقق من الكود. راجعه وحاول مرة أخرى.',
    loadFile: 'أو اختر ملف الترخيص (.anbc)',
    errWrongProduct: 'هذا الترخيص لمنتج آخر.',
    errAppTooOld: 'هذا الترخيص يحتاج إصدارًا أحدث من البرنامج. تواصل مع المورد.',
    errNotYetValid: 'هذا الترخيص غير صالح بعد. راجع التاريخ والوقت على هذا الجهاز.'
  }
} as const

export default function ActivationPage({ state, language, onActivated }: Props) {
  const text = strings[language]
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  function applyErrorText(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err)
    if (/different device/i.test(message)) return text.errWrongDevice
    if (/already installed/i.test(message)) return text.errAlreadyActive
    if (/too many license attempts/i.test(message)) return text.errTooMany
    if (/already expired/i.test(message)) return text.errExpiredCode
    if (/expires earlier/i.test(message)) return text.errShorterCode
    if (/different product/i.test(message)) return text.errWrongProduct
    if (/newer app version/i.test(message)) return text.errAppTooOld
    if (/not valid yet/i.test(message)) return text.errNotYetValid
    return text.errInvalidCode
  }

  // A .anbc license file from the supplier: its text goes into the code box; main extracts the token.
  async function loadFile(file: File | undefined): Promise<void> {
    if (!file) return
    setError('')
    if (file.size > 8192) {
      setError(text.errInvalidCode)
      return
    }
    setCode((await file.text()).trim())
  }

  async function copyDeviceCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(state.deviceId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
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
      setError(applyErrorText(err))
    } finally {
      setLoading(false)
    }
  }

  const notice =
    state.status === 'expired'
      ? `${text.expired}${state.expiresAt ? ` (${new Date(state.expiresAt).toLocaleDateString()})` : ''}`
      : state.status === 'invalid'
        ? text.invalid
        : text.missing

  return (
    <div className="login-shell">
      <section className="login-panel license-panel">
        <div className="login-brand">
          <img className="login-logo" src={logo} alt="" />
          <div>
            <strong>{text.title}</strong>
            <small>Anubis Pharmacy</small>
          </div>
        </div>

        <p className="license-subtitle">{text.subtitle}</p>

        <p className={`license-notice ${state.status}`} role="status">{notice}</p>

        <dl className="license-info">
          <div>
            <dt>{text.deviceCode}</dt>
            <dd dir="ltr">{state.deviceId || '-'}</dd>
          </div>
        </dl>

        <div className="license-copy-actions">
          <button type="button" onClick={() => void copyDeviceCode()}>
            {copied ? text.copied : text.copy}
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
          <label className="license-file">
            <span>{text.loadFile}</span>
            <input type="file" accept=".anbc,.json,.txt" onChange={(e) => void loadFile(e.target.files?.[0])} />
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
