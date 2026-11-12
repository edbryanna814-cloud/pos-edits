import { useEffect, useState } from 'react'
import type { Language } from '../../shared/settings'

// Where this PC keeps its data: this computer only, or one shared server for several tills.

const strings = {
  en: {
    title: 'Database location',
    current: 'Now:',
    local: 'This computer only',
    shared: 'Shared server (several devices)',
    sharedNow: 'Shared server',
    uri: 'Connection string',
    uriHint: 'From your MongoDB server (for example MongoDB Atlas). Every till that uses the same string shares sales, stock, users and the audit log.',
    test: 'Test connection',
    testing: 'Testing…',
    connected: 'Connected',
    save: 'Save and restart',
    saving: 'Restarting…',
    note: 'The connection string is stored encrypted on this PC and is not shown again.',
    errors: {
      DB_URI_INVALID: 'That is not a MongoDB connection string (it starts with mongodb+srv:// or mongodb://).',
      DB_TLS_REQUIRED: 'The server must use an encrypted connection (mongodb+srv:// or tls=true).',
      DB_LOGIN_REQUIRED: 'The connection string must include the database user name and password.',
      DB_UNREACHABLE: 'The server could not be reached. Check the internet connection and the server address.',
      DB_AUTH_FAILED: 'The user name or password in the connection string was refused.',
      DB_NO_TRANSACTIONS: 'This server cannot be shared safely (it is not a replica set). Use MongoDB Atlas or a replica set.',
      PERMISSION_DENIED: 'Only an administrator can change this.',
      other: 'The setting could not be saved.'
    }
  },
  ar: {
    title: 'مكان قاعدة البيانات',
    current: 'الحالي:',
    local: 'هذا الجهاز فقط',
    shared: 'خادم مشترك (عدة أجهزة)',
    sharedNow: 'خادم مشترك',
    uri: 'رابط الاتصال',
    uriHint: 'من خادم MongoDB الخاص بك (مثل MongoDB Atlas). كل الكاشيرات التي تستخدم نفس الرابط تتشارك المبيعات والمخزون والمستخدمين وسجل التدقيق.',
    test: 'اختبار الاتصال',
    testing: 'جارٍ الاختبار…',
    connected: 'متصل',
    save: 'حفظ وإعادة التشغيل',
    saving: 'جارٍ إعادة التشغيل…',
    note: 'يُحفظ رابط الاتصال مشفّرًا على هذا الجهاز ولا يظهر مرة أخرى.',
    errors: {
      DB_URI_INVALID: 'هذا ليس رابط اتصال MongoDB (يبدأ بـ mongodb+srv:// أو mongodb://).',
      DB_TLS_REQUIRED: 'يجب أن يستخدم الخادم اتصالًا مشفّرًا (mongodb+srv:// أو tls=true).',
      DB_LOGIN_REQUIRED: 'يجب أن يحتوي الرابط على اسم مستخدم قاعدة البيانات وكلمة المرور.',
      DB_UNREACHABLE: 'تعذّر الوصول إلى الخادم. راجع الاتصال بالإنترنت وعنوان الخادم.',
      DB_AUTH_FAILED: 'تم رفض اسم المستخدم أو كلمة المرور الموجودة في الرابط.',
      DB_NO_TRANSACTIONS: 'لا يمكن مشاركة هذا الخادم بأمان (ليس replica set). استخدم MongoDB Atlas أو replica set.',
      PERMISSION_DENIED: 'المدير فقط يمكنه تغيير هذا الإعداد.',
      other: 'تعذّر حفظ الإعداد.'
    }
  }
} as const

type ErrorCode = keyof (typeof strings)['en']['errors']

export default function DatabaseLocation({ language }: { language: Language }) {
  const text = strings[language]
  const [current, setCurrent] = useState<{ mode: 'local' | 'shared'; hosts?: string } | null>(null)
  const [choice, setChoice] = useState<'local' | 'shared'>('local')
  const [uri, setUri] = useState('')
  const [tested, setTested] = useState<string>('')
  const [busy, setBusy] = useState<'' | 'test' | 'save'>('')
  const [error, setError] = useState('')

  useEffect(() => {
    window.api
      .dbConnectionGet()
      .then((state) => {
        setCurrent(state)
        setChoice(state.mode)
      })
      .catch(() => setCurrent({ mode: 'local' }))
  }, [])

  function errorText(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err)
    const code = (Object.keys(text.errors) as ErrorCode[]).find((key) => key !== 'other' && message.includes(key))
    return text.errors[code ?? 'other']
  }

  async function test(): Promise<void> {
    setError('')
    setTested('')
    setBusy('test')
    try {
      const result = await window.api.dbConnectionTest({ uri })
      setTested(`${text.connected}: ${result.hosts} · MongoDB ${result.serverVersion}`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy('')
    }
  }

  async function save(): Promise<void> {
    setError('')
    setBusy('save')
    try {
      await window.api.dbConnectionSave(choice === 'shared' ? { mode: 'shared', uri } : { mode: 'local' })
    } catch (err) {
      setError(errorText(err))
      setBusy('')
    }
  }

  const unchanged = current?.mode === 'local' && choice === 'local'
  const canSave = !busy && !unchanged && (choice === 'local' || Boolean(tested))

  return (
    <section className="panel db-location" aria-labelledby="db-location-title">
      <h3 id="db-location-title">{text.title}</h3>
      <p className="muted">
        {text.current} {current?.mode === 'shared' ? `${text.sharedNow} (${current.hosts})` : text.local}
      </p>
      <div className="db-location-choice" role="radiogroup" aria-label={text.title}>
        <label>
          <input type="radio" name="db-mode" checked={choice === 'local'} onChange={() => setChoice('local')} />
          <span>{text.local}</span>
        </label>
        <label>
          <input type="radio" name="db-mode" checked={choice === 'shared'} onChange={() => setChoice('shared')} />
          <span>{text.shared}</span>
        </label>
      </div>
      {choice === 'shared' ? (
        <label className="wide">
          <span>{text.uri}</span>
          <input
            type="password"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            placeholder="mongodb+srv://user:password@cluster.example.mongodb.net/"
            value={uri}
            onChange={(e) => {
              setUri(e.target.value)
              setTested('')
            }}
          />
          <small className="muted">{text.uriHint}</small>
        </label>
      ) : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {tested ? <p className="success" role="status">{tested}</p> : null}
      <div className="form-actions">
        {choice === 'shared' ? (
          <button type="button" onClick={() => void test()} disabled={busy !== '' || !uri.trim()}>
            {busy === 'test' ? text.testing : text.test}
          </button>
        ) : null}
        <button type="button" className="primary" onClick={() => void save()} disabled={!canSave}>
          {busy === 'save' ? text.saving : text.save}
        </button>
      </div>
      <p className="hint">{text.note}</p>
    </section>
  )
}
