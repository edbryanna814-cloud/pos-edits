import { app, safeStorage } from 'electron'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { MongoClient } from 'mongodb'
import { rotateIfLarge } from './logRotate'
import { makeCertificate, securityCode } from './lanTls'
import { appUri, createSecrets, directUri, isSecrets, secureBundledMongo, shutdownBundledMongo, type Endpoint, type MongoSecrets } from './mongoAuth'

const ENDPOINT: Endpoint = { host: '127.0.0.1', port: 27028, replicaSet: 'rs0' }
export const LAN_PORT = ENDPOINT.port

/** This PC's local-network (Wi-Fi / cable) IPv4 addresses: what the other tills type in. */
export function lanAddresses(): string[] {
  return Object.values(networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a!.address)
}
const APP_DB = process.env['MONGODB_DB'] ?? 'pharmacy_pos'

let child: ChildProcess | null = null
let secrets: MongoSecrets | null = null
// While this PC hosts the other tills its database accepts TLS only (also from this app).
let endpoint: Endpoint = ENDPOINT
let hostCert: string | null = null

/** The code the other tills compare when they join (null when this PC does not host). */
export const hostSecurityCode = (): string | null => (hostCert ? securityCode(hostCert) : null)

async function ping(e = endpoint): Promise<boolean> {
  const client = new MongoClient(directUri(e), { serverSelectionTimeoutMS: 1000 })
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

async function waitFor(up: boolean, ms: number, e = endpoint): Promise<void> {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if ((await ping(e)) === up) return
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

/** The main computer's TLS certificate and key, kept encrypted like the database credentials. */
async function loadOrCreateCertificate(file: string): Promise<{ cert: string; key: string }> {
  const stored = await readFile(file).catch(() => null)
  if (stored) {
    const parsed = JSON.parse(safeStorage.decryptString(stored))
    if (typeof parsed?.cert !== 'string' || typeof parsed?.key !== 'string') throw new Error('Certificate store is invalid')
    return parsed
  }
  const created = makeCertificate()
  await writeFile(`${file}.tmp`, safeStorage.encryptString(JSON.stringify(created)))
  await rename(`${file}.tmp`, file)
  return created
}

/**
 * Only this Windows account (and Windows itself) may open the app's folder: database files, logs,
 * keys. Other accounts on the PC are refused. Shortcut: a Windows administrator can still take
 * ownership, and a stolen disk is readable unless BitLocker is on (the install note asks for it).
 */
export async function lockAppFolder(): Promise<void> {
  if (!app.isPackaged || process.platform !== 'win32') return
  const run = promisify(execFile)
  const sys = join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32')
  const { stdout } = await run(join(sys, 'whoami.exe'), ['/user', '/fo', 'csv', '/nh'], { windowsHide: true })
  const sid = /"(S-1-[0-9-]+)"/.exec(stdout)?.[1]
  if (!sid) throw new Error('Windows account not found')
  const folder = app.getPath('userData')
  // Grant first, then drop the inherited entries, so the app never locks itself out.
  await run(join(sys, 'icacls.exe'), [folder, '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F', '/Q'], { windowsHide: true })
  await run(join(sys, 'icacls.exe'), [folder, '/inheritance:r', '/Q'], { windowsHide: true })
}

/** joinCode set: this PC is the main one and also listens on the local network for the other tills. */
export async function startBundledMongo(joinCode: string | null = null): Promise<void> {
  if (!app.isPackaged) return

  const userData = app.getPath('userData')
  const dataDir = join(userData, 'mongodb-data')
  const logFile = join(userData, 'mongodb.log')
  const keyFile = join(userData, 'mongodb-keyfile')
  // Set first: if anything below fails, the app connects to nothing (port 1 is closed) instead of
  // falling back to the development default 127.0.0.1:27017 or to an unsecured server on 27028.
  process.env['MONGODB_URI'] = 'mongodb://127.0.0.1:1/?directConnection=true&serverSelectionTimeoutMS=500'
  secrets = await loadOrCreateSecrets(join(userData, 'mongodb-auth.bin'))
  const certFile = join(userData, 'lan-tls-cert.pem') // public certificate: the local client pins it
  const tlsKeyFile = join(userData, 'lan-tls-key.pem')
  const tlsEndpoint: Endpoint = { ...ENDPOINT, tlsCAFile: certFile }
  const hadCert = existsSync(certFile)
  let tls: { cert: string; key: string } | null = null
  hostCert = null
  endpoint = ENDPOINT
  if (joinCode) {
    tls = await loadOrCreateCertificate(join(userData, 'lan-tls.bin'))
    await writeFile(certFile, tls.cert)
    hostCert = tls.cert
    endpoint = tlsEndpoint
  }
  process.env['MONGODB_URI'] = appUri(endpoint, secrets)

  // A mongod left over from an earlier run (possibly a pre-Gate-1 one without access control, or one
  // that required TLS) is stopped, so the server always runs with the options below.
  for (const e of hadCert || tls ? [ENDPOINT, tlsEndpoint] : [ENDPOINT]) {
    if (await ping(e)) {
      await shutdownBundledMongo(e, secrets)
      await waitFor(false, 15000, e)
    }
  }

  await mkdir(dataDir, { recursive: true })
  await rotateIfLarge(logFile) // mongod opens it with --logappend; keep it bounded
  // The keyFile exists on disk only while mongod starts; mongod reads it once at startup.
  await writeFile(keyFile, secrets.keyFile, { mode: 0o600 })
  if (tls) await writeFile(tlsKeyFile, tls.cert + tls.key, { mode: 0o600 })

  const executable = join(process.resourcesPath, 'mongodb', 'mongod.exe')
  child = spawn(
    executable,
    [
      '--dbpath', dataDir,
      '--port', String(ENDPOINT.port),
      '--bind_ip', joinCode ? '0.0.0.0' : ENDPOINT.host,
      // Hosting: everything on the Wi-Fi is encrypted (the other tills pin this certificate).
      ...(tls ? ['--tlsMode', 'requireTLS', '--tlsCertificateKeyFile', tlsKeyFile, '--tlsCAFile', certFile, '--tlsAllowConnectionsWithoutCertificates'] : []),
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
    await rm(tlsKeyFile, { force: true }) // mongod loads the key once at startup
  }
  await secureBundledMongo(endpoint, secrets, APP_DB, joinCode)
}

export async function stopBundledMongo(): Promise<void> {
  if (!child) return
  const running = child
  await shutdownBundledMongo(endpoint, secrets)
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (running.exitCode !== null || running.killed) return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  running.kill()
}
