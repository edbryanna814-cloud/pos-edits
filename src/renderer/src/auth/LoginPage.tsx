import { useEffect, useState } from 'react'
import type { LoginResult } from '../../../shared/auth'
import { t, type TranslationKey } from '../i18n'
import type { Language } from '../../../shared/settings'
import DatabaseLocation from '../DatabaseLocation'
import RecoveryPanel from './RecoveryPanel'

interface Props {
  language: Language
  onLogin: (token: string, user: { username: string; role: string; permissions: any[] }) => void
  /** The database could not be reached: offer the database location (shared server) before sign-in. */
  dbUnavailable?: boolean
}

type Mode = 'checking' | 'setup' | 'login' | 'change'

const MIN_PASSWORD_LENGTH = 3

// Main returns stable codes (src/main/auth.ts AUTH_ERRORS, src/main/password.ts); map them to AR/EN text.
const ERROR_KEYS: [string, TranslationKey][] = [
  ['PASSWORD_TOO_SHORT', 'errPasswordTooShort'],
  ['PASSWORD_TOO_LONG', 'errPasswordTooLong'],
  ['PASSWORD_REUSED', 'errPasswordReused'],
  ['SETUP_NOT_ALLOWED', 'errSetupNotAllowed'],
  ['LOGIN_FAILED', 'errLoginFailed']
]

function errorText(language: Language, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const match = ERROR_KEYS.find(([code]) => message.includes(code))
  return match ? t(language, match[1]) : message
}

export default function LoginPage({ language, onLogin, dbUnavailable }: Props) {
  const [showDb, setShowDb] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [mode, setMode] = useState<Mode>('checking')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pending, setPending] = useState<LoginResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    window.api
      .authSetupRequired()
      .then((required) => setMode(required ? 'setup' : 'login'))
      .catch(() => setMode('login'))
  }, [])

  async function run(action: () => Promise<void>) {
    setError('')
    setLoading(true)
    try {
      await action()
    } catch (err) {
      setError(errorText(language, err))
    } finally {
      setLoading(false)
    }
  }

  function finish(result: LoginResult) {
    if (result.mustChangePassword) {
      setPending(result)
      setNewPassword('')
      setConfirm('')
      setMode('change')
      return
    }
    onLogin(result.token, result.user)
  }

  function checkNew(value: string): boolean {
    if (value.length < MIN_PASSWORD_LENGTH) {
      setError(t(language, 'errPasswordTooShort'))
      return false
    }
    if (value !== confirm) {
      setError(t(language, 'errPasswordMismatch'))
      return false
    }
    return true
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'setup') {
      if (!checkNew(password)) return
      void run(async () => finish(await window.api.authSetup({ username, password })))
    } else if (mode === 'change') {
      if (!checkNew(newPassword) || !pending) return
      void run(async () => {
        await window.api.authChangePassword({ currentPassword: password, newPassword })
        onLogin(pending.token, pending.user)
      })
    } else {
      void run(async () => finish(await window.api.authLogin({ username, password })))
    }
  }

  const titleKey: TranslationKey = mode === 'setup' ? 'adminSetupTitle' : mode === 'change' ? 'changePasswordTitle' : 'loginTitle'
  const subtitleKey: TranslationKey = mode === 'setup' ? 'adminSetupSubtitle' : mode === 'change' ? 'changePasswordSubtitle' : 'loginSubtitle'
  const buttonKey: TranslationKey = mode === 'setup' ? 'createAdmin' : mode === 'change' ? 'savePassword' : 'login'

  return (
    <div className="login-shell">
      <section className="login-panel">
        <div className="login-brand">
          <span className="login-logo" aria-hidden="true">P</span>
          <div>
            <strong>{t(language, 'appName')}</strong>
            <small>{t(language, 'appSubtitle')}</small>
          </div>
        </div>
        <div className="login-header">
          <h1>{t(language, titleKey)}</h1>
          <p>{t(language, subtitleKey)}</p>
        </div>
        {mode === 'checking' ? (
          <p role="status">{t(language, 'checking')}</p>
        ) : (
          <form onSubmit={submit} className="login-form">
            {mode !== 'change' ? (
              <label>
                <span>{t(language, 'username')}</span>
                <input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </label>
            ) : null}
            <label>
              <span>{t(language, mode === 'change' ? 'currentPassword' : 'password')}</span>
              <input
                type="password"
                autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {mode === 'change' ? (
              <label>
                <span>{t(language, 'newPassword')}</span>
                <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </label>
            ) : null}
            {mode !== 'login' ? (
              <label>
                <span>{t(language, 'confirmPassword')}</span>
                <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </label>
            ) : null}
            {error ? <p className="login-error" role="alert">{error}</p> : null}
            <button type="submit" disabled={loading}>
              {loading ? t(language, 'loggingIn') : t(language, buttonKey)}
            </button>
          </form>
        )}
        {mode === 'setup' || dbUnavailable ? (
          <button type="button" className="link-button" onClick={() => setShowDb(!showDb)}>
            {t(language, 'databaseLocation')}
          </button>
        ) : null}
        {showDb ? <DatabaseLocation language={language} /> : null}
        {mode === 'login' && !dbUnavailable ? (
          <button type="button" className="link-button" onClick={() => setShowRecovery(!showRecovery)}>
            {language === 'ar' ? 'نسيت اسم المستخدم أو كلمة المرور؟' : 'Forgot username or password?'}
          </button>
        ) : null}
        {showRecovery ? <RecoveryPanel language={language} /> : null}
      </section>
    </div>
  )
}
