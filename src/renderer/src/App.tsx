import {
  Component,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode
} from 'react'
import type { DbHealth, LicenseState } from '../../shared/ipc'
import type { Permission } from '../../shared/auth'
import type { Language, StoredCompanySettings } from '../../shared/settings'
import { t, type TranslationKey } from './i18n'
import SettingsPage from './SettingsPage'
import LoginPage from './auth/LoginPage'
import ActivationPage from './license/ActivationPage'
import InventoryPage from './inventory/InventoryPage'
import ProcurementPanel from './inventory/ProcurementPanel'
import PosPage from './pos/PosPage'
import ShiftPanel from './pos/ShiftPanel'
import DashboardPage from './dashboard/DashboardPage'
import ReportsPage from './reports/ReportsPage'
import UsersPage from './users/UsersPage'
import CustomersPage from './customers/CustomersPage'
import AttendancePage, { SellerKpis } from './attendance/AttendancePage'

type SectionId = 'dashboard' | 'pos' | 'inventory' | 'reports' | 'settings' | 'users' | 'audit' | 'customers' | 'attendance'

interface Section {
  id: SectionId
  labelKey: TranslationKey
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  permission?: Permission
}

const sections: Section[] = [
  {
    id: 'dashboard',
    labelKey: 'dashboard',
    titleKey: 'dashboardTitle',
    descriptionKey: 'dashboardDesc',
    permission: 'reports.view'
  },
  {
    id: 'pos',
    labelKey: 'pos',
    titleKey: 'posTitle',
    descriptionKey: 'posDesc',
    permission: 'pos.use'
  },
  {
    id: 'inventory',
    labelKey: 'inventory',
    titleKey: 'inventoryTitle',
    descriptionKey: 'inventoryDesc',
    permission: 'inventory.manage'
  },
  {
    id: 'reports',
    labelKey: 'reports',
    titleKey: 'reportsTitle',
    descriptionKey: 'reportsDesc',
    permission: 'reports.view'
  },
  {
    id: 'customers',
    labelKey: 'customers',
    titleKey: 'customers',
    descriptionKey: 'customersDesc',
    permission: 'customers.manage'
  },
  {
    id: 'attendance',
    labelKey: 'attendance',
    titleKey: 'attendance',
    descriptionKey: 'attendanceDesc',
    permission: 'users.manage'
  },
  {
    id: 'users',
    labelKey: 'users',
    titleKey: 'users',
    descriptionKey: 'settingsDesc',
    permission: 'users.read'
  },
  {
    id: 'audit',
    labelKey: 'audit',
    titleKey: 'audit',
    descriptionKey: 'settingsDesc',
    permission: 'audit.view'
  },
  {
    id: 'settings',
    labelKey: 'settings',
    titleKey: 'settingsTitle',
    descriptionKey: 'settingsDesc',
    permission: 'settings.manage'
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
            <dt>{t(language, 'serverVersion')}</dt>
            <dd>{db.serverVersion ?? '-'}</dd>
          </div>
          <div>
            <dt>{t(language, 'latency')}</dt>
            <dd>{db.latencyMs != null ? `${db.latencyMs} ms` : '-'}</dd>
          </div>
        </dl>
      ) : null}

      {db?.error ? <p className="error">{t(language, 'databaseUnavailable')}</p> : null}

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
  const [products, setProducts] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [cashbox, setCashbox] = useState<any[]>([])
  const [reportSales, setReportSales] = useState<any>(null)
  const [reportCashbox, setReportCashbox] = useState<any>(null)
  const [reportInv, setReportInv] = useState<any>(null)

  const section = sections.find((item) => item.id === active) ?? sections[0]
  const visibleSections = sections.filter(
    (item) => !item.permission || (authUser?.permissions ?? []).includes(item.permission)
  )
  // A Seller has no dashboard: open the first page this role may see.
  useEffect(() => {
    if (authUser && visibleSections.length && !visibleSections.some((item) => item.id === active)) setActive(visibleSections[0].id)
  }, [authUser, active])
  const currency = settings?.currencyCode ?? ''
  const taxRateBasisPoints = settings?.taxRateBasisPoints ?? 0
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
        setLicense({ status: 'invalid', deviceId: '' })
      )
      .finally(() => setLicenseLoaded(true))

    void load()
    void loadAuth()
  }, [])

  // Settings are refused while unlicensed; reload them once the license becomes valid (after activation),
  // otherwise the dashboard keeps showing "Could not load settings: License required".
  useEffect(() => {
    if (license?.status === 'valid') void load()
  }, [license?.status])

  // Poll the license so an expiry during a shift locks the screens without waiting for a restart.
  // The main process enforces the same rule on every call; this only keeps the UI honest.
  useEffect(() => {
    if (!window.api) return

    const check = (): void => {
      window.api
        .licenseStatus()
        .then((state) => setLicense(state))
        .catch(() => setLicense({ status: 'invalid', deviceId: '' }))
    }
    const timer = setInterval(check, 60_000)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [])

  useEffect(() => {
    if (!authUser) return
    if (active === 'users') {
      void loadUsers()
      void loadRoles()
    }
    if (active === 'audit') void loadAudit()
  }, [active, authUser])

  useEffect(() => {
    if (!authUser) return
    void loadInventory()
    void loadPos()
    void loadReports()
  }, [authUser])

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

  function refreshBusinessData(): void {
    void loadInventory()
    void loadPos()
    void loadReports()
  }

  const languageToggle = (
    // zIndex: without it .login-shell (position: relative, later in the DOM) covers the toggle before sign-in.
    <div style={{ position: 'absolute', top: 10, insetInlineEnd: 10, zIndex: 1 }}>
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
        <LoginPage language={language} onLogin={handleLogin} dbUnavailable={db?.status === 'disconnected'} />
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
          {visibleSections.map((item) => (
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
          <SettingsPage
            settings={settings}
            language={language}
            settingsError={settingsError}
            onSaved={handleSaved}
            onReload={handleReload}
            canManageDatabase={(authUser?.permissions ?? []).includes('database.manage')}
          />
        ) : active === 'users' ? (
          <UsersPage language={language} />        ) : active === 'attendance' ? (
          <AttendancePage language={language} />
        ) : active === 'customers' ? (
          <CustomersPage language={language} />
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
        ) : active === 'inventory' ? (
          <>
            <InventoryPage
              products={products}
              language={language}
              currency={currency}
              onChanged={refreshBusinessData}
            />
            <ProcurementPanel
              products={products}
              suppliers={suppliers}
              purchaseOrders={purchaseOrders}
              language={language}
              currency={currency}
              onChanged={refreshBusinessData}
            />
          </>
        ) : active === 'pos' ? (
          <>
            <PosPage
              products={products}
              sales={sales}
              cashbox={cashbox}
              language={language}
              currency={currency}
              taxRateBasisPoints={taxRateBasisPoints}
              cashier={authUser.username}
              companyName={settings?.companyName ?? ''}
              onChanged={refreshBusinessData}
            />
            <ShiftPanel
              language={language}
              currency={currency}
              cashier={authUser.username}
              onChanged={refreshBusinessData}
            />
          </>
        ) : active === 'reports' ? (
            <ReportsPage
              language={language}
              currency={currency}
              sales={sales}
              products={products}
              salesReport={reportSales}
              cashboxReport={reportCashbox}
              inventoryReport={reportInv}
            />
        ) : active === 'dashboard' ? (
          <>
            {settingsError ? (
              <p className="error banner" role="alert">
                {t(language, 'settingsLoadError')}: {settingsError}
              </p>
            ) : null}

            {settingsLoaded && !settings && !settingsError ? (
              <SetupBanner language={language} onOpen={() => setActive('settings')} />
            ) : null}

            <DashboardPage
              language={language}
              currency={currency}
              products={products}
              sales={sales}
              cashbox={cashbox}
              onNavigate={(target) => setActive(target)}
            />
            {(authUser?.permissions ?? []).includes('reports.view') ? <SellerKpis language={language} currency={currency} /> : null}
            <DatabasePanel db={db} language={language} onRetry={handleReload} />
          </>
        ) : null}

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
