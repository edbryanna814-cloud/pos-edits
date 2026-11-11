import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MongoClient } from 'mongodb'
import { afterAll, describe, expect, it } from 'vitest'
import { adminUri, appUri, createSecrets, directUri, isSecrets, secureBundledMongo, shutdownBundledMongo, type Endpoint } from '../../src/main/mongoAuth'

// Gate 1 S4: real mongod with --keyFile. Binary: MONGOD_BIN (CI copies it from the mongo:9.0 service
// container), else the vendored or installed Windows binary. In CI a missing binary is a failure.
const candidates = [process.env['MONGOD_BIN'], join('vendor', 'mongodb', 'mongod.exe'), 'C:\\Program Files\\MongoDB\\Server\\9.0\\bin\\mongod.exe']
const MONGOD = candidates.find((p) => p && existsSync(p))
if (!MONGOD && process.env['CI']) throw new Error('MONGOD_BIN is required in CI for the MongoDB auth tests')

const dir = mkdtempSync(join(tmpdir(), 'mongo-auth-test-'))
const running: ChildProcess[] = []
afterAll(async () => {
  for (const p of running) if (p.exitCode === null) p.kill()
  await new Promise((r) => setTimeout(r, 500))
  rmSync(dir, { recursive: true, force: true })
})

function startMongod(name: string, port: number, keyFile?: string): ChildProcess {
  const dbpath = join(dir, name)
  mkdirSync(dbpath, { recursive: true })
  const args = ['--dbpath', dbpath, '--port', String(port), '--bind_ip', '127.0.0.1', '--replSet', 'rs0', '--quiet', '--logpath', join(dir, `${name}-${port}.log`)]
  if (keyFile) args.push('--keyFile', keyFile)
  const p = spawn(MONGOD!, args, { stdio: 'ignore' })
  running.push(p)
  return p
}

async function waitUp(e: Endpoint): Promise<void> {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    const c = new MongoClient(directUri(e), { serverSelectionTimeoutMS: 500 })
    try {
      await c.connect()
      await c.db('admin').command({ ping: 1 })
      return
    } catch {
      await new Promise((r) => setTimeout(r, 300))
    } finally {
      await c.close().catch(() => undefined)
    }
  }
  throw new Error('mongod did not start')
}

async function waitExit(p: ChildProcess): Promise<void> {
  const deadline = Date.now() + 15000
  while (p.exitCode === null && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200))
  expect(p.exitCode).not.toBeNull()
}

async function outcome(uri: string, fn: (c: MongoClient) => Promise<unknown>): Promise<string> {
  const c = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 })
  try {
    await c.connect()
    await fn(c)
    return 'ok'
  } catch (error) {
    const e = error as { codeName?: string; message?: string }
    return e.codeName ?? (/auth/i.test(String(e.message)) ? 'AuthenticationFailed' : String(e.message))
  } finally {
    await c.close().catch(() => undefined)
  }
}

function writeKey(secrets: ReturnType<typeof createSecrets>, name: string): string {
  const file = join(dir, `${name}.key`)
  writeFileSync(file, secrets.keyFile, { mode: 0o600 })
  return file
}

describe.skipIf(!MONGOD)('bundled MongoDB access control (Gate 1 S4)', () => {
  it('generates strong secrets', () => {
    const s = createSecrets()
    expect(isSecrets(s)).toBe(true)
    expect(s.keyFile).toMatch(/^[A-Za-z0-9+/]{1000}$/)
    expect(createSecrets().adminPassword).not.toBe(s.adminPassword)
    expect(isSecrets({ adminPassword: 'short', appPassword: 'x', keyFile: 'y' })).toBe(false)
  })

  it('fresh data directory: secures it, enforces least privilege, and shuts down with the admin user', async () => {
    const e: Endpoint = { host: '127.0.0.1', port: 27191, replicaSet: 'rs0' }
    const s = createSecrets()
    const p = startMongod('fresh', e.port, writeKey(s, 'fresh'))
    await waitUp(e)

    expect(await secureBundledMongo(e, s, 'pharmacy_pos')).toBe('created')
    expect(await secureBundledMongo(e, s, 'pharmacy_pos')).toBe('existing') // idempotent on every start

    // Unauthenticated: nothing beyond ping/hello.
    expect(await outcome(directUri(e), (c) => c.db('pharmacy_pos').collection('users').findOne({}))).toBe('Unauthorized')
    expect(await outcome(directUri(e), (c) => c.db('admin').command({ listDatabases: 1 }))).toBe('Unauthorized')
    expect(await outcome(directUri(e), (c) => c.db('admin').command({ createUser: 'intruder', pwd: 'x', roles: ['root'] }))).toBe('Unauthorized')

    // App user: full use of its own database, including the settings validator (collMod) and transactions.
    const app = appUri(e, s)
    expect(await outcome(app, async (c) => {
      const db = c.db('pharmacy_pos')
      await db.collection('items').insertOne({ name: 'x' })
      await db.collection('items').createIndex({ name: 1 })
      await db.createCollection('settings', { validator: { $jsonSchema: { bsonType: 'object' } } })
      await db.command({ collMod: 'settings', validator: { $jsonSchema: { bsonType: 'object', properties: { name: { bsonType: 'string' } } } } })
      const session = c.startSession()
      try {
        await session.withTransaction(() => db.collection('items').insertOne({ name: 'tx' }, { session }))
      } finally {
        await session.endSession()
      }
    })).toBe('ok')

    // App user: nothing outside its database, no user/role admin, no dropDatabase, no shutdown.
    expect(await outcome(app, (c) => c.db('other').collection('x').findOne({}))).toBe('Unauthorized')
    expect(await outcome(app, (c) => c.db('admin').collection('system.users').findOne({}))).toBe('Unauthorized')
    expect(await outcome(app, (c) => c.db('pharmacy_pos').dropDatabase())).toBe('Unauthorized')
    expect(await outcome(app, (c) => c.db('admin').command({ createUser: 'intruder', pwd: 'x', roles: ['root'] }))).toBe('Unauthorized')
    expect(await outcome(app, (c) => c.db('admin').command({ shutdown: 1 }))).toBe('Unauthorized')

    // Wrong credentials are refused.
    expect(await outcome(appUri(e, createSecrets()), (c) => c.db('pharmacy_pos').collection('items').findOne({}))).toBe('AuthenticationFailed')

    await shutdownBundledMongo(e, s)
    await waitExit(p)
  })

  it('existing pre-Gate-1 data directory (no auth): secured on next start, data kept', async () => {
    const e: Endpoint = { host: '127.0.0.1', port: 27192, replicaSet: 'rs0' }
    // Old build: no keyFile, no users.
    const old = startMongod('legacy', e.port)
    await waitUp(e)
    const c = new MongoClient(directUri(e))
    await c.connect()
    await c.db('admin').command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: `127.0.0.1:${e.port}` }] } })
    for (let i = 0; i < 60 && !(await c.db('admin').command({ hello: 1 })).isWritablePrimary; i++) await new Promise((r) => setTimeout(r, 300))
    await c.db('pharmacy_pos').collection('sales').insertOne({ totalCents: 1234 })
    await c.close()
    // New build stopping a leftover pre-Gate-1 server: its admin credentials fail, so it must fall
    // back to the anonymous shutdown (this used to be treated as success and leave the server up).
    await shutdownBundledMongo(e, createSecrets())
    await waitExit(old)

    // New build: same data directory, now with a keyFile.
    const s = createSecrets()
    const p = startMongod('legacy', e.port, writeKey(s, 'legacy'))
    await waitUp(e)
    expect(await secureBundledMongo(e, s, 'pharmacy_pos')).toBe('created')
    let total = 0
    expect(await outcome(appUri(e, s), async (client) => { total = (await client.db('pharmacy_pos').collection('sales').findOne({}))?.totalCents })).toBe('ok')
    expect(total).toBe(1234)
    expect(await outcome(directUri(e), (client) => client.db('pharmacy_pos').collection('sales').findOne({}))).toBe('Unauthorized')
    expect(await outcome(adminUri(e, s), (client) => client.db('admin').command({ connectionStatus: 1 }))).toBe('ok')

    await shutdownBundledMongo(e, s)
    await waitExit(p)
  })
})
