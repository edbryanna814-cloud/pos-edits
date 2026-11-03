import { app, BrowserWindow, ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IPC } from '../shared/ipc'
import { closeDb, connectDb, dbHealth } from './db'
import { ensureSettingsSchema, getSettings, saveSettings } from './settings'
import { exportBackup, importBackup } from './backup'
import { createDefaultAdminIfMissing, createUser, ensureAuthSchema, getAuthState, listAudit, listRoles, listUsers, login, logout, updateUser } from './auth'
import { createActivity, createContact, createCustomer, createDeal, createLead, createNote, ensureCrmSchema, listActivities, listContacts, listCustomers, listDeals, listLeads, listNotes, updateCustomer } from './crm'
import { createCategory, createPO, createProduct, createSupplier, createUnit, ensureInventorySchema, listCategories, listPO, listProducts, listStockMovements, listSuppliers, listUnits, receivePO, stockAdjust, updateProduct } from './inventory'
import { cashIn, cashOut, checkout, closeShift, ensurePosSchema, listCashbox, listSales, listShifts, openShift, posReturn } from './pos'
import { cashboxReport, inventoryReport, salesReport } from './reports'
import { createPlan, createSubscription, ensureSubscriptionSchema, getSubscription, listPayments, listPlans, renewSubscription } from './subscription'
import { activateDevice, approveReplacement, configureDeviceLimit, createLicense, ensureLicensingSchema, listDevices, listLicenses, listReplacements, rejectReplacement, requestReplacement, revokeDevice } from './licensing'
import { applyLicenseCode, getLicenseState, hasValidLicense } from './license'

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
      webSecurity: true
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
  ipcMain.handle(IPC.Ping, (event) => {
    assertTrusted(event)
    return 'pong'
  })

  ipcMain.handle(IPC.GetVersion, (event) => {
    assertTrusted(event)
    return app.getVersion()
  })

  ipcMain.handle(IPC.DbHealth, async (event) => {
    assertTrusted(event)
    return dbHealth()
  })

  ipcMain.handle(IPC.LicenseStatus, async (event) => {
    assertTrusted(event)
    return getLicenseState()
  })

  ipcMain.handle(IPC.LicenseApply, async (event, code: string) => {
    assertTrusted(event)
    return applyLicenseCode(code)
  })

  ipcMain.handle(IPC.SettingsGet, async (event) => {
    assertTrusted(event)
    return getSettings()
  })

  ipcMain.handle(IPC.SettingsSave, async (event, input: unknown) => {
    assertTrusted(event)
    return saveSettings(input)
  })

  ipcMain.handle(IPC.BackupExport, async (event) => {
    assertTrusted(event)
    return exportBackup(senderWindow(event))
  })

  ipcMain.handle(IPC.BackupImport, async (event) => {
    assertTrusted(event)
    return importBackup(senderWindow(event))
  })

  ipcMain.handle(IPC.AuthLogin, async (event, input: unknown) => {
    assertTrusted(event)
    if (!(await hasValidLicense())) throw new Error('License required or expired')
    return login(input as any)
  })

  ipcMain.handle(IPC.AuthLogout, async (event, token: string) => {
    assertTrusted(event)
    await logout(token)
    return { success: true }
  })

  ipcMain.handle(IPC.AuthState, async (event, token?: string) => {
    assertTrusted(event)
    return getAuthState(token)
  })

  ipcMain.handle(IPC.UsersList, async (event) => {
    assertTrusted(event)
    return listUsers()
  })

  ipcMain.handle(IPC.UsersCreate, async (event, input: any) => {
    assertTrusted(event)
    return createUser(input)
  })

  ipcMain.handle(IPC.UsersUpdate, async (event, id: string, input: any) => {
    assertTrusted(event)
    return updateUser(id, input)
  })

  ipcMain.handle(IPC.RolesList, async (event) => {
    assertTrusted(event)
    return listRoles()
  })

  ipcMain.handle(IPC.AuditList, async (event, limit?: number) => {
    assertTrusted(event)
    return listAudit(limit)
  })

  ipcMain.handle(IPC.CrmCustomersList, async (event) => {
    assertTrusted(event)
    return listCustomers()
  })
  ipcMain.handle(IPC.CrmCustomersCreate, async (event, input: any) => {
    assertTrusted(event)
    return createCustomer(input)
  })
  ipcMain.handle(IPC.CrmCustomersUpdate, async (event, id: string, input: any) => {
    assertTrusted(event)
    return updateCustomer(id, input)
  })
  ipcMain.handle(IPC.CrmContactsList, async (event, customerId?: string) => {
    assertTrusted(event)
    return listContacts(customerId)
  })
  ipcMain.handle(IPC.CrmContactsCreate, async (event, input: any) => {
    assertTrusted(event)
    return createContact(input)
  })
  ipcMain.handle(IPC.CrmLeadsList, async (event) => {
    assertTrusted(event)
    return listLeads()
  })
  ipcMain.handle(IPC.CrmLeadsCreate, async (event, input: any) => {
    assertTrusted(event)
    return createLead(input)
  })
  ipcMain.handle(IPC.CrmDealsList, async (event) => {
    assertTrusted(event)
    return listDeals()
  })
  ipcMain.handle(IPC.CrmDealsCreate, async (event, input: any) => {
    assertTrusted(event)
    return createDeal(input)
  })
  ipcMain.handle(IPC.CrmActivitiesList, async (event, customerId?: string) => {
    assertTrusted(event)
    return listActivities(customerId)
  })
  ipcMain.handle(IPC.CrmActivitiesCreate, async (event, input: any) => {
    assertTrusted(event)
    return createActivity(input)
  })
  ipcMain.handle(IPC.CrmNotesList, async (event, customerId: string) => {
    assertTrusted(event)
    return listNotes(customerId)
  })
  ipcMain.handle(IPC.CrmNotesCreate, async (event, input: any) => {
    assertTrusted(event)
    return createNote(input)
  })

  ipcMain.handle(IPC.InvCategoriesList, async (event) => { assertTrusted(event); return listCategories() })
  ipcMain.handle(IPC.InvCategoriesCreate, async (event, input: any) => { assertTrusted(event); return createCategory(input) })
  ipcMain.handle(IPC.InvUnitsList, async (event) => { assertTrusted(event); return listUnits() })
  ipcMain.handle(IPC.InvUnitsCreate, async (event, input: any) => { assertTrusted(event); return createUnit(input) })
  ipcMain.handle(IPC.InvProductsList, async (event) => { assertTrusted(event); return listProducts() })
  ipcMain.handle(IPC.InvProductsCreate, async (event, input: any) => { assertTrusted(event); return createProduct(input) })
  ipcMain.handle(IPC.InvProductsUpdate, async (event, id: string, input: any) => { assertTrusted(event); return updateProduct(id, input) })
  ipcMain.handle(IPC.InvStockMovementsList, async (event, productId?: string) => { assertTrusted(event); return listStockMovements(productId) })
  ipcMain.handle(IPC.InvStockAdjust, async (event, input: any) => { assertTrusted(event); return stockAdjust(input) })
  ipcMain.handle(IPC.InvSuppliersList, async (event) => { assertTrusted(event); return listSuppliers() })
  ipcMain.handle(IPC.InvSuppliersCreate, async (event, input: any) => { assertTrusted(event); return createSupplier(input) })
  ipcMain.handle(IPC.InvPOList, async (event) => { assertTrusted(event); return listPO() })
  ipcMain.handle(IPC.InvPOCreate, async (event, input: any) => { assertTrusted(event); return createPO(input) })
  ipcMain.handle(IPC.InvPOReceive, async (event, purchaseOrderId: string, notes?: string) => { assertTrusted(event); return receivePO(purchaseOrderId, notes) })

  ipcMain.handle(IPC.PosCheckout, async (event, input: any) => { assertTrusted(event); return checkout(input) })
  ipcMain.handle(IPC.PosSalesList, async (event) => { assertTrusted(event); return listSales() })
  ipcMain.handle(IPC.PosReturn, async (event, input: any) => { assertTrusted(event); return posReturn(input) })
  ipcMain.handle(IPC.PosCashIn, async (event, amountCents: number, reason: string) => { assertTrusted(event); return cashIn(amountCents, reason) })
  ipcMain.handle(IPC.PosCashOut, async (event, amountCents: number, reason: string) => { assertTrusted(event); return cashOut(amountCents, reason) })
  ipcMain.handle(IPC.PosCashboxList, async (event) => { assertTrusted(event); return listCashbox() })
  ipcMain.handle(IPC.PosShiftOpen, async (event, openingBalanceCents: number) => { assertTrusted(event); const win = BrowserWindow.fromWebContents(event.sender); return openShift('cashier', openingBalanceCents) })
  ipcMain.handle(IPC.PosShiftClose, async (event) => { assertTrusted(event); return closeShift() })
  ipcMain.handle(IPC.PosShiftsList, async (event) => { assertTrusted(event); return listShifts() })

  ipcMain.handle(IPC.ReportsSales, async (event) => { assertTrusted(event); return salesReport() })
  ipcMain.handle(IPC.ReportsCashbox, async (event) => { assertTrusted(event); return cashboxReport() })
  ipcMain.handle(IPC.ReportsInventory, async (event) => { assertTrusted(event); return inventoryReport() })

  ipcMain.handle(IPC.SubPlansList, async (event) => { assertTrusted(event); return listPlans() })
  ipcMain.handle(IPC.SubPlansCreate, async (event, input: any) => { assertTrusted(event); return createPlan(input) })
  ipcMain.handle(IPC.SubGet, async (event) => { assertTrusted(event); return getSubscription() })
  ipcMain.handle(IPC.SubCreate, async (event, input: any) => { assertTrusted(event); return createSubscription(input) })
  ipcMain.handle(IPC.SubRenew, async (event) => { assertTrusted(event); return renewSubscription() })
  ipcMain.handle(IPC.SubPaymentsList, async (event) => { assertTrusted(event); return listPayments() })

  ipcMain.handle(IPC.LicList, async (event) => { assertTrusted(event); return listLicenses() })
  ipcMain.handle(IPC.LicCreate, async (event, input: any) => { assertTrusted(event); return createLicense(input) })
  ipcMain.handle(IPC.LicConfigureLimit, async (event, licenseId: string, maxActiveDevices: number) => { assertTrusted(event); return configureDeviceLimit(licenseId, maxActiveDevices) })
  ipcMain.handle(IPC.LicDevicesList, async (event, licenseId?: string) => { assertTrusted(event); return listDevices(licenseId) })
  ipcMain.handle(IPC.LicActivate, async (event, input: any) => { assertTrusted(event); return activateDevice(input) })
  ipcMain.handle(IPC.LicRevoke, async (event, deviceId: string, reason: string) => { assertTrusted(event); return revokeDevice(deviceId, reason) })
  ipcMain.handle(IPC.LicReplList, async (event, status?: string) => { assertTrusted(event); return listReplacements(status) })
  ipcMain.handle(IPC.LicReplRequest, async (event, input: any) => { assertTrusted(event); return requestReplacement(input) })
  ipcMain.handle(IPC.LicReplApprove, async (event, requestId: string, reviewedBy: string, decisionReason: string) => { assertTrusted(event); return approveReplacement(requestId, reviewedBy, decisionReason) })
  ipcMain.handle(IPC.LicReplReject, async (event, requestId: string, reviewedBy: string, decisionReason: string) => { assertTrusted(event); return rejectReplacement(requestId, reviewedBy, decisionReason) })
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

  app.whenReady().then(async () => {
    await connectDb()
    try {
      await ensureSettingsSchema()
    } catch (error) {
      console.error('[main] settings schema setup failed', error)
    }
    try {
      await ensureAuthSchema()
      await createDefaultAdminIfMissing()
    } catch (error) {
      console.error('[main] auth schema setup failed', error)
    }
    try {
      await ensureCrmSchema()
    } catch (error) {
      console.error('[main] crm schema setup failed', error)
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
    try {
      await ensureSubscriptionSchema()
    } catch (error) {
      console.error('[main] subscription schema setup failed', error)
    }
    try {
      await ensureLicensingSchema()
    } catch (error) {
      console.error('[main] licensing schema setup failed', error)
    }
    registerIpc()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => {
    void closeDb()
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
