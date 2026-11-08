import { createPrivateKey, randomUUID, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function fail(message) {
  console.error(`Error: ${message}`)
  console.error('')
  console.error('Usage:')
  console.error('  node scripts/license-generator.mjs --device <32-hex-id> --price 500 --currency EGP --period month --count 1')
  console.error('  period: day | month | year     count: positive integer (default 1)')
  process.exit(1)
}

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

const device = (getArg('device') || '').trim().toLowerCase()
const price = (getArg('price') || '').trim()
const currency = (getArg('currency') || '').trim().toUpperCase()
const period = (getArg('period') || '').trim().toLowerCase()
const count = Number(getArg('count') || 1)

if (!/^[a-f0-9]{32}$/.test(device)) fail('device must be the 32-character Device ID shown in the app')
if (!/^\d+(\.\d{1,4})?$/.test(price)) fail('price must be a positive amount like 500 or 499.99')
if (!/^[A-Z]{3}$/.test(currency)) fail('currency must be a 3-letter ISO code like EGP or USD')
if (!['day', 'month', 'year'].includes(period)) fail('period must be day, month, or year')
if (!Number.isInteger(count) || count < 1) fail('count must be a positive integer')

function addPeriod(from, unit, amount) {
  const date = new Date(from)
  if (unit === 'day') {
    date.setUTCDate(date.getUTCDate() + amount)
    return date
  }
  const months = unit === 'year' ? amount * 12 : amount
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return date
}

const privateKeyPath = process.env.LICENSE_PRIVATE_KEY_PATH || join(homedir(), '.pharmacy-pos-license', 'private.pem')
let privateKey
try {
  privateKey = createPrivateKey(readFileSync(privateKeyPath, 'utf8'))
} catch {
  fail(`cannot read private key at ${privateKeyPath} (run: node scripts/license-keygen.mjs)`)
}

const issuedAt = Date.now()
const payload = {
  v: 1,
  lid: randomUUID(),
  dev: device,
  price,
  cur: currency,
  per: period,
  cnt: count,
  iat: issuedAt,
  exp: addPeriod(issuedAt, period, count).getTime()
}

const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8')
const signature = sign(null, payloadBytes, privateKey)
const code = `PHM1.${payloadBytes.toString('base64url')}.${signature.toString('base64url')}`

console.log(code)
console.error('')
console.error('License details:')
console.error(`  License ID : ${payload.lid}`)
console.error(`  Device ID  : ${payload.dev}`)
console.error(`  Price      : ${payload.price} ${payload.cur}`)
console.error(`  Period     : ${payload.per} x ${payload.cnt}`)
console.error(`  Issued     : ${new Date(payload.iat).toISOString()}`)
console.error(`  Expires    : ${new Date(payload.exp).toISOString()}`)
