import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MongoClient } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Integration tests against a real MongoDB (CI: service container; local: the dev service).
const URI = process.env['MONGODB_TEST_URI'] ?? 'mongodb://127.0.0.1:27017/?directConnection=true'
const DB_NAME = `pharmacy_pos_authtest_${process.pid}_${Date.now()}`
process.env['MONGODB_URI'] = URI
process.env['MONGODB_DB'] = DB_NAME

const dir = mkdtempSync(join(tmpdir(), 'auth-test-'))
const fallbackFile = join(dir, 'audit-fallback.jsonl')
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

let auth: typeof import('../../src/main/auth')
let db: typeof import('../../src/main/db')
let raw: MongoClient

beforeAll(async () => {
  db = await import('../../src/main/db')
  auth = await import('../../src/main/auth')
  auth.setAuditFallbackFile(fallbackFile)
  raw = new MongoClient(URI)
  await raw.connect()
})

afterAll(async () => {
  await raw.db(DB_NAME).dropDatabase()
  await raw.close()
  await db.closeDb()
  rmSync(dir, { recursive: true, force: true })
})

const audit = () => raw.db(DB_NAME).collection('audit').find({}).toArray()
const users = () => raw.db(DB_NAME).collection('users')

describe('database unavailable', () => {
  it('fails closed: no session, generic error, attempt audited to the fallback file', async () => {
    expect(db.getDb()).toBeNull()
    await expect(auth.login({ username: 'admin', password: 'admin' })).rejects.toThrow('LOGIN_FAILED')
    expect(auth.getCurrentSession()).toBeNull()
    expect(() => auth.requireSession()).toThrow('AUTH_REQUIRED')
    const lines = readFileSync(fallbackFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    expect(lines).toContainEqual(expect.objectContaining({ action: 'login.failure', actorUsername: 'admin', details: { reason: 'db_unavailable' }, fallback: true }))
    expect(await auth.isSetupRequired()).toBe(false)
  })
})

describe('with MongoDB', () => {
  beforeAll(async () => {
    // A pre-Gate-1 sessions collection: plaintext token + unique token index.
    const sessions = await raw.db(DB_NAME).createCollection('sessions')
    await sessions.createIndex({ token: 1 }, { unique: true })
    await sessions.insertOne({ token: 'legacy-plaintext-token', username: 'old', expiresAt: new Date(Date.now() + 1e6).toISOString() })
    expect(await db.connectDb()).not.toBeNull()
    await auth.ensureAuthSchema()
  })

  it('removes plaintext sessions and the token index on startup', async () => {
    const sessions = raw.db(DB_NAME).collection('sessions')
    expect(await sessions.countDocuments({ token: { $exists: true } })).toBe(0)
    const names = (await sessions.indexes()).map((i) => i.name)
    expect(names).not.toContain('token_1')
    expect(names).toContain('tokenHash_1')
  })

  it('first run: no default account, setup required, weak password refused', async () => {
    expect(await users().countDocuments()).toBe(0)
    expect(await auth.isSetupRequired()).toBe(true)
    await expect(auth.login({ username: 'admin', password: 'admin' })).rejects.toThrow('LOGIN_FAILED')
    await expect(auth.setupFirstAdmin({ username: 'owner', password: 'short' })).rejects.toThrow('PASSWORD_TOO_SHORT')
    expect(await users().countDocuments()).toBe(0)
  })

  it('setup creates one Administrator with an Argon2id hash, then refuses a second setup', async () => {
    const result = await auth.setupFirstAdmin({ username: 'owner', password: 'Owner-Pass-2026' }) // gitleaks:allow test-only credential
    expect(result.mustChangePassword).toBe(false)
    expect(result.user.role).toBe('Administrator')
    const owner = await users().findOne({ username: 'owner' })
    expect(owner?.passwordHash).toMatch(/^\$argon2id\$/)
    expect(await auth.isSetupRequired()).toBe(false)
    await expect(auth.setupFirstAdmin({ username: 'intruder', password: 'Intruder-Pass-2026' })).rejects.toThrow('SETUP_NOT_ALLOWED') // gitleaks:allow test-only credential
    const actions = (await audit()).map((e) => e.action)
    expect(actions).toEqual(expect.arrayContaining(['setup.admin_created', 'setup.refused']))
  })

  it('stores only the session token hash at rest', async () => {
    const { token } = await auth.login({ username: 'owner', password: 'Owner-Pass-2026' }) // gitleaks:allow test-only credential
    const stored = await raw.db(DB_NAME).collection('sessions').findOne({ tokenHash: sha256(token) })
    expect(stored).not.toBeNull()
    expect(stored).not.toHaveProperty('token')
    expect(JSON.stringify(await raw.db(DB_NAME).collection('sessions').find({}).toArray())).not.toContain(token)
    expect((await auth.validateSession(token))?.username).toBe('owner')
    expect(await auth.validateSession('not-a-real-token')).toBeNull()
    await auth.logout(token)
    expect(await auth.validateSession(token)).toBeNull()
  })

  it('audits both success and failure', async () => {
    await auth.login({ username: 'owner', password: 'Owner-Pass-2026' }) // gitleaks:allow test-only credential
    await expect(auth.login({ username: 'owner', password: 'wrong-password-1' })).rejects.toThrow('LOGIN_FAILED')
    await expect(auth.login({ username: 'ghost', password: 'whatever-password' })).rejects.toThrow('LOGIN_FAILED')
    const events = await audit()
    expect(events).toContainEqual(expect.objectContaining({ action: 'login.success', actorUsername: 'owner' }))
    expect(events).toContainEqual(expect.objectContaining({ action: 'login.failure', actorUsername: 'owner', details: { reason: 'bad_password' } }))
    expect(events).toContainEqual(expect.objectContaining({ action: 'login.failure', actorUsername: 'ghost', details: { reason: 'unknown_user' } }))
  })

  it('locks the account after 5 consecutive failures, even for the right password', async () => {
    await users().updateOne({ username: 'owner' }, { $set: { failedLoginCount: 0 } })
    for (let i = 0; i < auth.MAX_FAILED_LOGINS; i++) {
      await expect(auth.login({ username: 'owner', password: `wrong-password-${i}` })).rejects.toThrow('LOGIN_FAILED')
    }
    expect((await users().findOne({ username: 'owner' }))?.lockedUntil).toBeTruthy()
    await expect(auth.login({ username: 'owner', password: 'Owner-Pass-2026' })).rejects.toThrow('LOGIN_FAILED') // gitleaks:allow test-only credential
    expect(await audit()).toContainEqual(expect.objectContaining({ action: 'login.failure', details: { reason: 'locked' } }))
    // Lock expires: the right password works again and clears the lock.
    await users().updateOne({ username: 'owner' }, { $set: { lockedUntil: new Date(Date.now() - 1000).toISOString() } })
    await auth.login({ username: 'owner', password: 'Owner-Pass-2026' }) // gitleaks:allow test-only credential
    expect((await users().findOne({ username: 'owner' }))?.lockedUntil).toBeUndefined()
  })

  it('migrates a legacy SHA-256 hash on login and forces a reset before anything else', async () => {
    const now = new Date().toISOString()
    await users().insertOne({ username: 'legacy', passwordHash: sha256('Legacy-Pass-2024'), role: 'Cashier', active: true, createdAt: now, updatedAt: now })
    const result = await auth.login({ username: 'legacy', password: 'Legacy-Pass-2024' })
    expect(result.mustChangePassword).toBe(true)
    expect((await users().findOne({ username: 'legacy' }))?.passwordHash).toMatch(/^\$argon2id\$/)
    expect(() => auth.requireSession()).toThrow('PASSWORD_CHANGE_REQUIRED')
    expect(() => auth.requirePermission('pos.use')).toThrow('PASSWORD_CHANGE_REQUIRED')
    expect(await auth.getAuthState(result.token)).toEqual({ authenticated: false })

    await expect(auth.changePassword({ currentPassword: 'Legacy-Pass-2024', newPassword: 'short' })).rejects.toThrow('PASSWORD_TOO_SHORT')
    await expect(auth.changePassword({ currentPassword: 'wrong-current-pw', newPassword: 'Brand-New-Pass-1' })).rejects.toThrow('LOGIN_FAILED')
    await expect(auth.changePassword({ currentPassword: 'Legacy-Pass-2024', newPassword: 'Legacy-Pass-2024' })).rejects.toThrow('PASSWORD_REUSED')
    await auth.changePassword({ currentPassword: 'Legacy-Pass-2024', newPassword: 'Brand-New-Pass-1' })
    expect(auth.requireSession().username).toBe('legacy')

    const again = await auth.login({ username: 'legacy', password: 'Brand-New-Pass-1' })
    expect(again.mustChangePassword).toBe(false)
    await expect(auth.login({ username: 'legacy', password: 'Legacy-Pass-2024' })).rejects.toThrow('LOGIN_FAILED')
    const actions = (await audit()).filter((e) => e.actorUsername === 'legacy').map((e) => e.action)
    expect(actions).toEqual(expect.arrayContaining(['password.legacy_rehashed', 'password.changed', 'password.change_failed']))
  })

  it('an existing admin/admin account is forced to reset on its next login', async () => {
    const now = new Date().toISOString()
    await users().insertOne({ username: 'admin', passwordHash: sha256('admin'), role: 'Administrator', active: true, createdAt: now, updatedAt: now })
    const result = await auth.login({ username: 'admin', password: 'admin' })
    expect(result.mustChangePassword).toBe(true)
    expect(() => auth.requirePermission('users.manage')).toThrow('PASSWORD_CHANGE_REQUIRED')
    await expect(auth.changePassword({ currentPassword: 'admin', newPassword: 'admin' })).rejects.toThrow('PASSWORD_TOO_SHORT')
  })

  it('user create and admin reset enforce 12 characters; an admin reset forces a change', async () => {
    await expect(auth.createUser({ username: 'cashier1', password: 'abcd', role: 'Cashier' })).rejects.toThrow('PASSWORD_TOO_SHORT')
    const created = await auth.createUser({ username: 'cashier1', password: 'Cashier-Pass-01', role: 'Cashier' })
    expect(created).not.toHaveProperty('passwordHash')
    await expect(auth.updateUser(String(created._id), { password: 'short' })).rejects.toThrow('PASSWORD_TOO_SHORT')
    await auth.updateUser(String(created._id), { password: 'Temp-Reset-Pass-1' })
    expect((await auth.login({ username: 'cashier1', password: 'Temp-Reset-Pass-1' })).mustChangePassword).toBe(true)
  })
})
