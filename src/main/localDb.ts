import { app, safeStorage } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MongoClient } from 'mongodb'
import { rotateIfLarge } from './logRotate'
import { appUri, createSecrets, directUri, isSecrets, secureBundledMongo, shutdownBundledMongo, type Endpoint, type MongoSecrets } from './mongoAuth'

const ENDPOINT: Endpoint = { host: '127.0.0.1', port: 27028, replicaSet: 'rs0' }
const APP_DB = process.env['MONGODB_DB'] ?? 'pharmacy_pos'

let child: ChildProcess | null = null
let secrets: MongoSecrets | null = null

async function ping(): Promise<boolean> {
  const client = new MongoClient(directUri(ENDPOINT), { serverSelectionTimeoutMS: 1000 })
  try {
    await client.connect()
    await client.db('admin').command({ ping: 1 })
    return true
  } catch {
    return false
  } finally {
    await client.close().catch(() => undefined)
  }
}

async function waitFor(up: boolean, ms: number): Promise<void> {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if ((await ping()) === up) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(up ? 'Bundled MongoDB did not start in time' : 'Bundled MongoDB did not stop in time')
}

/**
 * Gate 1 S4: MongoDB credentials and the replica-set keyFile live in one blob encrypted with the
 * OS user's key (Electron safeStorage = DPAPI on Windows). Shortcut: any process running as the same
 * Windows user can decrypt it; this protects against other users and casual access, not the same user.
 */
async function loadOrCreateSecrets(file: string): Promise<MongoSecrets> {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption (DPAPI) unavailable; refusing to store database credentials')
  const stored = await readFile(file).catch(() => null)
  if (stored) {
    const parsed = JSON.parse(safeStorage.decryptString(stored))
    if (!isSecrets(parsed)) throw new Error('Database credential store is invalid')
    return parsed
  }
  const created = createSecrets()
  await writeFile(`${file}.tmp`, safeStorage.encryptString(JSON.stringify(created)))
  await rename(`${file}.tmp`, file)
  return created
}

export async function startBundledMongo(): Promise<void> {
  if (!app.isPackaged) return

  const userData = app.getPath('userData')
  const dataDir = join(userData, 'mongodb-data')
  const logFile = join(userData, 'mongodb.log')
  const keyFile = join(userData, 'mongodb-keyfile')
  // Set first: if anything below fails, the app connects to nothing (port 1 is closed) instead of
  // falling back to the development default 127.0.0.1:27017 or to an unsecured server on 27028.
  process.env['MONGODB_URI'] = 'mongodb://127.0.0.1:1/?directConnection=true&serverSelectionTimeoutMS=500'
  secrets = await loadOrCreateSecrets(join(userData, 'mongodb-auth.bin'))
  process.env['MONGODB_URI'] = appUri(ENDPOINT, secrets)

  // A mongod left over from an earlier run (possibly a pre-Gate-1 one without access control) is
  // stopped, so the server always runs with the options below.
  if (await ping()) {
    await shutdownBundledMongo(ENDPOINT, secrets)
    await waitFor(false, 15000)
  }

  await mkdir(dataDir, { recursive: true })
  await rotateIfLarge(logFile) // mongod opens it with --logappend; keep it bounded
  // The keyFile exists on disk only while mongod starts; mongod reads it once at startup.
  await writeFile(keyFile, secrets.keyFile, { mode: 0o600 })

  const executable = join(process.resourcesPath, 'mongodb', 'mongod.exe')
  child = spawn(
    executable,
    [
      '--dbpath', dataDir,
      '--port', String(ENDPOINT.port),
      '--bind_ip', ENDPOINT.host,
      '--replSet', ENDPOINT.replicaSet,
      '--keyFile', keyFile, // implies --auth
      '--logpath', logFile,
      '--logappend',
      '--quiet',
      '--slowms', '600000' // slow-operation log lines include query values (customer data): effectively off
    ],
    { windowsHide: true, stdio: 'ignore' }
  )
  child.on('error', (error) => console.error('[mongo] failed to spawn', error))
  child.on('exit', (code) => {
    console.error(`[mongo] exited with code ${code}`)
    child = null
  })

  try {
    await waitFor(true, 30000)
  } finally {
    await rm(keyFile, { force: true })
  }
  await secureBundledMongo(ENDPOINT, secrets, APP_DB)
}

export async function stopBundledMongo(): Promise<void> {
  if (!child) return
  const running = child
  await shutdownBundledMongo(ENDPOINT, secrets)
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (running.exitCode !== null || running.killed) return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  running.kill()
}
