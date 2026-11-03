import { test, expect, _electron as electron } from '@playwright/test'
import { MongoClient } from 'mongodb'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TEST_DB = 'pharmacy_pos_test'
const MONGO_URI = 'mongodb://127.0.0.1:27017/?replicaSet=rs0'

async function cleanTestDatabase(): Promise<void> {
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 3000 })
  await client.connect()
  await client.db(TEST_DB).dropDatabase()
  await client.close()
}

test.describe.serial('Phase 2 - database and settings', () => {
  test('connects, persists settings, switches language, and restores a backup', async () => {
    await cleanTestDatabase()

    const backupDir = mkdtempSync(join(tmpdir(), 'pharmacy-pos-backup-'))
    const backupPath = join(backupDir, 'phase2-backup.json')
    const app = await electron.launch({
      args: ['.'],
      env: { ...process.env, MONGODB_DB: TEST_DB }
    })

    try {
      const window = await app.firstWindow()

      await expect(window).toHaveTitle(/Pharmacy POS/)
      await window.getByLabel('Username').fill('admin')
      await window.getByLabel('Password').fill('admin')
      await window.getByRole('button', { name: /Login|Sign in|تسجيل الدخول/ }).click()
      await expect(
        window.getByRole('heading', { name: 'Dashboard', level: 1 })
      ).toBeVisible({ timeout: 10000 })

      expect(await window.evaluate(() => typeof (window as any).require)).toBe('undefined')
      expect(await window.evaluate(() => typeof (window as any).process)).toBe('undefined')
      expect(await window.evaluate(() => typeof (window as any).ipcRenderer)).toBe('undefined')

      expect(
        await window.evaluate(() => Object.keys((window as any).api).sort())
      ).toEqual([
        'auditList',
        'authLogin',
        'authLogout',
        'authState',
        'crmActivitiesCreate',
        'crmActivitiesList',
        'crmContactsCreate',
        'crmContactsList',
        'crmCustomersCreate',
        'crmCustomersList',
        'crmCustomersUpdate',
        'crmDealsCreate',
        'crmDealsList',
        'crmLeadsCreate',
        'crmLeadsList',
        'crmNotesCreate',
        'crmNotesList',
        'dbHealth',
        'exportBackup',
        'getSettings',
        'getVersion',
        'importBackup',
        'invCategoriesCreate',
        'invCategoriesList',
        'invPOCreate',
        'invPOList',
        'invPOReceive',
        'invProductsCreate',
        'invProductsList',
        'invProductsUpdate',
        'invStockAdjust',
        'invStockMovementsList',
        'invSuppliersCreate',
        'invSuppliersList',
        'invUnitsCreate',
        'invUnitsList',
        'licActivate',
        'licConfigureLimit',
        'licCreate',
        'licDevicesList',
        'licList',
        'licReplApprove',
        'licReplList',
        'licReplReject',
        'licReplRequest',
        'licRevoke',
        'licenseApply',
        'licenseStatus',
        'ping',
        'posCashIn',
        'posCashOut',
        'posCashboxList',
        'posCheckout',
        'posReturn',
        'posSalesList',
        'posShiftClose',
        'posShiftOpen',
        'posShiftsList',
        'reportsCashbox',
        'reportsInventory',
        'reportsSales',
        'rolesList',
        'saveSettings',
        'subCreate',
        'subGet',
        'subPaymentsList',
        'subPlansCreate',
        'subPlansList',
        'subRenew',
        'usersCreate',
        'usersList',
        'usersUpdate'
      ])
      expect(await window.evaluate(() => (window as any).api.ping())).toBe('pong')
      expect(await window.evaluate(() => (window as any).api.getVersion())).toMatch(
        /^\d+\.\d+\.\d+$/
      )

      const csp = await window.evaluate(
        () =>
          document
            .querySelector('meta[http-equiv="Content-Security-Policy"]')
            ?.getAttribute('content') ?? ''
      )
      expect(csp).toContain("script-src 'self'")
      expect(csp).toContain("object-src 'none'")

      const health = await window.evaluate(() => (window as any).api.dbHealth())
      expect(health.status).toBe('connected')
      expect(health.database).toBe(TEST_DB)
      expect(health.topology).toBe('replicaSet:rs0')
      expect(health.supportsTransactions).toBe(true)

      await expect(window.getByText('Connected', { exact: true }).first()).toBeVisible()
      await expect(window.getByText('Supported', { exact: true })).toBeVisible()

      const dir = join(process.cwd(), 'screenshots')
      mkdirSync(dir, { recursive: true })
      await window.screenshot({ path: join(dir, 'phase2-dashboard.png') })

      await window.getByRole('button', { name: 'Settings', exact: true }).click()
      await expect(
        window.getByRole('heading', { name: 'Settings', level: 1 })
      ).toBeVisible()

      await window.getByLabel('Company name').fill('Test Pharmacy')
      await window.getByLabel('Currency code (ISO 4217)').fill('USD')
      await window.getByLabel('Currency decimal places').fill('2')
      await window.getByLabel('Tax rate (%)').fill('10')
      await window.getByLabel('Default language').selectOption('en')
      await window.getByRole('button', { name: 'Save settings' }).click()

      await expect(window.locator('.success')).toContainText('Settings saved')

      const saved = await window.evaluate(() => (window as any).api.getSettings())
      expect(saved).toMatchObject({
        companyName: 'Test Pharmacy',
        currencyCode: 'USD',
        currencyPrecision: 2,
        taxRateBasisPoints: 1000,
        defaultLanguage: 'en',
        backupDirectory: ''
      })

      const directClient = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 3000 })
      await directClient.connect()
      try {
        await expect(
          directClient.db(TEST_DB).collection('settings').insertOne({
            _id: 'invalid' as any,
            companyName: '',
            currencyCode: 'usd',
            currencyPrecision: 9,
            taxRateBasisPoints: 20000,
            defaultLanguage: 'fr',
            backupDirectory: '',
            updatedAt: new Date().toISOString()
          })
        ).rejects.toThrow()
      } finally {
        await directClient.close()
      }

      await window.screenshot({ path: join(dir, 'phase2-settings.png') })

      await window.getByRole('button', { name: 'AR', exact: true }).click()
      expect(await window.evaluate(() => document.documentElement.dir)).toBe('rtl')
      await expect(
        window.getByRole('heading', { name: 'الإعدادات', level: 1 })
      ).toBeVisible()
      await window.screenshot({ path: join(dir, 'phase2-arabic.png') })

      await window.getByRole('button', { name: 'EN', exact: true }).click()
      expect(await window.evaluate(() => document.documentElement.dir)).toBe('ltr')

      await app.evaluate(({ dialog }, filePath) => {
        ;(dialog as any).showSaveDialog = async () => ({ canceled: false, filePath })
      }, backupPath)

      await window.getByRole('button', { name: 'Export backup' }).click()
      await expect(window.locator('.success')).toContainText(backupPath)
      expect(existsSync(backupPath)).toBe(true)

      const backup = JSON.parse(readFileSync(backupPath, 'utf8')) as {
        collections: { settings: Array<{ companyName: string }> }
      }
      expect(backup.collections.settings).toHaveLength(1)
      expect(backup.collections.settings[0].companyName).toBe('Test Pharmacy')

      await window.getByLabel('Company name').fill('Changed Pharmacy')
      await window.getByRole('button', { name: 'Save settings' }).click()
      await expect(window.locator('.success')).toContainText('Settings saved')

      await app.evaluate(({ dialog }, filePath) => {
        ;(dialog as any).showOpenDialog = async () => ({
          canceled: false,
          filePaths: [filePath]
        })
        ;(dialog as any).showMessageBox = async () => ({ response: 1 })
      }, backupPath)

      await window.getByRole('button', { name: 'Import backup' }).click()
      await expect(window.locator('.success')).toContainText('Imported documents')
      await expect(window.getByLabel('Company name')).toHaveValue('Test Pharmacy')

      const restored = await window.evaluate(() => (window as any).api.getSettings())
      expect(restored.companyName).toBe('Test Pharmacy')
    } finally {
      await app.close()
      rmSync(backupDir, { recursive: true, force: true })
    }

    const relaunched = await electron.launch({
      args: ['.'],
      env: { ...process.env, MONGODB_DB: TEST_DB }
    })

    try {
      const window = await relaunched.firstWindow()
      await expect(
        window.getByRole('heading', { name: 'Dashboard', level: 1 })
      ).toBeVisible()

      const persisted = await window.evaluate(() => (window as any).api.getSettings())
      expect(persisted.companyName).toBe('Test Pharmacy')

      await window.getByRole('button', { name: 'Settings', exact: true }).click()
      await expect(window.getByLabel('Company name')).toHaveValue('Test Pharmacy')
      await expect(window.getByLabel('Currency code (ISO 4217)')).toHaveValue('USD')
      await expect(window.getByLabel('Tax rate (%)')).toHaveValue('10.00')
      await expect(window.getByLabel('Default language')).toHaveValue('en')

      await window.screenshot({
        path: join(process.cwd(), 'screenshots', 'phase2-settings-persisted.png')
      })
    } finally {
      await relaunched.close()
    }
  })

  test('keeps the application usable when MongoDB is unavailable', async () => {
    const app = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        MONGODB_DB: TEST_DB,
        MONGODB_URI: 'mongodb://127.0.0.1:27099/?directConnection=true'
      }
    })

    try {
      const window = await app.firstWindow()

      await expect(window).toHaveTitle(/Pharmacy POS/)
      await window.getByLabel('Username').fill('admin')
      await window.getByLabel('Password').fill('admin')
      await window.getByRole('button', { name: /Login|Sign in|تسجيل الدخول/ }).click()
      await expect(
        window.getByRole('heading', { name: 'Dashboard', level: 1 })
      ).toBeVisible({ timeout: 10000 })
      await expect(window.getByText('Disconnected', { exact: true }).first()).toBeVisible()
      await expect(window.locator('.db-panel .error')).toBeVisible()

      const dir = join(process.cwd(), 'screenshots')
      mkdirSync(dir, { recursive: true })
      await window.screenshot({ path: join(dir, 'phase2-db-unavailable.png') })

      await window.getByRole('button', { name: 'Settings', exact: true }).click()
      await expect(
        window.getByRole('heading', { name: 'Settings', level: 1 })
      ).toBeVisible()
      await expect(window.getByText(/Could not load settings/)).toBeVisible()
      await window.screenshot({ path: join(dir, 'phase2-settings-unavailable.png') })
    } finally {
      await app.close()
    }
  })
})

test.afterAll(async () => {
  await cleanTestDatabase()
})
