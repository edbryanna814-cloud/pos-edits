// Builds the user guide PDF from docs/manual/shots (made by shoot.spec.ts) with Microsoft Edge.
// Run: node docs/manual/build.mjs   (Arabic: MANUAL_LANG=ar; staff guide: MANUAL_GUIDE=staff, text in pages-staff.mjs)
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const version = JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf8')).version
const AR = process.env.MANUAL_LANG === 'ar'
const STAFF = process.env.MANUAL_GUIDE === 'staff'
const SHOTS = `shots${STAFF ? '-staff' : ''}${AR ? '-ar' : ''}`
const OUT = join(here, `Manuscript${STAFF ? ' Staff' : ''} ${AR ? 'AR' : 'EN'}.pdf`)

// [shot, title, intro, steps (step n = red arrow n)]
const pagesEn = [
  ['01-license', 'Start: activate the program', 'The first time you open the program it asks for a license.', [
    'Press <b>Copy code</b> and send the device code to your supplier (WhatsApp or e-mail).',
    'Paste the license code you receive here…',
    '…or, if you received a license file (.anbc), choose it here.',
    'Press <b>Activate</b>. You only do this once per computer, and again when the license ends.']],
  ['02-setup', 'Create the administrator', 'The administrator is the owner account. It can do everything.', [
    'Type a username, for example <i>admin</i>.',
    'Type a password (at least 3 characters).',
    'Type the same password again.',
    'Press <b>Create administrator</b>. Keep the username and password somewhere safe.']],
  ['19-signin', 'Sign in every day', 'Each person signs in with their own account.', [
    'Your username.', 'Your password.', 'Press <b>Login</b>.',
    'Forgot the username or password? Press <b>Forgot username or password?</b> (next page).']],
  ['20-recovery', 'Forgot username or password', 'Nobody can read a password, but the supplier can let you set a new one.', [
    'Send these two codes to your supplier.',
    'Paste the reset code you receive (it works for one hour).',
    'Press <b>Check reset code</b>, then choose the account and type a new password.']],
  ['17-dashboard', 'The main menu', 'The menu on the left opens each part of the program. People only see the parts their role allows.', [
    'Dashboard (today’s sales and seller results) · POS (selling) · Inventory (products and stock) · Reports · Customers · Attendance · Users · Audit log (who did what) · Settings.']],
  ['03-settings', 'Settings: your pharmacy', 'Do this once, after the first sign-in.', [
    'Your pharmacy name. It is printed on the invoice after the word “صيدلية”.',
    'The pharmacy phone number, printed on the invoice.',
    'The currency, for example <i>EGP</i>.',
    'Tick this only if you charge tax; then type the tax rate.',
    'The language the program opens in (English or Arabic).',
    'Press <b>Save settings</b>.']],
  ['04-backup', 'Backups, devices and language', 'Only the administrator sees the backup buttons. The program’s data can be opened only by this Windows account, and between computers on the Wi-Fi it is encrypted. Also turn on disk encryption once: Windows Settings → Privacy & security → Device encryption (or BitLocker), so a stolen computer cannot be read.', [
    '<b>Export backup</b> saves a copy of everything to a file. Type a backup passphrase first and keep it safe: without it the backup cannot be opened.',
    '<b>Import backup</b> brings a backup back (it replaces the current data).',
    '<b>Database location</b>: several computers on the same Wi-Fi can share one database. On the main computer choose “host”, then on the others choose “join” and type the join code it shows. Before saving, check that both computers show the same <b>security code</b>.',
    'Press <b>AR</b> or <b>EN</b> at any time to switch the language.']],
  ['05-users', 'Users and roles', 'Open <b>Users</b>, press <b>Add user</b>. <b>Administrator</b>: everything. <b>Manager</b>: everything except the database settings and the administrator accounts. <b>Seller</b>: only POS and Inventory.', [
    'Username for the new person.',
    'Password (at least 3 characters).',
    'Role: Administrator, Manager or Seller.',
    'User ID: leave it empty to get the next number (1, 2, 3…), or type one. It must match the person’s number on the fingerprint machine.',
    'Press <b>Save</b>.']],
  ['08-inventory-top', 'Inventory: the buttons', 'Open <b>Inventory</b>.', [
    '<b>Add product</b>: add one product by hand (next pages).',
    '<b>Import from Excel</b>: add many products at once. The first row must hold the column names: Name, SKU, Barcode, Unit (box / strip / pill), Strips per box, Pills per strip, Price, Cost, Stock, Min stock, Expiry. You see all rows and any mistakes before you press <b>Add</b>. (Administrator only.)',
    '<b>Export</b>: save the product list as Excel or .db. (Administrator only.)',
    '<b>Receive carton</b>: scan the barcode, type the number of cartons, and the stock is added.']],
  ['06-product-1', 'Add a product (1 of 2)', 'Press <b>Add product</b> and fill in:', [
    'The product name.',
    'Unit type: how you buy it — <b>Box</b>, <b>Strip</b> or <b>Pill</b>.',
    'How many strips are in one box.',
    'How many pills are in one strip (optional; fill it if you sell single pills).',
    'The price of one box. The program works out the strip and pill prices for you (shown under the box).']],
  ['07-product-2', 'Add a product (2 of 2)', 'Then:', [
    'How many you have now.',
    'The minimum. At or below it the product turns <span class="red">red</span>.',
    'How early to warn. Within this many of the minimum it turns <span class="yellow">yellow</span>.',
    'If customers may return it: within how many days (leave empty if not).',
    'Press <b>Save product</b>.']],
  ['08-inventory-list', 'The product list and stock colours', 'Every product shows its stock in boxes, strips and pills.', [
    '<span class="red">Red</span>: at or below the minimum — order now.',
    '<span class="yellow">Yellow</span>: near the minimum — order soon.',
    '<b>Adjust stock</b>: add or remove stock (next page).',
    '<b>Delete</b>: remove the product (Administrator and Manager). The program asks first.']],
  ['09-adjust', 'Adjust stock', 'Use this for new deliveries, damaged items or counting mistakes.', [
    'Counted in: boxes, strips or pills.',
    'How many: a plain number adds, a number with “-” removes (for example -2).',
    'Why (for example “New delivery”).',
    'Press <b>Apply adjustment</b>.']],
  ['10-customers', 'Customers', 'Open <b>Customers</b>, press <b>Add customer</b>. Fill at least one box.', [
    'Name.', 'ID number.', 'Phone number.',
    'Discount in % — it is applied by itself when you choose this customer at the POS.',
    'Press <b>Save customer</b>.']],
  ['11-pos', 'Selling (POS)', 'Open <b>POS</b>.', [
    'Search by name, code or barcode — or just scan the barcode.',
    'Click the product to sell one box…',
    '…or click <b>Strip</b> or <b>Pill</b> under it to sell a strip or a single pill.',
    'Change the quantity here.',
    'Choose the customer (optional). Type the name or phone; you can add a new customer here too.',
    'Discount in % (filled from the customer; you can change it).',
    'How much the customer paid. The change is shown below it.',
    'Press <b>Complete sale</b>.']],
  ['12-invoice', 'Print the invoice', 'The invoice shows the pharmacy name and phone, the customer, the seller, the items, the total, the paid amount and the change (الباقي).', [
    'Press <b>Print</b>.',
    'Press <b>New sale</b> for the next customer.']],
  ['13-returns', 'Returns', 'Under the POS you see every item that can still be returned. Items drop off the list by themselves when their return days are over.', [
    'The returnable items list.',
    'Search by invoice number, product or customer.',
    'Press <b>Return</b> on the line the customer brings back.',
    'Or return a whole invoice from <b>Recent sales</b>.']],
  ['14-return-confirm', 'Confirm a return', 'The money is refunded and the stock goes back.', [
    'Write a reason (optional).', 'Press <b>Confirm return</b>.']],
  ['15-attendance', 'Attendance (fingerprint machine)', 'Open <b>Attendance</b>. Each person’s User ID must match their number on the machine.', [
    'Save the records from the fingerprint machine (Excel file or attlog.dat on a USB stick), then press this button and choose the file. Records already imported are skipped.',
    'From date…', '…to date. You see clock-in, clock-out, breaks and hours worked per person, and each seller’s sales on the dashboard.']],
  ['16-reports', 'Reports', 'Sales totals, profit, best-selling products and sales per seller. Managers can download sales and purchasing reports here; <b>Export</b> on other lists saves Excel or .db (administrator).', [
    'First day of the period…', '…last day (at most one year).',
    '<b>Sales report</b>: every invoice in the period with seller, customer, items, discount, tax and total, plus a totals row. Choose where to save the Excel file.',
    '<b>Purchasing report</b>: every purchase order in the period with supplier, products, quantities and costs, plus a totals row.']],
  ['18-audit', 'Audit log', 'Every important action is recorded here: who did it and when (sales, returns, price changes, deletes, sign-ins).', []]
]

const lang = AR ? 'ar' : 'en'
const staff = STAFF ? await import('./pages-staff.mjs') : null
const ar = AR && !STAFF ? await import('./pages-ar.mjs') : null
const pages = staff ? staff.pages[lang] : ar ? ar.pages : pagesEn
const model = staff ? staff.pages.en : pagesEn
if (pages.map((p) => p[0]).join() !== model.map((p) => p[0]).join()) throw new Error('Arabic pages differ from English')
const cover = staff ? staff.cover[lang] : ar ? ar.cover : { title: 'Anubis Pharmacy', sub: 'User guide · version', arrows: 'Each picture has <b style="color:#e11d48">red numbered arrows</b>.<br>The numbered steps under it say what each one does.', contents: 'Contents' }
const html = `<!doctype html><html lang="${AR ? 'ar' : 'en'}" dir="${AR ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>Anubis Pharmacy — User Guide</title><style>
@page { size: A4; margin: 14mm 14mm 16mm }
body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #111; font-size: 12.5pt; line-height: 1.45 }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; text-align: center }
.cover .logo { width: 70mm; border: 0; margin: 0 auto 10mm } .cover h1 { font-size: 34pt; margin: 0 0 8px; color: #0f766e } .cover p { font-size: 15pt; color: #444 }
section { page-break-before: always }
h2 { color: #0f766e; font-size: 20pt; margin: 0 0 4px } .intro { margin: 0 0 10px; color: #333 }
img { width: 100%; border: 1px solid #ccc; border-radius: 6px }
ol { padding: 0; margin: 10px 0 0; list-style: none; counter-reset: n }
li { counter-increment: n; position: relative; padding-block: 4px; padding-inline-start: 40px; margin-bottom: 4px }
li::before { content: counter(n); position: absolute; inset-inline-start: 0; top: 2px; width: 28px; height: 28px; border-radius: 50%; background: #e11d48; color: #fff; font-weight: 700; text-align: center; line-height: 28px }
.red { color: #b91c1c; font-weight: 700 } .yellow { color: #a16207; font-weight: 700 }
.toc li::before { background: #0f766e }
</style></head><body>
<div class="cover"><img class="logo" src="../../src/renderer/src/assets/logo.png" alt=""><h1>${cover.title}</h1><p>${cover.sub} ${version}</p><p style="margin-top:40px">${cover.arrows}</p></div>
<section><h2>${cover.contents}</h2><ol class="toc">${pages.map((p) => `<li>${p[1]}</li>`).join('')}</ol></section>
${pages.map(([shot, title, intro, steps]) => {
  if (!existsSync(join(here, SHOTS, `${shot}.png`))) throw new Error(`missing shot ${shot}`)
  return `<section><h2>${title}</h2><p class="intro">${intro}</p><img src="${SHOTS}/${shot}.png">${steps.length ? `<ol>${steps.map((s) => `<li>${s}</li>`).join('')}</ol>` : ''}</section>`
}).join('\n')}
</body></html>`

const htmlPath = join(here, 'guide.html')
writeFileSync(htmlPath, html)
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
if (!edge) throw new Error('Microsoft Edge not found')
execFileSync(edge, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${OUT}`, pathToFileURL(htmlPath).href], { stdio: 'inherit' })
console.log(OUT)
