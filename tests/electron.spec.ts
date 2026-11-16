import { test, expect, _electron as electron, type Page } from '@playwright/test'
import { MongoClient } from 'mongodb'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TEST_DB = 'pharmacy_pos_test'
// Own Electron profile: isolates localStorage/userData from a real install and from its single-instance lock.
const E2E_PROFILE = mkdtempSync(join(tmpdir(), 'pharmacy-pos-e2e-'))
const MONGO_URI = 'mongodb://127.0.0.1:27017/?replicaSet=rs0'

// Gate 1: there is no default account. A clean database shows the first-run setup screen;
// later launches show the sign-in screen. Test-only credentials, local test database only.
const E2E_ADMIN = { username: 'admin', password: 'E2E-Admin-Pass-2026' }
const BACKUP_PASSPHRASE = 'E2E-backup-passphrase-2026' // gitleaks:allow test-only

async function signIn(window: Page): Promise<void> {
  const setup = window.getByRole('heading', { name: 'Create the administrator account' })
  const login = window.getByRole('heading', { name: 'Sign in' })
  await expect(setup.or(login)).toBeVisible({ timeout: 10000 })
  await window.getByLabel('Username').fill(E2E_ADMIN.username)
  await window.getByLabel('Password', { exact: true }).fill(E2E_ADMIN.password)
  if (await setup.isVisible()) {
    await window.getByLabel('Confirm password').fill(E2E_ADMIN.password)
    await window.getByRole('button', { name: 'Create administrator' }).click()
  } else {
    await window.getByRole('button', { name: /Login|Sign in/ }).click()
  }
}

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
      args: ['.', `--user-data-dir=${E2E_PROFILE}`],
      env: { ...process.env, MONGODB_DB: TEST_DB }
    })

    try {
      const window = await app.firstWindow()

      await expect(window).toHaveTitle(/Pharmacy POS/)
      await signIn(window)
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
        'authChangePassword',
        'authLogin',
        'authLogout',
        'authRecoveryReset',
        'authRecoveryStart',
        'authRecoveryVerify',
        'authSetup',
        'authSetupRequired',
        'authState',
        'dbConnectionGet',
        'dbConnectionSave',
        'dbConnectionTest',
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
        'invReceiveCarton',
        'invStockAdjust',
        'invStockMovementsList',
        'invSuppliersCreate',
        'invSuppliersList',
        'invUnitsCreate',
        'invUnitsList',
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
      await expect(window.getByText('Response time', { exact: true })).toBeVisible()

      const dir = join(process.cwd(), 'screenshots')
      mkdirSync(dir, { recursive: true })
      await window.screenshot({ path: join(dir, 'phase2-dashboard.png') })

      await window.getByRole('button', { name: 'Settings', exact: true }).click()
      await expect(
        window.getByRole('heading', { name: 'Settings', level: 1 })
      ).toBeVisible()

      await window.getByLabel('Company name').fill('Test Pharmacy')
      await window.getByLabel('Currency code (three letters)').fill('USD')
      await window.getByLabel('Currency decimal places').fill('2')
      await window.getByLabel('Charge tax on sales').check()
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

      // Gate 1 S4: no passphrase, no export.
      await window.getByRole('button', { name: 'Export backup' }).click()
      await expect(window.getByRole('alert')).toContainText('at least 12 characters')
      expect(existsSync(backupPath)).toBe(false)

      await window.getByLabel('Backup passphrase').fill(BACKUP_PASSPHRASE)
      await window.getByRole('button', { name: 'Export backup' }).click()
      await expect(window.locator('.success')).toContainText(backupPath)
      expect(existsSync(backupPath)).toBe(true)

      // The file is an encrypted envelope: none of the business data is readable.
      const fileText = readFileSync(backupPath, 'utf8')
      expect(fileText).not.toContain('Test Pharmacy')
      expect(fileText).not.toContain('passwordHash')
      expect(JSON.parse(fileText)).toMatchObject({ format: 'pharmacy-pos-backup', version: 3, cipher: { alg: 'aes-256-gcm' } })

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

      // Wrong passphrase: refused, nothing replaced.
      await window.getByLabel('Backup passphrase').fill('a-wrong-passphrase')
      await window.getByRole('button', { name: 'Import backup' }).click()
      await expect(window.getByRole('alert')).toContainText('Wrong passphrase')
      expect((await window.evaluate(() => (window as any).api.getSettings())).companyName).toBe('Changed Pharmacy')

      await window.getByLabel('Backup passphrase').fill(BACKUP_PASSPHRASE)
      await window.getByRole('button', { name: 'Import backup' }).click()
      await expect(window.locator('.success')).toContainText('Imported documents')
      await expect(window.getByLabel('Company name')).toHaveValue('Test Pharmacy')

      const restored = await window.evaluate(() => (window as any).api.getSettings())
      expect(restored.companyName).toBe('Test Pharmacy')

      // Gate 1 S4 restore drill: record ids keep their type through export/import, so id-based
      // operations still work after a restore, and the restore itself is in the audit chain.
      const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 3000 })
      await client.connect()
      try {
        const adminDoc = await client.db(TEST_DB).collection('users').findOne({ username: E2E_ADMIN.username })
        expect(adminDoc?._id?.constructor?.name).toBe('ObjectId')
        const updated = await window.evaluate((id) => (window as any).api.usersUpdate(id, { active: true }), String(adminDoc?._id))
        expect(updated.username).toBe(E2E_ADMIN.username)
        const actions = (await client.db(TEST_DB).collection('audit').find({}).toArray()).map((e) => e.action)
        expect(actions).toEqual(expect.arrayContaining(['backup.export', 'backup.import_refused', 'backup.import']))
      } finally {
        await client.close()
      }
    } finally {
      await app.close()
      rmSync(backupDir, { recursive: true, force: true })
    }

    const relaunched = await electron.launch({
      args: ['.', `--user-data-dir=${E2E_PROFILE}`],
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
      await expect(window.getByLabel('Currency code (three letters)')).toHaveValue('USD')
      await expect(window.getByLabel('Tax rate (%)')).toHaveValue('10.00')
      await expect(window.getByLabel('Default language')).toHaveValue('en')

      await window.screenshot({
        path: join(process.cwd(), 'screenshots', 'phase2-settings-persisted.png')
      })
    } finally {
      await relaunched.close()
    }
  })

  test('fails closed at sign-in when MongoDB is unavailable', async () => {
    const app = await electron.launch({
      args: ['.', `--user-data-dir=${E2E_PROFILE}`],
      env: {
        ...process.env,
        MONGODB_DB: TEST_DB,
        MONGODB_URI: 'mongodb://127.0.0.1:27099/?directConnection=true'
      }
    })

    try {
      const window = await app.firstWindow()

      await expect(window).toHaveTitle(/Pharmacy POS/)
      // No first-run setup without a database; the sign-in screen is shown.
      await expect(window.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 10000 })
      expect(await window.evaluate(() => (window as any).api.authSetupRequired())).toBe(false)

      // The removed fallback: admin/admin must not open a session without the database.
      await window.getByLabel('Username').fill('admin')
      await window.getByLabel('Password', { exact: true }).fill('admin')
      await window.getByRole('button', { name: /Login|Sign in/ }).click()
      await expect(window.getByRole('alert')).toHaveText(/Sign-in failed/)
      await expect(window.getByRole('heading', { name: 'Dashboard', level: 1 })).toHaveCount(0)
      expect(await window.evaluate(() => (window as any).api.authState())).toEqual({ authenticated: false })
      await expect(window.evaluate(() => (window as any).api.usersList())).rejects.toThrow(/AUTH_REQUIRED/)

      const dir = join(process.cwd(), 'screenshots')
      mkdirSync(dir, { recursive: true })
      await window.screenshot({ path: join(dir, 'gate1-db-unavailable-login-refused.png') })
    } finally {
      await app.close()
    }
  })
})

test.describe.serial('Business flow - inventory, sale, return', () => {
  test('adds a product, sells it, returns it, and blocks duplicate checkout', async () => {
    await cleanTestDatabase()

    const app = await electron.launch({
      args: ['.', `--user-data-dir=${E2E_PROFILE}`],
      env: { ...process.env, MONGODB_DB: TEST_DB }
    })

    try {
      const window = await app.firstWindow()
      await expect(window).toHaveTitle(/Pharmacy POS/)
      await signIn(window)
      await expect(window.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({
        timeout: 10000
      })

      await window.getByRole('button', { name: 'Settings', exact: true }).click()
      await window.getByLabel('Company name').fill('E2E Pharmacy')
      await window.getByLabel('Currency code (three letters)').fill('USD')
      await window.getByLabel('Currency decimal places').fill('2')
      await window.getByLabel('Charge tax on sales').check()
      await window.getByLabel('Tax rate (%)').fill('10')
      await window.getByLabel('Default language').selectOption('en')
      await window.getByRole('button', { name: 'Save settings' }).click()
      await expect(window.locator('.success')).toContainText('Settings saved')

      await window.getByRole('button', { name: 'Inventory', exact: true }).click()
      await expect(window.getByRole('heading', { name: 'Inventory', level: 2 })).toBeVisible()
      await window.getByRole('button', { name: 'Add product' }).click()
      await window.getByLabel('Product name').fill('Paracetamol 500mg')
      await window.getByLabel('SKU', { exact: true }).fill('PARA-500')
      await window.getByLabel('Barcode (optional)').fill('1234567890')
      await window.getByLabel('Purchase cost').fill('5.00')
      await window.getByLabel('Selling price').fill('10.00')
      await window.getByLabel('Opening stock').fill('20')
      await window.getByLabel('Minimum stock').fill('5')
      await window.getByRole('button', { name: 'Save product' }).click()
      await expect(window.locator('.data-table')).toContainText('Paracetamol 500mg')
      await expect(window.locator('.data-table')).toContainText('20')

      await window.getByRole('button', { name: 'POS', exact: true }).click()
      await expect(window.getByRole('heading', { name: 'Point of sale', level: 2 })).toBeVisible()
      await window.getByRole('button', { name: /Paracetamol 500mg/ }).click()
      await expect(window.locator('.cart-lines')).toContainText('Paracetamol 500mg')
      await window.getByLabel('Paid amount (leave empty for exact)').fill('20.00')
      await window.getByRole('button', { name: /Complete sale/ }).click()

      await expect(window.getByRole('heading', { name: 'Receipt' })).toBeVisible()
      await expect(window.locator('.receipt-panel')).toContainText('11.00 USD')
      await expect(window.locator('.receipt-panel')).toContainText('9.00 USD')

      const sale = await window.evaluate(async () => {
        const sales = await (window as any).api.posSalesList()
        return sales[0]
      })
      expect(sale.totalCents).toBe(1100)
      expect(sale.taxCents).toBe(100)
      expect(sale.status).toBe('completed')

      await window.getByRole('button', { name: 'New sale' }).click()
      await window.getByRole('button', { name: 'Return', exact: true }).click()
      await window.getByLabel('Return reason').fill('Damaged box')
      await window.getByRole('button', { name: 'Confirm return' }).click()
      await expect(window.locator('.success')).toContainText('Invoice returned.')

      const afterReturn = await window.evaluate(async () => {
        const products = await (window as any).api.invProductsList()
        const sales = await (window as any).api.posSalesList()
        return { stock: products[0].stockQuantity, status: sales[0].status }
      })
      expect(afterReturn.stock).toBe(20)
      expect(afterReturn.status).toBe('returned')

      const idempotency = await window.evaluate(async () => {
        const api = (window as any).api
        const products = await api.invProductsList()
        const product = products[0]
        const before = product.stockQuantity
        const input = {
          clientRequestId: 'e2e-idempotency-1',
          lines: [{ productId: product._id, quantity: 2, unitPriceCents: 1 }],
          discountCents: 0,
          taxCents: 0,
          paymentMethod: 'cash',
          paidCents: 2200
        }
        const first = await api.posCheckout(input)
        const second = await api.posCheckout(input)
        const after = (await api.invProductsList())[0].stockQuantity

        let rejectedLowPayment = false
        try {
          await api.posCheckout({
            clientRequestId: 'e2e-low-payment',
            lines: [{ productId: product._id, quantity: 1 }],
            discountCents: 0,
            taxCents: 0,
            paymentMethod: 'cash',
            paidCents: 1
          })
        } catch {
          rejectedLowPayment = true
        }

        return {
          sameSale: first._id === second._id,
          before,
          after,
          serverPriceTotal: first.totalCents,
          rejectedLowPayment
        }
      })

      expect(idempotency.sameSale).toBe(true)
      expect(idempotency.before - idempotency.after).toBe(2)
      // Server tax (10% from saved settings) is added on top of the server-priced lines.
      expect(idempotency.serverPriceTotal).toBe(2200)
      expect(idempotency.rejectedLowPayment).toBe(true)

      const report = await window.evaluate(() => (window as any).api.reportsSales())
      expect(report.totalCount).toBe(1)
      expect(report.cogsCents).toBe(1000)
      expect(report.grossProfitCents).toBe(1000)
      expect(report.returnsCount).toBe(1)
      expect(report.byProduct[0].quantity).toBe(2)
      expect(report.byCashier.admin).toEqual({ count: 1, totalCents: 2200 })

      // Cashbox is the physical drawer: the two cash sales and one cash refund net to 2200,
      // and a card sale must not add anything.
      const cashbox = await window.evaluate(async () => {
        const api = (window as any).api
        const balance = (await api.reportsCashbox()).balanceCents
        const before = (await api.posCashboxList()).length
        const product = (await api.invProductsList())[0]
        const sale = await api.posCheckout({
          clientRequestId: 'e2e-card-1',
          lines: [{ productId: product._id, quantity: 1 }],
          discountCents: 0,
          paymentMethod: 'card'
        })
        const after = (await api.posCashboxList()).length
        return { balance, before, after, method: sale.paymentMethod }
      })
      expect(cashbox.balance).toBe(2200)
      expect(cashbox.method).toBe('card')
      expect(cashbox.after).toBe(cashbox.before)

      const dir = join(process.cwd(), 'screenshots')
      mkdirSync(dir, { recursive: true })
      await window.screenshot({ path: join(dir, 'phase6-pos.png') })
    } finally {
      await app.close()
    }
  })
})

test('receives cartons and sells whole boxes in base units', async () => {
  await cleanTestDatabase()

  const app = await electron.launch({
    args: ['.', `--user-data-dir=${E2E_PROFILE}`],
    env: { ...process.env, MONGODB_DB: TEST_DB }
  })

  try {
    const window = await app.firstWindow()
    await expect(window).toHaveTitle(/Pharmacy POS/)
    await signIn(window)
    await expect(window.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({
      timeout: 10000
    })

    const result = await window.evaluate(async () => {
      const api = (window as any).api
      const product = await api.invProductsCreate({
        name: 'Boxed Amoxicillin',
        sku: 'BOX-AMOX',
        barcode: '555000111',
        purchaseCostCents: 100,
        sellingPriceCents: 200,
        unitsPerBox: 10,
        boxPriceCents: 1800,
        stockQuantity: 0,
        minStock: 0
      })
      await api.invReceiveCarton({
        productId: product._id,
        cartons: 2,
        boxesPerCarton: 5
      })
      const afterIntake = (await api.invProductsList())[0].stockQuantity
      const movements = await api.invStockMovementsList(product._id)

      const sale = await api.posCheckout({
        clientRequestId: 'box-sale-1',
        lines: [{ productId: product._id, quantity: 2, saleUnit: 'box' }],
        discountCents: 0,
        taxCents: 0,
        paymentMethod: 'cash',
        paidCents: 3600
      })
      const afterSale = (await api.invProductsList())[0].stockQuantity
      await api.posReturn({ saleId: sale._id, reason: 'Packaging test' })
      const afterReturn = (await api.invProductsList())[0].stockQuantity

      return {
        afterIntake,
        afterSale,
        afterReturn,
        purchaseQty: movements[0]?.quantity,
        line: sale.lines[0],
        totalCents: sale.totalCents
      }
    })

    expect(result.afterIntake).toBe(100)
    expect(result.afterSale).toBe(80)
    expect(result.afterReturn).toBe(100)
    expect(result.purchaseQty).toBe(100)
    expect(result.line.saleUnit).toBe('box')
    expect(result.line.baseQuantity).toBe(20)
    expect(result.totalCents).toBe(3600)
  } finally {
    await app.close()
  }
})

test('first-run setup and forced reset of a legacy admin/admin account (EN and AR)', async () => {
  const dir = join(process.cwd(), 'screenshots')
  mkdirSync(dir, { recursive: true })

  // First run: setup screen in both languages, weak password refused in the UI.
  await cleanTestDatabase()
  let app = await electron.launch({ args: ['.', `--user-data-dir=${E2E_PROFILE}`], env: { ...process.env, MONGODB_DB: TEST_DB } })
  try {
    const window = await app.firstWindow()
    await expect(window.getByRole('heading', { name: 'Create the administrator account' })).toBeVisible({ timeout: 10000 })
    await window.getByLabel('Username').fill('owner')
    await window.getByLabel('Password', { exact: true }).fill('ab')
    await window.getByLabel('Confirm password').fill('ab')
    await window.getByRole('button', { name: 'Create administrator' }).click()
    await expect(window.getByRole('alert')).toHaveText('The password must be at least 3 characters.')
    await window.screenshot({ path: join(dir, 'gate1-setup-en.png') })
    await window.getByRole('button', { name: 'AR', exact: true }).click()
    await expect(window.getByRole('heading', { name: 'إنشاء حساب المدير' })).toBeVisible()
    await window.screenshot({ path: join(dir, 'gate1-setup-ar.png') })
  } finally {
    await app.close()
  }

  // An existing database with the old default account: admin/admin as a legacy SHA-256 hash.
  await cleanTestDatabase()
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 3000 })
  await client.connect()
  const now = new Date().toISOString()
  await client.db(TEST_DB).collection('users').insertOne({
    username: 'admin',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // gitleaks:allow test-only credential
    role: 'Administrator',
    active: true,
    createdAt: now,
    updatedAt: now
  })

  app = await electron.launch({ args: ['.', `--user-data-dir=${E2E_PROFILE}`], env: { ...process.env, MONGODB_DB: TEST_DB } })
  try {
    const window = await app.firstWindow()
    await expect(window.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 10000 })
    await window.getByLabel('Username').fill('admin')
    await window.getByLabel('Password', { exact: true }).fill('admin')
    await window.getByRole('button', { name: /Login|Sign in/ }).click()
    await expect(window.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
    await window.screenshot({ path: join(dir, 'gate1-force-reset-en.png') })
    // Until the password is changed, the session can do nothing else.
    await expect(window.evaluate(() => (window as any).api.usersList())).rejects.toThrow(/PASSWORD_CHANGE_REQUIRED/)

    await window.getByRole('button', { name: 'AR', exact: true }).click()
    await expect(window.getByRole('heading', { name: 'اختر كلمة مرور جديدة' })).toBeVisible()
    await window.screenshot({ path: join(dir, 'gate1-force-reset-ar.png') })
    await window.getByRole('button', { name: 'EN', exact: true }).click()

    await window.getByLabel('Current password').fill('admin')
    await window.getByLabel('New password').fill('Changed-Admin-Pass-1')
    await window.getByLabel('Confirm password').fill('Changed-Admin-Pass-1')
    await window.getByRole('button', { name: 'Save new password' }).click()
    await expect(window.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 10000 })

    const stored = await client.db(TEST_DB).collection('users').findOne({ username: 'admin' })
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/)
    expect(stored?.mustChangePassword).toBe(false)
  } finally {
    await app.close()
    await client.close()
  }
})

test('Gate 1 S2: CSP, window, navigation and permission guards hold in the built app', async () => {
  const app = await electron.launch({ args: ['.', `--user-data-dir=${E2E_PROFILE}`], env: { ...process.env, MONGODB_DB: TEST_DB } })
  try {
    const window = await app.firstWindow()
    const cspErrors: string[] = []
    window.on('console', (msg) => {
      if (/Content Security Policy/i.test(msg.text())) cspErrors.push(msg.text())
    })
    // Any first screen will do (a session saved by an earlier test may open the Dashboard).
    await expect(window.getByRole('heading', { name: /^(Sign in|Create the administrator account|Dashboard)$/, level: 1 })).toBeVisible({ timeout: 10000 })

    const csp = await window.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? '')
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).not.toContain('unsafe-inline')
    expect(csp).not.toContain('unsafe-eval')
    expect(cspErrors).toEqual([]) // the app renders without violating its own policy

    const injected = await window.evaluate(async () => {
      const s = document.createElement('script')
      s.textContent = '(window as any).__injected = 1'.replace(' as any', '')
      document.body.appendChild(s)
      return (window as any).__injected === 1
    })
    // Inline script is refused. (eval is not tested here: Playwright evaluates over the DevTools
    // protocol, which bypasses CSP; the policy above has no 'unsafe-eval'.)
    expect(injected).toBe(false)

    // New windows are denied; navigation away from the app is blocked.
    expect(await window.evaluate(() => globalThis.open('https://example.com') === null)).toBe(true)
    expect(app.windows()).toHaveLength(1)
    const before = window.url()
    await window.evaluate(() => { globalThis.location.href = 'https://example.com' })
    await window.waitForTimeout(500)
    expect(window.url()).toBe(before)

    // Permissions are denied (camera/microphone/geolocation/notifications).
    const perms = await window.evaluate(async () => {
      const media = await navigator.mediaDevices.getUserMedia({ video: true }).then(() => 'granted', (e) => e.name)
      const notifications = await Notification.requestPermission()
      const geo = await new Promise((resolve) => navigator.geolocation.getCurrentPosition(() => resolve('granted'), (e) => resolve(e.code)))
      return { media, notifications, geo }
    })
    expect(perms.media).not.toBe('granted')
    expect(perms.notifications).toBe('denied')
    expect(perms.geo).not.toBe('granted')

    // No webview tag is attached.
    await window.evaluate(() => { const w = document.createElement('webview'); w.setAttribute('src', 'https://example.com'); document.body.appendChild(w) })
    await window.waitForTimeout(500)
    expect(app.windows()).toHaveLength(1)
  } finally {
    await app.close()
  }
})

test('shared database: settings panel tests a connection; sign-in offers it while the database is down', async () => {
  const app = await electron.launch({ args: ['.', `--user-data-dir=${E2E_PROFILE}`], env: { ...process.env, MONGODB_DB: TEST_DB } })
  try {
    const window = await app.firstWindow()
    await expect(window.getByRole('heading', { name: /^(Sign in|Create the administrator account|Dashboard)$/, level: 1 })).toBeVisible({ timeout: 10000 })
    if (!(await window.getByRole('heading', { name: 'Dashboard', level: 1 }).isVisible())) await signIn(window)
    await window.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(window.getByRole('heading', { name: 'Database location' })).toBeVisible()
    await expect(window.getByText('Now: This computer only')).toBeVisible()
    // Local network: the other device types the main computer's IP and join code.
    await window.getByLabel('Connect to the main computer on this Wi-Fi').check()
    await window.getByLabel('Main computer’s IP address').fill('8.8.8.8')
    await window.getByLabel('Join code').fill('ABCD-EFGH-JKMN')
    await window.getByRole('button', { name: 'Test connection' }).click()
    await expect(window.getByRole('alert').filter({ hasText: 'Wi-Fi IP address' })).toBeVisible()
    await expect(window.getByRole('button', { name: 'Save and restart' })).toBeDisabled()
    await window.getByLabel('Shared server over the internet (several branches)').check()
    const field = window.getByLabel('Connection string')
    await field.fill('mongodb://pos:secret@db.example.com:27017/')
    await window.getByRole('button', { name: 'Test connection' }).click()
    await expect(window.getByRole('alert').filter({ hasText: 'encrypted connection' })).toBeVisible()
    await expect(window.getByRole('button', { name: 'Save and restart' })).toBeDisabled()
    await field.fill('mongodb://127.0.0.1:27017/?replicaSet=rs0')
    await window.getByRole('button', { name: 'Test connection' }).click()
    await expect(window.getByRole('status').filter({ hasText: 'Connected: 127.0.0.1' })).toBeVisible({ timeout: 15000 })
    await expect(window.getByRole('button', { name: 'Save and restart' })).toBeEnabled()
    await window.screenshot({ path: join(process.cwd(), 'screenshots', 'shared-db-settings.png') })
    // Not saved: saving restarts the app onto the chosen server.
  } finally {
    await app.close()
  }

  const down = await electron.launch({
    args: ['.', `--user-data-dir=${E2E_PROFILE}-down`],
    env: { ...process.env, MONGODB_DB: TEST_DB, MONGODB_URI: 'mongodb://127.0.0.1:27099/?directConnection=true' }
  })
  try {
    const window = await down.firstWindow()
    await expect(window.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 15000 })
    await window.getByRole('button', { name: /Database location/ }).click()
    await expect(window.getByRole('heading', { name: 'Database location' })).toBeVisible()
  } finally {
    await down.close()
  }
})

test('shared database: two tills on one server share users (A creates the admin, B signs in)', async () => {
  await cleanTestDatabase()
  const shared = 'mongodb://127.0.0.1:27017/?replicaSet=rs0'
  // Each till's own default database points at a dead port: connecting at all proves the saved
  // shared setting is what the app uses.
  const env = { ...process.env, MONGODB_DB: TEST_DB, MONGODB_URI: 'mongodb://127.0.0.1:27099/?directConnection=true' }
  const tills = [`${E2E_PROFILE}-till-a`, `${E2E_PROFILE}-till-b`]
  try {
    for (const profile of tills) {
      const setup = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], env })
      // What "Save and restart" stores: the shared connection, encrypted with the Windows user key.
      await setup.evaluate(({ app, safeStorage }, uri) => {
        const { join } = process.mainModule!.require('node:path')
        const { writeFileSync } = process.mainModule!.require('node:fs')
        writeFileSync(join(app.getPath('userData'), 'db-connection.bin'), safeStorage.encryptString(JSON.stringify({ mode: 'shared', uri })))
      }, shared)
      await setup.close()
    }

    const a = await electron.launch({ args: ['.', `--user-data-dir=${tills[0]}`], env })
    const b = await electron.launch({ args: ['.', `--user-data-dir=${tills[1]}`], env })
    try {
      const wa = await a.firstWindow()
      const wb = await b.firstWindow()
      for (const w of [wa, wb]) {
        await expect(w.getByRole('heading', { name: /^(Sign in|Create the administrator account)$/, level: 1 })).toBeVisible({ timeout: 15000 })
        expect(await w.evaluate(() => (window as any).api.dbConnectionGet())).toMatchObject({ mode: 'shared', hosts: '127.0.0.1', port: 27028 })
        expect((await w.evaluate(() => (window as any).api.dbHealth())).status).toBe('connected')
      }
      // Till A: first run on the shared server creates the administrator.
      await signIn(wa)
      await expect(wa.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 10000 })
      // The administrator adds a seller; till B sees that user at once (no setup) and signs in with it.
      await wa.evaluate(() => (window as any).api.usersCreate({ username: 'seller1', password: 'Seller-Pass-001', role: 'Seller' })) // gitleaks:allow test-only credential
      await wb.reload()
      expect(await wb.evaluate(() => (window as any).api.authSetupRequired())).toBe(false)
      await expect(wb.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible({ timeout: 10000 })
      // Forgotten password: both codes to send to the provider; a code not signed by the panel is refused.
      await wb.getByRole('button', { name: 'Forgot username or password?' }).click()
      await expect(wb.locator('.recovery-codes dd').nth(1)).toHaveText(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      await wb.getByLabel('Reset code').fill('RST1.e30.e30.AAAA')
      await wb.getByRole('button', { name: 'Check reset code' }).click()
      await expect(wb.getByRole('alert').filter({ hasText: 'not valid' })).toBeVisible()
      await wb.getByLabel('Username', { exact: true }).fill('seller1')
      await wb.getByLabel('Password', { exact: true }).fill('Seller-Pass-001') // gitleaks:allow test-only credential
      await wb.getByRole('button', { name: /Login|Sign in/ }).click()
      // A seller sees only POS and Inventory, and opens on POS (no dashboard).
      const nav = wb.getByRole('navigation')
      await expect(nav.getByRole('button')).toHaveText([/POS|Point of sale/i, /Inventory/i], { timeout: 10000 })
      await expect(wb.getByRole('heading', { name: 'Dashboard', level: 1 })).toHaveCount(0)
      // Both tills write to one audit chain, which still verifies (seq is unique across devices).
      const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 3000 })
      await client.connect()
      try {
        const logins = await client.db(TEST_DB).collection('audit').countDocuments({ action: 'login.success' })
        expect(logins).toBeGreaterThanOrEqual(1)
        const seqs = (await client.db(TEST_DB).collection('audit').find({ seq: { $exists: true } }).toArray()).map((e) => e.seq).sort((x, y) => x - y)
        expect(seqs).toEqual(seqs.map((_, i) => i + 1))
      } finally {
        await client.close()
      }
    } finally {
      await a.close()
      await b.close()
    }
  } finally {
    for (const profile of tills) rmSync(profile, { recursive: true, force: true })
  }
})

test('Gate 1 S3: IPC refuses operator injection, bad ids and extra arguments', async () => {
  const app = await electron.launch({ args: ['.', `--user-data-dir=${E2E_PROFILE}`], env: { ...process.env, MONGODB_DB: TEST_DB } })
  try {
    const window = await app.firstWindow()
    await expect(window.getByRole('heading', { name: /^(Sign in|Create the administrator account|Dashboard)$/, level: 1 })).toBeVisible({ timeout: 10000 })
    const results = await window.evaluate(async () => {
      const api = (window as any).api
      const outcome = (p: Promise<unknown>) => p.then(() => 'resolved', (e: Error) => e.message)
      return {
        loginOperators: await outcome(api.authLogin({ username: { $ne: null }, password: { $gt: '' } })),
        updateBadId: await outcome(api.usersUpdate({ $ne: null }, { role: 'Administrator' })),
        dottedKey: await outcome(api.saveSettings({ 'company.name': 'x' })),
        movementsOperator: await outcome(api.invStockMovementsList({ $ne: null })),
        cashInFloat: await outcome(api.posCashIn(1.5, 'x'))
      }
    })
    for (const [name, message] of Object.entries(results)) expect(message, name).toMatch(/VALIDATION_FAILED/)
  } finally {
    await app.close()
  }
})

test.afterAll(async () => {
  rmSync(E2E_PROFILE, { recursive: true, force: true })
  rmSync(`${E2E_PROFILE}-down`, { recursive: true, force: true })
  await cleanTestDatabase()
})
