import {
  Component,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode
} from 'react'
import type { DbHealth, LicenseState } from '../../shared/ipc'
import type { Language, StoredCompanySettings } from '../../shared/settings'
import { t, type TranslationKey } from './i18n'
import SettingsPage from './SettingsPage'
import LoginPage from './auth/LoginPage'
import ActivationPage from './license/ActivationPage'

type SectionId = 'dashboard' | 'pos' | 'inventory' | 'crm' | 'reports' | 'settings' | 'users' | 'audit'

interface Section {
  id: SectionId
  labelKey: TranslationKey
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  phaseKey: TranslationKey
}

const sections: Section[] = [
  {
    id: 'dashboard',
    labelKey: 'dashboard',
    titleKey: 'dashboardTitle',
    descriptionKey: 'dashboardDesc',
    phaseKey: 'nextPhase2'
  },
  {
    id: 'pos',
    labelKey: 'pos',
    titleKey: 'posTitle',
    descriptionKey: 'posDesc',
    phaseKey: 'nextPhase6'
  },
  {
    id: 'inventory',
    labelKey: 'inventory',
    titleKey: 'inventoryTitle',
    descriptionKey: 'inventoryDesc',
    phaseKey: 'nextPhase5'
  },
  {
    id: 'crm',
    labelKey: 'crm',
    titleKey: 'crmTitle',
    descriptionKey: 'crmDesc',
    phaseKey: 'nextPhase4'
  },
  {
    id: 'reports',
    labelKey: 'reports',
    titleKey: 'reportsTitle',
    descriptionKey: 'reportsDesc',
    phaseKey: 'nextPhase7'
  },
  {
    id: 'users',
    labelKey: 'users',
    titleKey: 'users',
    descriptionKey: 'settingsDesc',
    phaseKey: 'nextPhase3'
  },
  {
    id: 'audit',
    labelKey: 'audit',
    titleKey: 'audit',
    descriptionKey: 'settingsDesc',
    phaseKey: 'nextPhase3'
  },
  {
    id: 'settings',
    labelKey: 'settings',
    titleKey: 'settingsTitle',
    descriptionKey: 'settingsDesc',
    phaseKey: 'nextPhase2'
  }
]

type IpcStatus = 'checking' | 'ready' | 'failed'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[renderer] unhandled error', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal">
          <h1>{t('en', 'somethingWrong')}</h1>
          <p>{this.state.error.message}</p>
          <button type="button" onClick={() => window.location.reload()}>
            {t('en', 'reload')}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

function DatabasePanel({
  db,
  language,
  onRetry
}: {
  db: DbHealth | null
  language: Language
  onRetry: () => void
}) {
  const connected = db?.status === 'connected'

  return (
    <section className="panel db-panel" aria-labelledby="db-title">
      <div className="section-header">
        <div>
          <h2 id="db-title">{t(language, 'database')}</h2>
          <p className="muted">{t(language, 'dbCheckBody')}</p>
        </div>
        <span className={`status-pill ${connected ? 'ok' : db ? 'danger' : 'checking'}`}>
          {connected
            ? t(language, 'connected')
            : db
              ? t(language, 'disconnected')
              : t(language, 'checking')}
        </span>
      </div>

      {db ? (
        <dl className="status-grid">
          <div>
            <dt>{t(language, 'database')}</dt>
            <dd>{db.database}</dd>
          </div>
          <div>
            <dt>{t(language, 'serverVersion')}</dt>
            <dd>{db.serverVersion ?? '-'}</dd>
          </div>
          <div>
            <dt>{t(language, 'topology')}</dt>
            <dd>{db.topology ?? '-'}</dd>
          </div>
          <div>
            <dt>{t(language, 'transactions')}</dt>
            <dd>
              {db.supportsTransactions
                ? t(language, 'supported')
                : t(language, 'unsupported')}
            </dd>
          </div>
          <div>
            <dt>{t(language, 'latency')}</dt>
            <dd>{db.latencyMs != null ? `${db.latencyMs} ms` : '-'}</dd>
          </div>
        </dl>
      ) : null}

      {db?.error ? <p className="error">{db.error}</p> : null}

      <button type="button" onClick={onRetry}>
        {t(language, 'retry')}
      </button>
    </section>
  )
}

function SetupBanner({
  language,
  onOpen
}: {
  language: Language
  onOpen: () => void
}) {
  return (
    <section className="setup-banner" role="status">
      <div>
        <strong>{t(language, 'setupTitle')}</strong>
        <p>{t(language, 'setupBody')}</p>
      </div>
      <button type="button" className="primary" onClick={onOpen}>
        {t(language, 'openSettings')}
      </button>
    </section>
  )
}

export default function App() {
  const [active, setActive] = useState<SectionId>('dashboard')
  const [version, setVersion] = useState('unknown')
  const [ipc, setIpc] = useState<IpcStatus>('checking')
  const [language, setLanguage] = useState<Language>('en')
  const [db, setDb] = useState<DbHealth | null>(null)
  const [settings, setSettings] = useState<StoredCompanySettings | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'))
  const [authUser, setAuthUser] = useState<{ username: string; role: string; permissions: any[] } | null>(null)
  const [license, setLicense] = useState<LicenseState | null>(null)
  const [licenseLoaded, setLicenseLoaded] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [audit, setAudit] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [deals, setDeals] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [cashbox, setCashbox] = useState<any[]>([])
  const [reportSales, setReportSales] = useState<any>(null)
  const [reportCashbox, setReportCashbox] = useState<any>(null)
  const [reportInv, setReportInv] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [subPlans, setSubPlans] = useState<any[]>([])
  const [licenses, setLicenses] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [replacements, setReplacements] = useState<any[]>([])

  const section = sections.find((item) => item.id === active) ?? sections[0]
  const dbConnected = db?.status === 'connected'
  const dbState = dbConnected ? 'ready' : db ? 'failed' : 'checking'
  const dbLabel = dbConnected
    ? t(language, 'connected')
    : db
      ? t(language, 'disconnected')
      : t(language, 'checking')

  async function load(): Promise<void> {
    if (!window.api) {
      setIpc('failed')
      setVersion('unavailable')
      setSettingsLoaded(true)
      return
    }

    try {
      const health = await window.api.dbHealth()
      setDb(health)
    } catch (error) {
      setDb({
        status: 'disconnected',
        database: 'unknown',
        supportsTransactions: false,
        error: errorMessage(error)
      })
    }

    try {
      const loaded = await window.api.getSettings()
      setSettings(loaded)
      setSettingsError('')
      if (loaded) setLanguage(loaded.defaultLanguage)
    } catch (error) {
      setSettingsError(errorMessage(error))
    } finally {
      setSettingsLoaded(true)
    }
  }

  useEffect(() => {
    if (!window.api) {
      setIpc('failed')
      setVersion('unavailable')
      setSettingsLoaded(true)
      setLicenseLoaded(true)
      return
    }

    window.api
      .ping()
      .then((value) => setIpc(value === 'pong' ? 'ready' : 'failed'))
      .catch(() => setIpc('failed'))

    window.api
      .getVersion()
      .then((value) => setVersion(value))
      .catch(() => setVersion('unavailable'))

    window.api
      .licenseStatus()
      .then((state) => setLicense(state))
      .catch(() =>
        setLicense({ status: 'invalid', mac: '', deviceId: '', reason: 'License check failed' })
      )
      .finally(() => setLicenseLoaded(true))

    void load()
    void loadAuth()
  }, [])

  useEffect(() => {
    if (active === 'users' && token) void loadUsers()
    if (active === 'users' && token) void loadRoles()
    if (active === 'audit' && token) void loadAudit()
    if (active === 'crm' && token) void loadCrm()
    if (active === 'inventory' && token) void loadInventory()
    if (active === 'pos' && token) void loadPos()
    if (active === 'reports' && token) void loadReports()
    if (active === 'settings' && token) void loadSubscription()
    if (active === 'settings' && token) void loadLicensing()
  }, [active, token])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])

  function handleSaved(saved: StoredCompanySettings): void {
    setSettings(saved)
    setSettingsError('')
    setLanguage(saved.defaultLanguage)
  }

  function handleReload(): void {
    void load()
  }

  function handleLogin(newToken: string, user: { username: string; role: string; permissions: any[] }): void {
    setToken(newToken)
    setAuthUser(user)
    localStorage.setItem('authToken', newToken)
  }

  async function handleLogout(): Promise<void> {
    if (token) {
      try {
        await window.api.authLogout(token)
      } catch {}
    }
    setToken(null)
    setAuthUser(null)
    localStorage.removeItem('authToken')
  }

  async function loadAuth(): Promise<void> {
    if (!window.api || !token) return
    try {
      const state = await window.api.authState(token)
      if (state.authenticated && state.user) setAuthUser(state.user)
      else handleLogout()
    } catch {
      handleLogout()
    }
  }

  async function loadUsers(): Promise<void> {
    if (!window.api) return
    try {
      setUsers(await window.api.usersList())
    } catch {}
  }

  async function loadRoles(): Promise<void> {
    if (!window.api) return
    try {
      setRoles(await window.api.rolesList())
    } catch {}
  }

  async function loadAudit(): Promise<void> {
    if (!window.api) return
    try {
      setAudit(await window.api.auditList(50))
    } catch {}
  }

  async function loadCrm(): Promise<void> {
    if (!window.api) return
    try {
      setCustomers(await window.api.crmCustomersList())
      setLeads(await window.api.crmLeadsList())
      setDeals(await window.api.crmDealsList())
      setActivities(await window.api.crmActivitiesList())
    } catch {}
  }

  async function loadInventory(): Promise<void> {
    if (!window.api) return
    try {
      setProducts(await window.api.invProductsList())
      setSuppliers(await window.api.invSuppliersList())
      setPurchaseOrders(await window.api.invPOList())
    } catch {}
  }

  async function loadPos(): Promise<void> {
    if (!window.api) return
    try {
      setSales(await window.api.posSalesList())
      setCashbox(await window.api.posCashboxList())
    } catch {}
  }

  async function loadReports(): Promise<void> {
    if (!window.api) return
    try {
      setReportSales(await window.api.reportsSales())
      setReportCashbox(await window.api.reportsCashbox())
      setReportInv(await window.api.reportsInventory())
    } catch {}
  }

  async function loadSubscription(): Promise<void> {
    if (!window.api) return
    try {
      setSubscription(await window.api.subGet())
      setSubPlans(await window.api.subPlansList())
    } catch {}
  }

  async function loadLicensing(): Promise<void> {
    if (!window.api) return
    try {
      setLicenses(await window.api.licList())
      setReplacements(await window.api.licReplList())
      setDevices([])
    } catch {}
  }

  const languageToggle = (
    <div style={{ position: 'absolute', top: 10, insetInlineEnd: 10 }}>
      <div className="language-toggle" role="group" aria-label={t(language, 'language')}>
        <button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
        <button type="button" className={language === 'ar' ? 'active' : ''} aria-pressed={language === 'ar'} onClick={() => setLanguage('ar')}>AR</button>
      </div>
    </div>
  )

  if (!licenseLoaded) {
    return (
      <div className="login-shell">
        {languageToggle}
        <div className="login-panel license-loading" role="status">
          {t(language, 'checking')}
        </div>
      </div>
    )
  }

  if (license && license.status !== 'valid') {
    return (
      <>
        {languageToggle}
        <ActivationPage state={license} language={language} onActivated={setLicense} />
      </>
    )
  }

  if (!token || !authUser) {
    return (
      <>
        {languageToggle}
        <LoginPage language={language} onLogin={handleLogin} />
      </>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <div>
            <strong>{t(language, 'appName')}</strong>
            <small>{t(language, 'appSubtitle')}</small>
          </div>
        </div>

        <nav aria-label={t(language, 'mainNavigation')}>
          {sections.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === active ? 'nav-item active' : 'nav-item'}
              aria-current={item.id === active ? 'page' : undefined}
              onClick={() => setActive(item.id)}
            >
              <span className="nav-dot" aria-hidden="true" />
              {t(language, item.labelKey)}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className={`status-dot ${dbState}`} aria-hidden="true" />
          <span>
            {t(language, 'database')}: {dbLabel}
          </span>
          <span className="version">v{version}</span>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <div>{authUser.username} ({authUser.role})</div>
            <button type="button" onClick={() => void handleLogout()} style={{ marginTop: 4 }}>{t(language, 'logout')}</button>
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="content-header">
          <div>
            <p className="eyebrow">{t(language, 'phase')}</p>
            <h1>{t(language, section.titleKey)}</h1>
            <p className="muted">{t(language, section.descriptionKey)}</p>
          </div>
          <div className="header-actions">
            <div className="language-toggle" role="group" aria-label={t(language, 'language')}>
              <button
                type="button"
                className={language === 'en' ? 'active' : ''}
                aria-pressed={language === 'en'}
                onClick={() => setLanguage('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={language === 'ar' ? 'active' : ''}
                aria-pressed={language === 'ar'}
                onClick={() => setLanguage('ar')}
              >
                AR
              </button>
            </div>
            <span className="phase-badge">{t(language, 'secureShell')}</span>
          </div>
        </header>

        {active === 'settings' ? (
          <>
            <SettingsPage
              settings={settings}
              language={language}
              settingsError={settingsError}
              onSaved={handleSaved}
              onReload={handleReload}
            />
            <section className="panel" style={{ marginTop: 16 }}>
              <h2>Subscription</h2>
              {subscription ? (
                <div>
                  <p>Status: {subscription.status}</p>
                  <p>Next renewal: {subscription.nextRenewalDate}</p>
                  <button type="button" onClick={async () => { await window.api.subRenew(); void loadSubscription() }}>Renew</button>
                </div>
              ) : (
                <p>No subscription</p>
              )}
              <h3 style={{ marginTop: 16 }}>Plans</h3>
              <ul>
                {subPlans.map((p: any) => (
                  <li key={p._id || p.name}>{p.name} - {p.priceCents} {p.currency} / {p.billingPeriod}</li>
                ))}
              </ul>
            </section>
            <section className="panel" style={{ marginTop: 16 }}>
              <h2>Licensing</h2>
              <p>Licenses: {licenses.length}, Devices: {devices.length}, Replacements: {replacements.length}</p>
              <ul>
                {licenses.map((l: any) => (
                  <li key={l.licenseId}>License {l.licenseId} - max {l.maxActiveDevices}, active {l.currentActiveDeviceCount}, status {l.status}</li>
                ))}
              </ul>
              <h3 style={{ marginTop: 12 }}>Replacement Requests</h3>
              <ul>
                {replacements.map((r: any) => (
                  <li key={r.requestId}>{r.requestId} - {r.status}</li>
                ))}
              </ul>
            </section>
          </>
        ) : active === 'users' ? (
          <section className="panel">
            <h2>{t(language, 'users')}</h2>
            <table style={{ width: '100%', marginTop: 16 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>{t(language, 'username')}</th>
                  <th style={{ textAlign: 'left' }}>{t(language, 'role')}</th>
                  <th style={{ textAlign: 'left' }}>{t(language, 'active')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u._id || u.username}>
                    <td>{u.username}</td>
                    <td>{u.role}</td>
                    <td>{u.active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 style={{ marginTop: 24 }}>{t(language, 'roles')}</h3>
            <ul>
              {roles.map((r: any) => (
                <li key={r.name}>{r.name}: {(r.permissions || []).join(', ')}</li>
              ))}
            </ul>
          </section>
        ) : active === 'audit' ? (
          <section className="panel">
            <h2>{t(language, 'audit')}</h2>
            <table style={{ width: '100%', marginTop: 16 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>{t(language, 'time')}</th>
                  <th style={{ textAlign: 'left' }}>{t(language, 'actor')}</th>
                  <th style={{ textAlign: 'left' }}>{t(language, 'action')}</th>
                  <th style={{ textAlign: 'left' }}>{t(language, 'resource')}</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a: any, i: number) => (
                  <tr key={i}>
                    <td>{a.createdAt}</td>
                    <td>{a.actorUsername || '-'}</td>
                    <td>{a.action}</td>
                    <td>{a.resource}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : active === 'crm' ? (
          <section className="panel">
            <h2>{t(language, 'crmTitle')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <h3>Customers</h3>
                <ul>
                  {customers.slice(0, 20).map((c: any) => (
                    <li key={c._id || c.name}>{c.name} {c.phone ? `- ${c.phone}` : ''}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Leads</h3>
                <ul>
                  {leads.slice(0, 20).map((l: any) => (
                    <li key={l._id || l.name}>{l.name} - {l.status}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Deals</h3>
                <ul>
                  {deals.slice(0, 20).map((d: any) => (
                    <li key={d._id || d.title}>{d.title} - {d.stage}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Activities</h3>
                <ul>
                  {activities.slice(0, 20).map((a: any) => (
                    <li key={a._id || a.subject}>{a.subject} - {a.type}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : active === 'inventory' ? (
          <section className="panel">
            <h2>{t(language, 'inventoryTitle')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <h3>Products</h3>
                <ul>
                  {products.slice(0, 20).map((p: any) => (
                    <li key={p._id || p.sku}>{p.name} (SKU:{p.sku}) - {p.stockQuantity} in stock</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Suppliers</h3>
                <ul>
                  {suppliers.slice(0, 20).map((s: any) => (
                    <li key={s._id || s.name}>{s.name}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Purchase Orders</h3>
                <ul>
                  {purchaseOrders.slice(0, 20).map((po: any) => (
                    <li key={po._id || po.createdAt}>{po.status} - {po.totalCents} cents</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : active === 'pos' ? (
          <section className="panel">
            <h2>{t(language, 'posTitle')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <h3>Sales</h3>
                <ul>
                  {sales.slice(0, 20).map((s: any) => (
                    <li key={s._id || s.invoiceNo}>{s.invoiceNo} - {s.totalCents} cents ({s.status})</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Cashbox</h3>
                <ul>
                  {cashbox.slice(0, 20).map((m: any, i: number) => (
                    <li key={i}>{m.type}: {m.amountCents} cents - {m.reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : active === 'reports' ? (
          <section className="panel">
            <h2>{t(language, 'reportsTitle')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <h3>Sales</h3>
                <p>Total: {reportSales?.totalSalesCents || 0} cents</p>
                <p>Count: {reportSales?.totalCount || 0}</p>
              </div>
              <div>
                <h3>Cashbox</h3>
                <p>In: {reportCashbox?.totalInCents || 0} cents</p>
                <p>Out: {reportCashbox?.totalOutCents || 0} cents</p>
                <p>Balance: {reportCashbox?.balanceCents || 0} cents</p>
              </div>
              <div>
                <h3>Inventory</h3>
                <p>Products: {reportInv?.totalProducts || 0}</p>
                <p>Low stock: {reportInv?.lowStock || 0}</p>
                <p>Value: {reportInv?.totalValueCents || 0} cents</p>
              </div>
            </div>
          </section>
        ) : (
          <>
            {active === 'dashboard' ? (
              <DatabasePanel db={db} language={language} onRetry={handleReload} />
            ) : null}

            {settingsError ? (
              <p className="error banner" role="alert">
                {t(language, 'settingsLoadError')}: {settingsError}
              </p>
            ) : null}

            {active === 'dashboard' && settingsLoaded && !settings && !settingsError ? (
              <SetupBanner language={language} onOpen={() => setActive('settings')} />
            ) : null}

            <section className="panel" aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`}>{t(language, section.titleKey)}</h2>
              <p className="muted">{t(language, section.descriptionKey)}</p>
              <div className="empty-state">
                <strong>{t(language, 'notImplemented')}</strong>
                <p>
                  {t(language, 'phasePlaceholder', {
                    phase: t(language, section.phaseKey)
                  })}
                </p>
              </div>
            </section>

            {active === 'dashboard' ? (
              <section className="grid" aria-label={t(language, 'foundationChecks')}>
                <article className="card">
                  <h3>{t(language, 'secureRenderer')}</h3>
                  <p>{t(language, 'secureRendererBody')}</p>
                </article>
                <article className="card">
                  <h3>{t(language, 'typedIpc')}</h3>
                  <p>{t(language, 'typedIpcBody')}</p>
                </article>
                <article className="card">
                  <h3>{t(language, 'nextStep')}</h3>
                  <p>{t(language, 'nextStepBody')}</p>
                </article>
              </section>
            ) : null}
          </>
        )}

        <footer className="content-footer">
          <span className={`status-dot ${ipc === 'ready' ? 'ready' : ipc === 'failed' ? 'failed' : 'checking'}`} />
          {ipc === 'ready'
            ? t(language, 'ipcConnected')
            : ipc === 'failed'
              ? t(language, 'ipcFailed')
              : t(language, 'ipcChecking')}
        </footer>
      </main>
    </div>
  )
}
