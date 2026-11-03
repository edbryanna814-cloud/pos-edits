import { useState } from 'react'
import type { LoginInput } from '../../../shared/auth'
import { t, type TranslationKey } from '../i18n'
import type { Language } from '../../../shared/settings'

interface Props {
  language: Language
  onLogin: (token: string, user: { username: string; role: string; permissions: any[] }) => void
}

export default function LoginPage({ language, onLogin }: Props) {
  const [form, setForm] = useState<LoginInput>({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await window.api.authLogin(form)
      onLogin(result.token, result.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

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
          <h1>{t(language, 'loginTitle')}</h1>
          <p>{t(language, 'loginSubtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <label>
            <span>{t(language, 'username')}</span>
            <input
              autoFocus
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </label>
          <label>
            <span>{t(language, 'password')}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? t(language, 'loggingIn') : t(language, 'login')}
          </button>
        </form>
        <p className="hint">{t(language, 'defaultAdmin')}</p>
      </section>
    </div>
  )
}
