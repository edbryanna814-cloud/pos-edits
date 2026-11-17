import { test, _electron as electron, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { MongoClient } from 'mongodb'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Takes the user-manual screenshots: drives the built app on a throw-away local database and draws
// numbered red arrows on the buttons each page of the manual talks about.
// Run: npm run build && npx playwright test -c docs/manual && node docs/manual/build.mjs
// Arabic: set MANUAL_LANG=ar for both commands.
// Staff guide (signed in as a Manager, nothing of the administrator shown): MANUAL_GUIDE=staff for both commands.

const DB = 'pharmacy_pos_manual'
const URI = 'mongodb://127.0.0.1:27017/?replicaSet=rs0'
const AR = process.env['MANUAL_LANG'] === 'ar'
const STAFF = process.env['MANUAL_GUIDE'] === 'staff'
const SHOTS = join(process.cwd(), 'docs', 'manual', `shots${STAFF ? '-staff' : ''}${AR ? '-ar' : ''}`)
const MANAGER = { username: 'mona', password: 'Manual-Staff-2026' } // gitleaks:allow demo-only, throw-away database
// Staff guide: the administrator part only prepares the data; pictures start once the manager signs in.
let live = !STAFF
const PROFILE = mkdtempSync(join(tmpdir(), 'pharmacy-pos-manual-'))
const ADMIN = { username: 'admin', password: 'Manual-Demo-2026' } // gitleaks:allow demo-only, throw-away database

type Target = Locator
async function launch(extra: Record<string, string> = {}): Promise<{ app: ElectronApplication; w: Page }> {
  const app = await electron.launch({ args: ['.', `--user-data-dir=${PROFILE}`], env: { ...process.env, MONGODB_DB: DB, ...extra } })
  const w = await app.firstWindow()
  await app.evaluate(({ BrowserWindow }) => {
    const b = BrowserWindow.getAllWindows()[0]
    b.unmaximize()
    b.setContentSize(1366, 900)
  })
  await w.waitForTimeout(800)
  return { app, w }
}

/** Screenshot with arrow n pointing at targets[n-1]; targets not on screen are skipped (logged). */
/** card: crop to the centred sign-in card instead of the whole window. */
async function shot(w: Page, name: string, targets: Target[], card = false): Promise<void> {
  if (!live) return
  await w.waitForTimeout(400)
  if (AR) {
    // The script finds things by their English labels: mark them, switch to Arabic, find the marks.
    for (const [i, t] of targets.entries()) await t.first().evaluate((el, n) => el.setAttribute('data-manual', String(n)), i + 1).catch(() => {})
    await w.getByRole('button', { name: 'AR', exact: true }).first().click()
    await w.waitForTimeout(600)
    targets = targets.map((_, i) => w.locator(`[data-manual="${i + 1}"]`))
  }
  const first = targets[0]?.first()
  if (first && (await first.count())) await first.scrollIntoViewIfNeeded().catch(() => {})
  const boxes: Array<{ x: number; y: number; width: number; height: number; n: number } | null> = []
  for (const [i, t] of targets.entries()) {
    const l = t.first()
    const b = (await l.count()) ? await l.boundingBox().catch(() => null) : null
    if (!b) console.warn(`[manual] ${name}: arrow ${i + 1} not found`)
    boxes.push(b ? { ...b, n: i + 1 } : null)
  }
  await w.evaluate(({ list, rtl }) => {
    const vw = window.innerWidth, vh = window.innerHeight
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    svg.id = 'manual-overlay'
    // The app's CSP blocks style attributes; CSSOM assignments are allowed.
    Object.assign(svg.style, { position: 'fixed', left: '0', top: '0', width: vw + 'px', height: vh + 'px', zIndex: '99999', pointerEvents: 'none' })
    svg.setAttribute('width', String(vw))
    svg.setAttribute('height', String(vh))
    svg.innerHTML = '<defs><marker id="mh" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#e11d48"/></marker></defs>'
    const add = (tag: string, attrs: Record<string, string | number>, text?: string) => {
      const e = document.createElementNS(ns, tag)
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
      if (text) e.textContent = text
      svg.appendChild(e)
    }
    for (const b of list) {
      if (!b) continue
      add('rect', { x: b.x - 4, y: b.y - 4, width: b.width + 8, height: b.height + 8, rx: 8, fill: 'none', stroke: '#e11d48', 'stroke-width': 3 })
      // Badge just above the target's top-right corner (the label row is empty there), short arrow down;
      // below the target when it touches the top of the window.
      // Right-to-left: the label sits at the right, so use the top-left corner instead.
      const ex = rtl ? Math.min(b.x + b.width - 20, b.x + 34) : Math.max(b.x + 20, b.x + b.width - 34)
      const below = b.y < 60
      const ey = below ? b.y + b.height + 4 : b.y - 4
      const sx = Math.min(vw - 22, Math.max(22, ex + (rtl ? -26 : 26)))
      const sy = below ? ey + 44 : Math.max(20, ey - 40)
      add('line', { x1: sx, y1: sy, x2: ex, y2: ey, stroke: '#e11d48', 'stroke-width': 4, 'marker-end': 'url(#mh)' })
      add('circle', { cx: sx, cy: sy, r: 17, fill: '#e11d48', stroke: '#fff', 'stroke-width': 3 })
      add('text', { x: sx, y: sy + 7, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: '#fff', 'font-family': 'Segoe UI, Arial' }, String(b.n))
    }
    document.body.appendChild(svg)
  }, { list: boxes, rtl: AR })
  await w.screenshot({ path: join(SHOTS, `${name}.png`), ...(card ? { clip: { x: 323, y: 60, width: 760, height: 800 } } : {}) })
  await w.evaluate(() => document.getElementById('manual-overlay')?.remove())
  if (AR) {
    await w.evaluate(() => document.querySelectorAll('[data-manual]').forEach((el) => el.removeAttribute('data-manual')))
    await w.getByRole('button', { name: 'EN', exact: true }).first().click()
    await w.waitForTimeout(600)
  }
}

const btn = (w: Page, name: string | RegExp, exact = typeof name === 'string') => w.getByRole('button', { name, exact })
const go = async (w: Page, section: string) => {
  await w.getByRole('navigation').getByRole('button', { name: section, exact: true }).click()
  await w.waitForTimeout(600)
}

test('manual screenshots', async () => {
  test.setTimeout(240_000)
  mkdirSync(SHOTS, { recursive: true })
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 3000 })
  await client.connect()
  await client.db(DB).dropDatabase()
  await client.close()

  // 1. License screen (shown on a real install before anything else).
  {
    const { app, w } = await launch({ LICENSE_ENFORCE: '1' })
    await w.waitForTimeout(6000)
    await shot(w, '01-license', [btn(w, 'Copy code'), w.getByLabel('License code'), w.getByLabel(/license file/), btn(w, 'Activate')], true)
    await app.close()
  }

  const { app, w } = await launch()
  try {
    // 2. First administrator.
    await w.getByRole('heading', { name: 'Create the administrator account' }).waitFor({ timeout: 15000 })
    await w.getByLabel('Username').fill(ADMIN.username)
    await w.getByLabel('Password', { exact: true }).fill(ADMIN.password)
    await w.getByLabel('Confirm password').fill(ADMIN.password)
    await shot(w, '02-setup', [w.getByLabel('Username'), w.getByLabel('Password', { exact: true }), w.getByLabel('Confirm password'), btn(w, 'Create administrator')], true)
    await btn(w, 'Create administrator').click()
    await w.getByRole('heading', { name: 'Dashboard', level: 1 }).waitFor({ timeout: 15000 })

    // 3. Settings.
    await go(w, 'Settings')
    await w.getByLabel('Company name').fill('Al Shifa')
    await w.getByLabel(/Pharmacy phone/).fill('0100 123 4567')
    await w.getByLabel('Currency code (three letters)').fill('EGP')
    await w.getByLabel('Currency decimal places').fill('2')
    await w.getByLabel('Default language').selectOption('en')
    await shot(w, '03-settings', [w.getByLabel('Company name'), w.getByLabel(/Pharmacy phone/), w.getByLabel('Currency code (three letters)'), w.getByLabel('Charge tax on sales'), w.getByLabel('Default language'), btn(w, 'Save settings')])
    await btn(w, 'Save settings').click()
    await w.locator('.success').waitFor()
    await shot(w, '04-backup', [btn(w, 'Export backup'), btn(w, 'Import backup'), w.getByRole('heading', { name: 'Database location' }), btn(w, 'AR')])

    // 4. Users.
    await go(w, 'Users')
    await btn(w, 'Add user').click()
    await w.getByLabel('Username', { exact: true }).fill('sara')
    await w.getByLabel('Password', { exact: true }).fill('123')
    const role = w.locator('select').filter({ hasText: 'Seller' }).first()
    await role.selectOption({ label: 'Seller' })
    await shot(w, '05-users', [w.getByLabel('Username', { exact: true }), w.getByLabel('Password', { exact: true }), role, w.getByLabel(/User ID/), btn(w, 'Save')])
    await btn(w, 'Save').click()
    await w.waitForTimeout(800)

    // 5. Products.
    await go(w, 'Inventory')
    await btn(w, 'Add product').click()
    await w.getByLabel('Product name').fill('Panadol Extra')
    await w.getByLabel('SKU', { exact: true }).fill('PAN-EX')
    await w.getByLabel('Unit type').selectOption('box')
    await w.getByLabel('Strips in one box').fill('2')
    await w.getByLabel('Pills in one strip (optional)').fill('12')
    await w.getByLabel('Purchase cost').fill('40')
    await w.getByLabel('Box price', { exact: true }).fill('60')
    await w.getByLabel('Opening stock').fill('20')
    await w.getByLabel('Minimum stock').fill('5')
    await w.getByLabel(/Warn \(yellow\)/).fill('5')
    await w.getByLabel(/Customer may return/).fill('14')
    await shot(w, '06-product-1', [w.getByLabel('Product name'), w.getByLabel('Unit type'), w.getByLabel('Strips in one box'), w.getByLabel('Pills in one strip (optional)'), w.getByText('Box price', { exact: true })])
    await btn(w, 'Save product').scrollIntoViewIfNeeded()
    await shot(w, '07-product-2', [w.getByLabel('Opening stock'), w.getByLabel('Minimum stock'), w.getByLabel(/Warn \(yellow\)/), w.getByLabel(/Customer may return/), btn(w, 'Save product')])
    await btn(w, 'Save product').click()
    await w.locator('.data-table').getByText('Panadol Extra').waitFor()

    // A few more products so the stock colours show (red, yellow, normal).
    await w.evaluate(async () => {
      const api = (window as any).api
      const p = (name: string, sku: string, stock: number, min: number, warn: number) =>
        api.invProductsCreate({ name, sku, packaging: 'box', stripsPerBox: 3, unitPriceCents: 4500, purchaseCostCents: 3000, stockQuantity: stock * 3, minStock: min * 3, stockWarnMargin: warn * 3 })
      for (const args of [['Augmentin 1g', 'AUG-1G', 3, 4, 3], ['Brufen 400', 'BRU-400', 7, 4, 5], ['Cataflam 50', 'CAT-50', 30, 5, 5]] as const) {
        try { await p(...args) } catch (e) { console.warn(String(e)) }
      }
    })
    await w.reload()
    await w.waitForTimeout(1200)
    await go(w, 'Inventory')
    const row = w.getByRole('row').filter({ hasText: 'Panadol Extra' })
    await shot(w, '08-inventory-top', [btn(w, 'Add product'), btn(w, 'Import from Excel'), btn(w, 'Export'), btn(w, 'Receive carton')])
    await shot(w, '08-inventory-list', [w.getByRole('row').filter({ hasText: 'Augmentin' }), w.getByRole('row').filter({ hasText: 'Brufen' }), row.getByRole('button', { name: 'Adjust stock' }), row.getByRole('button', { name: 'Delete' })])
    await row.getByRole('button', { name: 'Adjust stock' }).click()
    await w.getByLabel('Counted in').selectOption({ index: 0 }).catch(() => {})
    await w.getByLabel('Quantity (+ receive, - remove)').fill('5')
    await w.getByLabel('Reason').fill('New delivery')
    await shot(w, '09-adjust', [w.getByLabel('Counted in'), w.getByLabel('Quantity (+ receive, - remove)'), w.getByLabel('Reason'), btn(w, 'Apply adjustment')])
    await btn(w, 'Apply adjustment').click()
    await w.waitForTimeout(800)

    // 6. Customers.
    await go(w, 'Customers')
    await btn(w, 'Add customer').click()
    await w.getByLabel('Name', { exact: true }).fill('Mona Ali')
    await w.getByLabel('Phone number').fill('0111 222 3333')
    await w.getByLabel('Discount (%)').fill('10')
    await shot(w, '10-customers', [w.getByLabel('Name', { exact: true }), w.getByLabel('ID number'), w.getByLabel('Phone number'), w.getByLabel('Discount (%)'), btn(w, 'Save customer')])
    await btn(w, 'Save customer').click()
    await w.waitForTimeout(800)

    // 7. Point of sale.
    await go(w, 'POS')
    await w.getByRole('button', { name: /Panadol Extra/ }).first().click()
    await w.waitForTimeout(400)
    const unitBtn = w.getByRole('button', { name: /^Strip:/ }).first()
    await w.getByLabel('Customer', { exact: true }).fill('Mona')
    await w.waitForTimeout(500)
    await w.getByRole('button', { name: /Mona Ali/ }).first().click().catch(() => {})
    await w.getByLabel('Paid amount (leave empty for exact)').fill('100')
    await shot(w, '11-pos', [w.getByPlaceholder('Search name, SKU, or barcode'), w.getByRole('button', { name: /Panadol Extra/ }).first(), unitBtn, w.locator('.cart-lines input').first(), w.getByText('Mona Ali · 0111 222 3333'), w.getByLabel('Discount (%)'), w.getByLabel('Paid amount (leave empty for exact)'), btn(w, /Complete sale/, false)])
    await btn(w, /Complete sale/, false).click()
    await w.getByRole('heading', { name: 'Receipt' }).waitFor()
    await shot(w, '12-invoice', [btn(w, 'Print'), btn(w, 'New sale')])
    await btn(w, 'New sale').click()
    await w.waitForTimeout(500)
    await shot(w, '13-returns', [w.getByText('Returnable items'), w.getByPlaceholder(/Search invoice, product/), w.getByRole('button', { name: 'Return', exact: true }).first(), w.locator('.pos-bottom').getByRole('button', { name: 'Return', exact: true })])
    await w.locator('.pos-bottom').getByRole('button', { name: 'Return', exact: true }).first().click()
    await w.waitForTimeout(500)
    await shot(w, '14-return-confirm', [w.getByLabel(/Reason/), btn(w, 'Confirm return')])
    await btn(w, 'Cancel').first().click().catch(() => {})

    // 8. Attendance, reports, dashboard, audit.
    await go(w, 'Attendance')
    await shot(w, '15-attendance', [btn(w, 'Import from the fingerprint machine'), w.getByLabel('From'), w.getByLabel('To')])
    await go(w, 'Reports')
    await shot(w, '16-reports', [])
    await go(w, 'Dashboard')
    await shot(w, '17-dashboard', [w.getByRole('navigation')])
    await go(w, 'Audit log')
    await shot(w, '18-audit', [])

    // 9. Sign out and the forgotten-password screen.
    await w.evaluate((m) => (window as any).api.usersCreate({ ...m, role: 'Manager', active: true }), MANAGER)
    await btn(w, 'Logout').click()
    await w.getByRole('heading', { name: 'Sign in' }).waitFor()
    await shot(w, '19-signin', [w.getByLabel('Username'), w.getByLabel('Password', { exact: true }), btn(w, /Login|Sign in/, false), btn(w, 'Forgot username or password?')], true)
    await btn(w, 'Forgot username or password?').click()
    await w.waitForTimeout(800)
    await shot(w, '20-recovery', [w.locator('.recovery-codes'), w.getByLabel('Reset code'), btn(w, 'Check reset code')], true)
    if (STAFF) await staffShots(w)
  } finally {
    await app.close()
  }
})

/** The staff guide: the same screens as a Manager sees them (no administrator, backups, files or database). */
async function staffShots(w: Page): Promise<void> {
  live = true
  await w.reload()
  await w.getByRole('heading', { name: 'Sign in' }).waitFor()
  await w.getByLabel('Username').fill(MANAGER.username)
  await w.getByLabel('Password', { exact: true }).fill(MANAGER.password)
  await shot(w, 's01-signin', [w.getByLabel('Username'), w.getByLabel('Password', { exact: true }), btn(w, /Login|Sign in/, false)], true)
  await btn(w, /Login|Sign in/, false).click()
  await w.getByRole('heading', { name: 'Dashboard', level: 1 }).waitFor({ timeout: 15000 })
  await shot(w, 's02-dashboard', [w.getByRole('navigation'), btn(w, 'AR'), btn(w, 'Logout')])

  await go(w, 'Settings')
  await shot(w, 's03-settings', [w.getByLabel('Company name'), w.getByLabel(/Pharmacy phone/), w.getByLabel('Charge tax on sales'), w.getByLabel('Default language'), btn(w, 'Save settings')])

  await go(w, 'Users')
  await btn(w, 'Add user').click()
  await w.getByLabel('Username', { exact: true }).fill('omar')
  await w.getByLabel('Password', { exact: true }).fill('123')
  const role = w.locator('select').filter({ hasText: 'Seller' }).first()
  await role.selectOption({ label: 'Seller' })
  await shot(w, 's04-users', [w.getByLabel('Username', { exact: true }), w.getByLabel('Password', { exact: true }), role, w.getByLabel(/User ID/), btn(w, 'Save')])
  await btn(w, 'Save').click()
  await w.waitForTimeout(800)

  await go(w, 'Inventory')
  await shot(w, 's05-inventory-top', [btn(w, 'Add product'), btn(w, 'Receive carton')])
  await btn(w, 'Add product').click()
  await w.getByLabel('Product name').fill('Voltaren 50')
  await w.getByLabel('SKU', { exact: true }).fill('VOL-50')
  await w.getByLabel('Unit type').selectOption('box')
  await w.getByLabel('Strips in one box').fill('2')
  await w.getByLabel('Pills in one strip (optional)').fill('10')
  await w.getByLabel('Purchase cost').fill('30')
  await w.getByLabel('Box price', { exact: true }).fill('50')
  await w.getByLabel('Opening stock').fill('12')
  await w.getByLabel('Minimum stock').fill('4')
  await w.getByLabel(/Warn \(yellow\)/).fill('3')
  await w.getByLabel(/Customer may return/).fill('7')
  await shot(w, 's06-product-1', [w.getByLabel('Product name'), w.getByLabel('Unit type'), w.getByLabel('Strips in one box'), w.getByLabel('Pills in one strip (optional)'), w.getByText('Box price', { exact: true })])
  await btn(w, 'Save product').scrollIntoViewIfNeeded()
  await shot(w, 's07-product-2', [w.getByLabel('Opening stock'), w.getByLabel('Minimum stock'), w.getByLabel(/Warn \(yellow\)/), w.getByLabel(/Customer may return/), btn(w, 'Save product')])
  await btn(w, 'Save product').click()
  await w.locator('.data-table').getByText('Voltaren 50').waitFor()
  const row = w.getByRole('row').filter({ hasText: 'Panadol Extra' })
  await shot(w, 's08-inventory-list', [w.getByRole('row').filter({ hasText: 'Augmentin' }), w.getByRole('row').filter({ hasText: 'Brufen' }), row.getByRole('button', { name: 'Adjust stock' }), row.getByRole('button', { name: 'Delete' })])
  await row.getByRole('button', { name: 'Adjust stock' }).click()
  await w.getByLabel('Quantity (+ receive, - remove)').fill('-1')
  await w.getByLabel('Reason').fill('Damaged box')
  await shot(w, 's09-adjust', [w.getByLabel('Counted in'), w.getByLabel('Quantity (+ receive, - remove)'), w.getByLabel('Reason'), btn(w, 'Apply adjustment')])
  await btn(w, 'Apply adjustment').click()
  await w.waitForTimeout(800)

  await go(w, 'Customers')
  await btn(w, 'Add customer').click()
  await w.getByLabel('Name', { exact: true }).fill('Ahmed Hassan')
  await w.getByLabel('Phone number').fill('0122 333 4444')
  await w.getByLabel('Discount (%)').fill('5')
  await shot(w, 's10-customers', [w.getByLabel('Name', { exact: true }), w.getByLabel('ID number'), w.getByLabel('Phone number'), w.getByLabel('Discount (%)'), btn(w, 'Save customer')])
  await btn(w, 'Save customer').click()
  await w.waitForTimeout(800)

  await go(w, 'POS')
  await w.getByRole('button', { name: /Voltaren 50/ }).first().click()
  await w.waitForTimeout(400)
  await w.getByLabel('Customer', { exact: true }).fill('Ahmed')
  await w.waitForTimeout(500)
  await w.getByRole('button', { name: /Ahmed Hassan/ }).first().click().catch(() => {})
  await w.getByLabel('Paid amount (leave empty for exact)').fill('50')
  await shot(w, 's11-pos', [w.getByPlaceholder('Search name, SKU, or barcode'), w.getByRole('button', { name: /Voltaren 50/ }).first(), w.getByRole('button', { name: /^Strip:/ }).first(), w.locator('.cart-lines input').first(), w.getByText('Ahmed Hassan · 0122 333 4444'), w.getByLabel('Discount (%)'), w.getByLabel('Paid amount (leave empty for exact)'), btn(w, /Complete sale/, false)])
  await btn(w, /Complete sale/, false).click()
  await w.getByRole('heading', { name: 'Receipt' }).waitFor()
  await shot(w, 's12-invoice', [btn(w, 'Print'), btn(w, 'New sale')])
  await btn(w, 'New sale').click()
  await w.waitForTimeout(500)
  await shot(w, 's13-returns', [w.getByText('Returnable items'), w.getByPlaceholder(/Search invoice, product/), w.getByRole('button', { name: 'Return', exact: true }).first(), w.locator('.pos-bottom').getByRole('button', { name: 'Return', exact: true })])
  await w.locator('.pos-bottom').getByRole('button', { name: 'Return', exact: true }).first().click()
  await w.waitForTimeout(500)
  await shot(w, 's14-return-confirm', [w.getByLabel(/Reason/), btn(w, 'Confirm return')])
  await btn(w, 'Cancel').first().click().catch(() => {})

  await go(w, 'Attendance')
  await shot(w, 's15-attendance', [w.getByLabel('From'), w.getByLabel('To')])
  await go(w, 'Reports')
  await shot(w, 's16-reports', [])
  await go(w, 'Audit log')
  await shot(w, 's17-audit', [])
}
