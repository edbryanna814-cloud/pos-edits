import { app, BrowserWindow, ipcMain, session } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IPC, type IpcChannel } from '../shared/ipc'
import type { Permission } from '../shared/auth'
import { closeDb, connectDb, dbHealth, getDb } from './db'
import { describeDbMode, loadDbMode, saveDbMode } from './dbConfig'
import { testSharedUri } from './dbConnection'
import { startBundledMongo, stopBundledMongo } from './localDb'
import { ensureSettingsSchema, getSettings, saveSettings } from './settings'
import { exportBackup, importBackup } from './backup'
import { changePassword, createUser, ensureAuthSchema, migrateRoles, getAuthState, getCurrentSession, isSetupRequired, listAudit, listRoles, listUsers, logAudit, login, logout, requirePermission, requireSession, setAuditFallbackFile, setupFirstAdmin, updateUser, verifyAuditLog } from './auth'
import { createCategory, createPO, createProduct, createSupplier, createUnit, ensureInventorySchema, listCategories, listPO, listProducts, listStockMovements, listSuppliers, listUnits, receiveCarton, receivePO, stockAdjust, updateProduct } from './inventory'
import { cashIn, cashOut, checkout, closeShift, ensurePosSchema, listCashbox, listSales, listShifts, openShift, posReturn } from './pos'
import { cashboxReport, inventoryReport, salesReport } from './reports'
import { applyLicenseCode, getLicenseState, hasValidLicense } from './license'
import { licenseRequired } from './licenseGate'
import { publicError, validateIpcArgs } from './ipcSchema'
import { rotateIfLarge } from './logRotate'

const rendererUrl = process.env['ELECTRON_RENDERER_URL']
const isDev = Boolean(rendererUrl)
const rendererIndexUrl = pathToFileURL(join(__dirname, '../renderer/index.html')).toString()

function isTrusted(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? ''
  return isDev ? url.startsWith('http://localhost:') : url === rendererIndexUrl
}

function assertTrusted(event: IpcMainInvokeEvent): void {
  if (!isTrusted(event)) throw new Error('Untrusted IPC sender')
}

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) throw new Error('Window unavailable')
  return win
}

type ChannelGuard = Permission[] | 'authenticated'

const channelGuards: Partial<Record<IpcChannel, ChannelGuard>> = {
  [IPC.SettingsSave]: ['settings.manage'],
  [IPC.BackupExport]: ['settings.manage'],
  [IPC.BackupImport]: ['settings.manage'],
  [IPC.UsersList]: ['users.read'],
  [IPC.UsersCreate]: ['users.manage'],
  [IPC.UsersUpdate]: ['users.manage'],
  [IPC.RolesList]: ['users.read'],
  [IPC.AuditList]: ['audit.view'],
  [IPC.InvCategoriesCreate]: ['inventory.manage'],
  [IPC.InvUnitsCreate]: ['inventory.manage'],
  [IPC.InvProductsCreate]: ['inventory.manage'],
  [IPC.InvProductsUpdate]: ['inventory.manage'],
  [IPC.InvReceiveCarton]: ['inventory.manage'],
  [IPC.InvStockAdjust]: ['inventory.manage'],
  [IPC.InvSuppliersCreate]: ['inventory.manage'],
  [IPC.InvPOCreate]: ['inventory.manage'],
  [IPC.InvPOReceive]: ['inventory.manage'],
  [IPC.InvCategoriesList]: 'authenticated',
  [IPC.InvUnitsList]: 'authenticated',
  [IPC.InvProductsList]: 'authenticated',
  [IPC.InvStockMovementsList]: 'authenticated',
  [IPC.InvSuppliersList]: 'authenticated',
  [IPC.InvPOList]: 'authenticated',
  [IPC.PosCheckout]: ['pos.use'],
  [IPC.PosReturn]: ['pos.use'],
  [IPC.PosCashIn]: ['pos.use'],
  [IPC.PosCashOut]: ['pos.use'],
  [IPC.PosShiftOpen]: ['pos.use'],
  [IPC.PosShiftClose]: ['pos.use'],
  [IPC.PosSalesList]: 'authenticated',
  [IPC.PosCashboxList]: 'authenticated',
  [IPC.PosShiftsList]: 'authenticated',
  [IPC.ReportsSales]: ['reports.view'],
  [IPC.ReportsCashbox]: ['reports.view'],
  [IPC.ReportsInventory]: ['reports.view']
}

function handle(channel: IpcChannel, listener: (event: IpcMainInvokeEvent, ...args: any[]) => any): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      assertTrusted(event)
      validateIpcArgs(channel, args) // Gate 1 S3: schema + NoSQL-operator/size checks for every channel
      const guard = channelGuards[channel]
      if (guard === 'authenticated') requireSession()
      else if (guard) requirePermission(...guard)
      // Gate 2: re-check the licence on every call, not only at sign-in, so an expiry mid-session
      // locks the business screens instead of letting them run to the next restart.
      if (licenseRequired(channel) && !(await hasValidLicense().catch(() => false))) {
        throw new Error('License required or expired')
      }
      return await listener(event, ...args)
    } catch (error) {
      const safe = publicError(error)
      // Gate 1 S4: no message text here. Driver messages can carry data (E11000 prints the duplicate value).
      if (safe.message !== (error as Error)?.message) {
        const e = error as { name?: string; code?: unknown; codeName?: string }
        console.error(`[ipc] ${channel} failed`, { name: e?.name, code: e?.code, codeName: e?.codeName })
      }
      throw safe
    }
  })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0f172a',
    title: 'Pharmacy POS & Management',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // Gate 1 S2: no DevTools in a packaged (production) build.
      devTools: !app.isPackaged
    }
  })

  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? rendererUrl : rendererIndexUrl
    if (url !== allowed) event.preventDefault()
  })

  if (rendererUrl) {
    win.loadURL(rendererUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function registerIpc(): void {
  handle(IPC.Ping, (event) => {
    assertTrusted(event)
    return 'pong'
  })

  handle(IPC.GetVersion, (event) => {
    assertTrusted(event)
    return app.getVersion()
  })

  handle(IPC.DbHealth, async (event) => {
    assertTrusted(event)
    return dbHealth()
  })

  handle(IPC.LicenseStatus, async (event) => {
    assertTrusted(event)
    return getLicenseState()
  })

  handle(IPC.LicenseApply, async (event, code: string) => {
    assertTrusted(event)
    return applyLicenseCode(code)
  })

  // Database location. Administrators (database.manage) only; before sign-in only on a fresh install
  // (no users yet) or while the database is unreachable, so a new cashier PC can join the shared server.
  async function mayChangeDatabase(): Promise<void> {
    try {
      requirePermission('database.manage')
      return
    } catch {
      if (!getDb() || (await isSetupRequired())) return
      throw new Error('PERMISSION_DENIED')
    }
  }

  handle(IPC.DbConnectionGet, async () => {
    await mayChangeDatabase()
    return describeDbMode()
  })

  handle(IPC.DbConnectionTest, async (_event, input: { uri?: unknown }) => {
    await mayChangeDatabase()
    return testSharedUri(input?.uri)
  })

  handle(IPC.DbConnectionSave, async (_event, input: { mode?: unknown; uri?: unknown }) => {
    await mayChangeDatabase()
    let hosts = ''
    if (input?.mode === 'shared') {
      hosts = (await testSharedUri(input.uri)).hosts
      await saveDbMode({ mode: 'shared', uri: String(input.uri).trim() })
    } else if (input?.mode === 'local') {
      await saveDbMode({ mode: 'local' })
    } else {
      throw new Error('VALIDATION_FAILED')
    }
    await logAudit({
      actorUsername: getCurrentSession()?.username ?? 'system:db-connection',
      action: 'db.connection.change',
      resource: 'settings',
      details: { mode: input.mode, hosts }
    }).catch(() => undefined)
    // Restart so every module reconnects to the chosen database.
    setTimeout(() => {
      app.relaunch()
      app.quit()
    }, 500)
    return { ok: true, restarting: true }
  })

  handle(IPC.SettingsGet, async (event) => {
    assertTrusted(event)
    return getSettings()
  })

  handle(IPC.SettingsSave, async (event, input: unknown) => {
    assertTrusted(event)
    return saveSettings(input)
  })

  handle(IPC.BackupExport, async (event, input: { passphrase?: unknown }) => {
    assertTrusted(event)
    return exportBackup(senderWindow(event), input)
  })

  handle(IPC.BackupImport, async (event, input: { passphrase?: unknown }) => {
    assertTrusted(event)
    return importBackup(senderWindow(event), input)
  })

  handle(IPC.AuthLogin, async (event, input: unknown) => {
    assertTrusted(event)
    if (!(await hasValidLicense())) throw new Error('License required or expired')
    return login(input as any)
  })

  handle(IPC.AuthLogout, async (event, token: string) => {
    assertTrusted(event)
    await logout(token)
    return { success: true }
  })

  handle(IPC.AuthState, async (event, token?: string) => {
    assertTrusted(event)
    return getAuthState(token)
  })

  handle(IPC.AuthSetupRequired, async () => isSetupRequired())

  handle(IPC.AuthSetup, async (_event, input: unknown) => {
    if (!(await hasValidLicense())) throw new Error('License required or expired')
    return setupFirstAdmin(input as any)
  })

  // No channel guard: a session that must change its password may call this, and only this.
  handle(IPC.AuthChangePassword, async (_event, input: unknown) => changePassword(input as any))

  handle(IPC.UsersList, async (event) => {
    assertTrusted(event)
    return listUsers()
  })

  handle(IPC.UsersCreate, async (event, input: any) => {
    assertTrusted(event)
    return createUser(input)
  })

  handle(IPC.UsersUpdate, async (event, id: string, input: any) => {
    assertTrusted(event)
    return updateUser(id, input)
  })

  handle(IPC.RolesList, async (event) => {
    assertTrusted(event)
    return listRoles()
  })

  handle(IPC.AuditList, async (event, limit?: number) => {
    assertTrusted(event)
    return listAudit(limit)
  })

  handle(IPC.InvCategoriesList, async (event) => { assertTrusted(event); return listCategories() })
  handle(IPC.InvCategoriesCreate, async (event, input: any) => { assertTrusted(event); return createCategory(input) })
  handle(IPC.InvUnitsList, async (event) => { assertTrusted(event); return listUnits() })
  handle(IPC.InvUnitsCreate, async (event, input: any) => { assertTrusted(event); return createUnit(input) })
  handle(IPC.InvProductsList, async (event) => { assertTrusted(event); return listProducts() })
  handle(IPC.InvProductsCreate, async (event, input: any) => { assertTrusted(event); return createProduct(input) })
  handle(IPC.InvProductsUpdate, async (event, id: string, input: any) => { assertTrusted(event); return updateProduct(id, input) })
  handle(IPC.InvReceiveCarton, async (event, input: any) => { assertTrusted(event); return receiveCarton(input) })
  handle(IPC.InvStockMovementsList, async (event, productId?: string) => { assertTrusted(event); return listStockMovements(productId) })
  handle(IPC.InvStockAdjust, async (event, input: any) => { assertTrusted(event); return stockAdjust(input) })
  handle(IPC.InvSuppliersList, async (event) => { assertTrusted(event); return listSuppliers() })
  handle(IPC.InvSuppliersCreate, async (event, input: any) => { assertTrusted(event); return createSupplier(input) })
  handle(IPC.InvPOList, async (event) => { assertTrusted(event); return listPO() })
  handle(IPC.InvPOCreate, async (event, input: any) => { assertTrusted(event); return createPO(input) })
  handle(IPC.InvPOReceive, async (event, purchaseOrderId: string, notes?: string) => { assertTrusted(event); return receivePO(purchaseOrderId, notes) })

  handle(IPC.PosCheckout, async (event, input: any) => { assertTrusted(event); return checkout(input, requireSession().username) })
  handle(IPC.PosSalesList, async (event) => { assertTrusted(event); return listSales() })
  handle(IPC.PosReturn, async (event, input: any) => { assertTrusted(event); return posReturn(input, requireSession().username) })
  handle(IPC.PosCashIn, async (event, amountCents: number, reason: string) => { assertTrusted(event); return cashIn(amountCents, reason, requireSession().username) })
  handle(IPC.PosCashOut, async (event, amountCents: number, reason: string) => { assertTrusted(event); return cashOut(amountCents, reason, requireSession().username) })
  handle(IPC.PosCashboxList, async (event) => { assertTrusted(event); return listCashbox() })
  handle(IPC.PosShiftOpen, async (event, openingBalanceCents: number) => { assertTrusted(event); return openShift(requireSession().username, openingBalanceCents) })
  handle(IPC.PosShiftClose, async (event) => { assertTrusted(event); return closeShift(requireSession().username) })
  handle(IPC.PosShiftsList, async (event) => { assertTrusted(event); return listShifts() })

  handle(IPC.ReportsSales, async (event) => { assertTrusted(event); return salesReport() })
  handle(IPC.ReportsCashbox, async (event) => { assertTrusted(event); return cashboxReport() })
  handle(IPC.ReportsInventory, async (event) => { assertTrusted(event); return inventoryReport() })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  // Gate 1 S2: app-wide guards for every webContents, not only the main window.
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  })

  app.whenReady().then(async () => {
    // Deny every permission (camera, microphone, geolocation, notifications, …) except the
    // clipboard write used by the device-code copy button.
    const allowedPermissions = new Set(['clipboard-sanitized-write'])
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowedPermissions.has(permission)))
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowedPermissions.has(permission))
    const auditFallback = join(app.getPath('userData'), 'audit-fallback.jsonl')
    await rotateIfLarge(auditFallback).catch(() => undefined)
    setAuditFallbackFile(auditFallback)
    // Shared live database (several PCs, one server) or this PC's bundled database.
    let shared = false
    try {
      const mode = await loadDbMode()
      if (mode.mode === 'shared') {
        process.env['MONGODB_URI'] = mode.uri
        shared = true
      }
    } catch (error) {
      console.error('[main] database setting unreadable; using this PC only', error instanceof Error ? error.message : error)
    }
    if (!shared) {
      try {
        await startBundledMongo()
      } catch (error) {
        console.error('[main] bundled MongoDB failed to start', error)
      }
    }
    await connectDb()
    try {
      await ensureSettingsSchema()
    } catch (error) {
      console.error('[main] settings schema setup failed', error)
    }
    try {
      await ensureAuthSchema()
      await migrateRoles()
      // Gate 1 S5: verify the audit hash chain on every start; a break is itself audited.
      const chain = await verifyAuditLog()
      if (!chain.ok) {
        console.error('[audit] chain verification failed', chain)
        await logAudit({ action: 'audit.chain_broken', resource: 'audit', details: { brokenAtSeq: chain.brokenAtSeq, reason: chain.reason } })
      }
    } catch (error) {
      console.error('[main] auth schema setup failed', error)
    }
    try {
      await ensureInventorySchema()
    } catch (error) {
      console.error('[main] inventory schema setup failed', error)
    }
    try {
      await ensurePosSchema()
    } catch (error) {
      console.error('[main] pos schema setup failed', error)
    }
    registerIpc()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  let quitting = false
  app.on('before-quit', (event) => {
    if (quitting) return
    if (!app.isPackaged) {
      void closeDb()
      return
    }
    event.preventDefault()
    quitting = true
    void (async () => {
      await closeDb()
      await stopBundledMongo()
      app.quit()
    })()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

process.on('uncaughtException', (error) => {
  console.error('[main] uncaught exception', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandled rejection', reason)
})
