import { useEffect, useState } from 'react'
import type { Language } from '../../shared/settings'

// Where this PC keeps its data: this computer only; the main computer for the other tills on the same
// Wi-Fi; a till that joins the main computer by its IP; or one shared server over the internet.

type Mode = 'local' | 'host' | 'join' | 'shared'
type State = { mode: 'local' | 'shared' | 'host'; hosts?: string; ips: string[]; port: number; joinCode?: string }

const strings = {
  en: {
    title: 'Database location',
    current: 'Now:',
    local: 'This computer only',
    host: 'Main computer for the other devices on this Wi-Fi',
    join: 'Connect to the main computer on this Wi-Fi',
    shared: 'Shared server over the internet (several branches)',
    hostNow: 'Main computer on the Wi-Fi',
    sharedNow: 'Connected to',
    thisIp: 'This computer’s Wi-Fi IP address',
    noIp: 'not connected to a network',
    hostInfo: 'On each other device choose “Connect to the main computer” and enter:',
    joinCode: 'Join code',
    hostHint: 'After the restart the other devices on the same Wi-Fi use this computer’s database, so it must stay on. If Windows asks to allow “mongod”, choose Private networks and Allow. Ask the router admin to keep this computer’s IP address fixed.',
    hostIp: 'Main computer’s IP address',
    joinHint: 'Shown on the main computer in Settings → Database location.',
    uri: 'Connection string',
    uriHint: 'From your MongoDB server (for example MongoDB Atlas). Every till that uses the same string shares sales, stock, users and the audit log.',
    test: 'Test connection',
    testing: 'Testing…',
    connected: 'Connected',
    save: 'Save and restart',
    saving: 'Restarting…',
    note: 'Connection details are stored encrypted on this PC.',
    errors: {
      DB_URI_INVALID: 'That is not a MongoDB connection string (it starts with mongodb+srv:// or mongodb://).',
      DB_TLS_REQUIRED: 'The server must use an encrypted connection (mongodb+srv:// or tls=true).',
      DB_LOGIN_REQUIRED: 'The connection string must include the database user name and password.',
      DB_LAN_ADDRESS_INVALID: 'Enter the main computer’s Wi-Fi IP address, for example 192.168.1.10.',
      DB_JOIN_CODE_INVALID: 'Enter the join code as shown on the main computer, for example ABCD-EFGH-JKMN.',
      DB_UNREACHABLE: 'Could not reach it. Check that both devices are on the same Wi-Fi, the main computer is on, and the address is right.',
      DB_AUTH_FAILED: 'The join code (or the user name and password) was refused.',
      DB_NO_TRANSACTIONS: 'This server cannot be shared safely (it is not a replica set). Use MongoDB Atlas or a replica set.',
      PERMISSION_DENIED: 'Only an administrator can change this.',
      other: 'The setting could not be saved.'
    }
  },
  ar: {
    title: 'مكان قاعدة البيانات',
    current: 'الحالي:',
    local: 'هذا الجهاز فقط',
    host: 'الجهاز الرئيسي لباقي الأجهزة على نفس الواي فاي',
    join: 'الاتصال بالجهاز الرئيسي على نفس الواي فاي',
    shared: 'خادم مشترك عبر الإنترنت (عدة فروع)',
    hostNow: 'الجهاز الرئيسي على الواي فاي',
    sharedNow: 'متصل بـ',
    thisIp: 'عنوان IP لهذا الجهاز على الواي فاي',
    noIp: 'غير متصل بشبكة',
    hostInfo: 'على كل جهاز آخر اختر «الاتصال بالجهاز الرئيسي» وأدخل:',
    joinCode: 'رمز الانضمام',
    hostHint: 'بعد إعادة التشغيل تستخدم باقي الأجهزة على نفس الواي فاي قاعدة بيانات هذا الجهاز، لذا يجب أن يبقى يعمل. إذا طلب ويندوز السماح لـ «mongod» اختر الشبكات الخاصة ثم سماح. اطلب تثبيت عنوان IP لهذا الجهاز من الراوتر.',
    hostIp: 'عنوان IP للجهاز الرئيسي',
    joinHint: 'يظهر على الجهاز الرئيسي في الإعدادات ← مكان قاعدة البيانات.',
    uri: 'رابط الاتصال',
    uriHint: 'من خادم MongoDB الخاص بك (مثل MongoDB Atlas). كل الكاشيرات التي تستخدم نفس الرابط تتشارك المبيعات والمخزون والمستخدمين وسجل التدقيق.',
    test: 'اختبار الاتصال',
    testing: 'جارٍ الاختبار…',
    connected: 'متصل',
    save: 'حفظ وإعادة التشغيل',
    saving: 'جارٍ إعادة التشغيل…',
    note: 'تُحفظ بيانات الاتصال مشفّرة على هذا الجهاز.',
    errors: {
      DB_URI_INVALID: 'هذا ليس رابط اتصال MongoDB (يبدأ بـ mongodb+srv:// أو mongodb://).',
      DB_TLS_REQUIRED: 'يجب أن يستخدم الخادم اتصالًا مشفّرًا (mongodb+srv:// أو tls=true).',
      DB_LOGIN_REQUIRED: 'يجب أن يحتوي الرابط على اسم مستخدم قاعدة البيانات وكلمة المرور.',
      DB_LAN_ADDRESS_INVALID: 'أدخل عنوان IP للجهاز الرئيسي على الواي فاي، مثل 192.168.1.10.',
      DB_JOIN_CODE_INVALID: 'أدخل رمز الانضمام كما يظهر على الجهاز الرئيسي، مثل ABCD-EFGH-JKMN.',
      DB_UNREACHABLE: 'تعذّر الوصول. تأكد أن الجهازين على نفس الواي فاي وأن الجهاز الرئيسي يعمل وأن العنوان صحيح.',
      DB_AUTH_FAILED: 'تم رفض رمز الانضمام (أو اسم المستخدم وكلمة المرور).',
      DB_NO_TRANSACTIONS: 'لا يمكن مشاركة هذا الخادم بأمان (ليس replica set). استخدم MongoDB Atlas أو replica set.',
      PERMISSION_DENIED: 'المدير فقط يمكنه تغيير هذا الإعداد.',
      other: 'تعذّر حفظ الإعداد.'
    }
  }
} as const

type ErrorCode = keyof (typeof strings)['en']['errors']

export default function DatabaseLocation({ language }: { language: Language }) {
  const text = strings[language]
  const [current, setCurrent] = useState<State | null>(null)
  const [choice, setChoice] = useState<Mode>('local')
  const [uri, setUri] = useState('')
  const [ip, setIp] = useState('')
  const [code, setCode] = useState('')
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
      .catch(() => setCurrent({ mode: 'local', ips: [], port: 0 }))
  }, [])

  function pick(next: Mode): void {
    setChoice(next)
    setTested('')
    setError('')
  }

  function errorText(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err)
    const found = (Object.keys(text.errors) as ErrorCode[]).find((key) => key !== 'other' && message.includes(key))
    return text.errors[found ?? 'other']
  }

  async function test(): Promise<void> {
    setError('')
    setTested('')
    setBusy('test')
    try {
      const result = await window.api.dbConnectionTest(choice === 'join' ? { ip, code } : { uri })
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
      await window.api.dbConnectionSave(
        choice === 'shared' ? { mode: 'shared', uri } : choice === 'join' ? { mode: 'join', ip, code } : { mode: choice }
      )
    } catch (err) {
      setError(errorText(err))
      setBusy('')
    }
  }

  const needsTest = choice === 'shared' || choice === 'join'
  const unchanged = (choice === 'local' || choice === 'host') && current?.mode === choice
  const canSave = !busy && !unchanged && (!needsTest || Boolean(tested))
  const ips = current?.ips.length ? current.ips.join(', ') : text.noIp
  const now = current?.mode === 'shared' ? `${text.sharedNow} ${current.hosts}` : current?.mode === 'host' ? text.hostNow : text.local

  return (
    <section className="panel db-location" aria-labelledby="db-location-title">
      <h3 id="db-location-title">{text.title}</h3>
      <p className="muted">
        {text.current} {now} · {text.thisIp}: <span dir="ltr">{ips}</span>
      </p>
      {current?.mode === 'host' && current.joinCode ? (
        <div className="db-host-info" role="status">
          <p>{text.hostInfo}</p>
          <p>
            {text.hostIp}: <strong dir="ltr">{ips}</strong>
            <br />
            {text.joinCode}: <strong dir="ltr" className="mono">{current.joinCode}</strong>
          </p>
        </div>
      ) : null}
      <div className="db-location-choice" role="radiogroup" aria-label={text.title}>
        {(['local', 'host', 'join', 'shared'] as const).map((mode) => (
          <label key={mode}>
            <input type="radio" name="db-mode" checked={choice === mode} onChange={() => pick(mode)} />
            <span>{text[mode]}</span>
          </label>
        ))}
      </div>
      {choice === 'host' && current?.mode !== 'host' ? <p className="hint">{text.hostHint}</p> : null}
      {choice === 'join' ? (
        <>
          <label className="wide">
            <span>{text.hostIp}</span>
            <input dir="ltr" inputMode="decimal" autoComplete="off" spellCheck={false} placeholder="192.168.1.10" value={ip}
              onChange={(e) => { setIp(e.target.value); setTested('') }} />
          </label>
          <label className="wide">
            <span>{text.joinCode}</span>
            <input dir="ltr" type="password" autoComplete="off" spellCheck={false} placeholder="ABCD-EFGH-JKMN" value={code}
              onChange={(e) => { setCode(e.target.value); setTested('') }} />
            <small className="muted">{text.joinHint}</small>
          </label>
        </>
      ) : null}
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
        {needsTest ? (
          <button type="button" onClick={() => void test()} disabled={busy !== '' || (choice === 'join' ? !ip.trim() || !code.trim() : !uri.trim())}>
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
