// Gate 1 S6: smoke-test the packaged app (release/win-unpacked) on this machine without touching the
// real profile: a throwaway --user-data-dir, so the bundled MongoDB data and logs go to a temp folder.
// Checks: window opens (on the PHM1 activation screen: a packaged build enforces the licence until Gate 2), bundled mongod 9.0.8 listens on 27028, a service on 27017 is
// left alone, DevTools are disabled, no source maps in app.asar.
// Usage: node scripts/smoke-packaged.mjs
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron } from '@playwright/test'
import asar from '@electron/asar'
import { MongoClient } from 'mongodb'

const exe = join('release', 'win-unpacked', 'Pharmacy POS.exe')
const profile = mkdtempSync(join(tmpdir(), 'pharmacy-pos-smoke-'))
const results = {}
const portOpen = (port) =>
  new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port }, () => (socket.end(), resolve(true)))
    socket.on('error', () => resolve(false))
  })

if (await portOpen(27028)) {
  // Never stop someone's running install: the packaged app would shut its server down to take the port.
  console.error('Port 27028 is in use (an installed Pharmacy POS is running?). Close it and re-run.')
  process.exit(2)
}
const devServiceBefore = await portOpen(27017)
const app = await electron.launch({ executablePath: exe, args: [`--user-data-dir=${profile}`] })
try {
  const window = await app.firstWindow()
  await window.getByText(/^(Activate this device|Create the administrator account)$/).first().waitFor({ timeout: 60000 })
  results.firstScreen = await window.getByText(/^(Activate this device|Create the administrator account)$/).first().textContent()
  results.devToolsDisabled = await app.evaluate(({ BrowserWindow }) => {
    const wc = BrowserWindow.getAllWindows()[0].webContents
    wc.openDevTools()
    return !wc.isDevToolsOpened()
  })
  // Gate 1 S4: the app reaches its database as the least-privilege user; anonymous access is refused.
  const health = await window.evaluate(() => window.api.dbHealth())
  results.appDb = health.status
  results.credentialStore = existsSync(join(profile, 'mongodb-auth.bin')) && !readFileSync(join(profile, 'mongodb-auth.bin')).includes('pharmacy_app')
  results.keyFileLeftOnDisk = existsSync(join(profile, 'mongodb-keyfile'))
  const client = new MongoClient('mongodb://127.0.0.1:27028/?directConnection=true', { serverSelectionTimeoutMS: 5000 })
  await client.connect()
  const hello = await client.db('admin').command({ hello: 1 })
  // buildInfo needs authentication now; the version comes from the app's own (authenticated) health check.
  results.bundledMongo = { port: 27028, version: health.serverVersion, topology: health.topology, setName: hello.setName }
  results.anonymousBuildInfo = await client.db('admin').command({ buildInfo: 1 }).then(() => 'allowed', (e) => e.codeName)
  results.anonymousRead = await client.db('pharmacy_pos').collection('users').findOne({}).then(() => 'allowed', (e) => e.codeName)
  await client.close()
  results.devService27017 = { before: devServiceBefore, during: await portOpen(27017) }
} finally {
  await app.close()
}
results.sourceMapsInAsar = asar.listPackage(join('release', 'win-unpacked', 'resources', 'app.asar')).filter((f) => f.endsWith('.map')).length
rmSync(profile, { recursive: true, force: true })

console.log(JSON.stringify(results, null, 2))
const ok =
  results.firstScreen && results.devToolsDisabled && results.bundledMongo.version === '9.0.8' &&
  results.bundledMongo.setName === 'rs0' && results.devService27017.before === results.devService27017.during &&
  results.sourceMapsInAsar === 0 && results.appDb === 'connected' && results.credentialStore === true &&
  results.keyFileLeftOnDisk === false && results.anonymousRead === 'Unauthorized' && results.anonymousBuildInfo === 'Unauthorized'
if (!ok) {
  console.error('packaged smoke FAILED')
  process.exit(1)
}
console.log('packaged smoke ok')
