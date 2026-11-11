// Gate 1 S6: smoke-test the packaged app (release/win-unpacked) on this machine without touching the
// real profile: a throwaway --user-data-dir, so the bundled MongoDB data and logs go to a temp folder.
// Checks: window opens (on the PHM1 activation screen: a packaged build enforces the licence until Gate 2), bundled mongod 9.0.8 listens on 27028, a service on 27017 is
// left alone, DevTools are disabled, no source maps in app.asar.
// Usage: node scripts/smoke-packaged.mjs
import { mkdtempSync, rmSync } from 'node:fs'
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
  const client = new MongoClient('mongodb://127.0.0.1:27028/?directConnection=true', { serverSelectionTimeoutMS: 5000 })
  await client.connect()
  const info = await client.db('admin').command({ buildInfo: 1 })
  const hello = await client.db('admin').command({ hello: 1 })
  results.bundledMongo = { port: 27028, version: info.version, setName: hello.setName }
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
  results.sourceMapsInAsar === 0
if (!ok) {
  console.error('packaged smoke FAILED')
  process.exit(1)
}
console.log('packaged smoke ok')
