import { useEffect, useState, type FormEvent } from 'react'
import type { Language } from '../../../shared/settings'

// Forgot password: passwords cannot be read back, only replaced. The vendor signs a one-time reset code
// for this device's code + request code in the license panel; it unlocks setting a new administrator password.

const strings = {
  en: {
    title: 'Forgot username or password',
    intro: 'Send these two codes to your system provider. They will send back a reset code (valid 1 hour).',
    device: 'Device code',
    request: 'Request code',
    code: 'Reset code',
    verify: 'Check reset code',
    account: 'Administrator account',
    password: 'New password (at least 12 characters)',
    confirm: 'Confirm new password',
    save: 'Set new password',
    done: 'Password changed. Sign in with the account above and the new password.',
    mismatch: 'The two passwords do not match.',
    errors: {
      RESET_CODE_INVALID: 'That reset code is not valid. Copy it again exactly as received.',
      RESET_CODE_WRONG_DEVICE: 'That reset code was made for a different device.',
      RESET_CODE_WRONG_REQUEST: 'That reset code was made for an older request code. Send the request code shown now.',
      RESET_CODE_EXPIRED: 'That reset code has expired. Ask for a new one.',
      RESET_NOT_UNLOCKED: 'Time ran out. Check the reset code again.',
      PASSWORD_TOO_SHORT: 'The password must be at least 12 characters.',
      PASSWORD_TOO_LONG: 'The password is too long.',
      other: 'Something went wrong. Try again.'
    }
  },
  ar: {
    title: 'نسيت اسم المستخدم أو كلمة المرور',
    intro: 'أرسل هذين الرمزين إلى مزوّد النظام، وسيرسل لك رمز إعادة تعيين (صالح لمدة ساعة).',
    device: 'رمز الجهاز',
    request: 'رمز الطلب',
    code: 'رمز إعادة التعيين',
    verify: 'تحقق من الرمز',
    account: 'حساب المدير',
    password: 'كلمة مرور جديدة (12 حرفًا على الأقل)',
    confirm: 'تأكيد كلمة المرور الجديدة',
    save: 'تعيين كلمة المرور',
    done: 'تم تغيير كلمة المرور. سجّل الدخول بالحساب أعلاه وكلمة المرور الجديدة.',
    mismatch: 'كلمتا المرور غير متطابقتين.',
    errors: {
      RESET_CODE_INVALID: 'رمز إعادة التعيين غير صالح. انسخه مرة أخرى كما وصلك تمامًا.',
      RESET_CODE_WRONG_DEVICE: 'هذا الرمز صادر لجهاز آخر.',
      RESET_CODE_WRONG_REQUEST: 'هذا الرمز صادر لرمز طلب قديم. أرسل رمز الطلب الظاهر الآن.',
      RESET_CODE_EXPIRED: 'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.',
      RESET_NOT_UNLOCKED: 'انتهى الوقت. تحقق من الرمز مرة أخرى.',
      PASSWORD_TOO_SHORT: 'يجب أن تكون كلمة المرور 12 حرفًا على الأقل.',
      PASSWORD_TOO_LONG: 'كلمة المرور طويلة جدًا.',
      other: 'حدث خطأ. حاول مرة أخرى.'
    }
  }
} as const

type ErrorCode = keyof (typeof strings)['en']['errors']

export default function RecoveryPanel({ language }: { language: Language }) {
  const text = strings[language]
  const [request, setRequest] = useState<{ deviceId: string; requestCode: string } | null>(null)
  const [code, setCode] = useState('')
  const [admins, setAdmins] = useState<string[] | null>(null)
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    window.api.authRecoveryStart().then(setRequest).catch(() => setError(text.errors.other))
  }, [])

  function errorText(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err)
    const found = (Object.keys(text.errors) as ErrorCode[]).find((key) => key !== 'other' && message.includes(key))
    return text.errors[found ?? 'other']
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setError('')
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  function verify(event: FormEvent): void {
    event.preventDefault()
    void run(async () => {
      const result = await window.api.authRecoveryVerify({ code })
      setAdmins(result.admins)
      setAccount(result.admins[0] ?? '')
    })
  }

  function save(event: FormEvent): void {
    event.preventDefault()
    if (password !== confirm) return setError(text.mismatch)
    void run(async () => {
      await window.api.authRecoveryReset({ username: account, password })
      setDone(true)
    })
  }

  return (
    <section className="recovery-panel" aria-labelledby="recovery-title">
      <h2 id="recovery-title">{text.title}</h2>
      {done ? (
        <p className="success" role="status">{text.done} ({account})</p>
      ) : admins ? (
        <form onSubmit={save} className="login-form">
          <label>
            <span>{text.account}</span>
            <select value={account} onChange={(e) => setAccount(e.target.value)}>
              {admins.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>
            <span>{text.password}</span>
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label>
            <span>{text.confirm}</span>
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </label>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={busy || !account}>{text.save}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="login-form">
          <p className="muted">{text.intro}</p>
          <dl className="recovery-codes">
            <div><dt>{text.device}</dt><dd dir="ltr" className="mono">{request?.deviceId ?? '…'}</dd></div>
            <div><dt>{text.request}</dt><dd dir="ltr" className="mono">{request?.requestCode ?? '…'}</dd></div>
          </dl>
          <label>
            <span>{text.code}</span>
            <textarea dir="ltr" rows={3} spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={busy || !code.trim()}>{text.verify}</button>
        </form>
      )}
    </section>
  )
}
