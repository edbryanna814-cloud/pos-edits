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
    await expect(auth.setupFirstAdmin({ username: 'owner', password: 'ab' })).rejects.toThrow('PASSWORD_TOO_SHORT')
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

    await expect(auth.changePassword({ currentPassword: 'Legacy-Pass-2024', newPassword: 'ab' })).rejects.toThrow('PASSWORD_TOO_SHORT')
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
    await expect(auth.changePassword({ currentPassword: 'admin', newPassword: 'ad' })).rejects.toThrow('PASSWORD_TOO_SHORT')
  })

  it('user create and admin reset enforce 12 characters; an admin reset forces a change', async () => {
    await expect(auth.createUser({ username: 'cashier1', password: 'ab', role: 'Seller' })).rejects.toThrow('PASSWORD_TOO_SHORT')
    const created = await auth.createUser({ username: 'cashier1', password: 'Cashier-Pass-01', role: 'Seller' }) // gitleaks:allow test-only credential
    expect(created).not.toHaveProperty('passwordHash')
    await expect(auth.updateUser(String(created._id), { password: 'ab' })).rejects.toThrow('PASSWORD_TOO_SHORT')
    await auth.updateUser(String(created._id), { password: 'Temp-Reset-Pass-1' })
    expect((await auth.login({ username: 'cashier1', password: 'Temp-Reset-Pass-1' })).mustChangePassword).toBe(true)
  })

  it('three roles: old roles and custom permissions migrate; a manager cannot see or touch administrators', async () => {
    const now = new Date().toISOString()
    await users().insertOne({ username: 'oldacct', passwordHash: sha256('x'), role: 'Accountant', permissions: ['database.manage'], active: true, createdAt: now, updatedAt: now })
    expect(await auth.migrateRoles()).toBeGreaterThan(0)
    const migrated = await users().findOne({ username: 'oldacct' })
    expect(migrated?.role).toBe('Seller')
    expect(migrated).not.toHaveProperty('permissions')

    await auth.login({ username: 'owner', password: 'Owner-Pass-2026' }) // gitleaks:allow test-only credential
    expect(auth.requirePermission('database.manage').username).toBe('owner')
    await auth.createUser({ username: 'mgr1', password: 'Manager-Pass-01', role: 'Manager', permissions: ['database.manage'] }) // gitleaks:allow test-only credential

    const mgr = await auth.login({ username: 'mgr1', password: 'Manager-Pass-01' }) // gitleaks:allow test-only credential
    expect(mgr.user.permissions).not.toContain('database.manage')
    expect(() => auth.requirePermission('database.manage')).toThrow('PERMISSION_DENIED')
    expect((await auth.listUsers()).map((u) => u.role)).not.toContain('Administrator')
    expect(auth.listRoles().map((r) => r.name)).toEqual(['Manager', 'Seller'])
    await expect(auth.createUser({ username: 'sneaky', password: 'Sneaky-Pass-001', role: 'Administrator' })).rejects.toThrow('PERMISSION_DENIED')
    const ownerId = String((await users().findOne({ username: 'owner' }))?._id)
    await expect(auth.updateUser(ownerId, { active: false })).rejects.toThrow('User not found')
    expect((await auth.listAudit(1000)).map((e) => e.actorUsername)).not.toContain('owner')

    await auth.createUser({ username: 'seller1', password: 'Seller-Pass-001', role: 'Seller' }) // gitleaks:allow test-only credential
    const seller = await auth.login({ username: 'seller1', password: 'Seller-Pass-001' }) // gitleaks:allow test-only credential
    expect(seller.user.permissions).toEqual(['pos.use', 'inventory.manage'])
  })

  it('recovery: lists administrator names and resets only an administrator (unlocked, active, audited)', async () => {
    expect(await auth.listAdminUsernames()).toEqual(['admin', 'owner'])
    await users().updateOne({ username: 'owner' }, { $set: { lockedUntil: new Date(Date.now() + 1e6).toISOString(), failedLoginCount: 5, active: false } })
    await expect(auth.recoverAdminPassword('owner', 'ab')).rejects.toThrow('PASSWORD_TOO_SHORT')
    await expect(auth.recoverAdminPassword('seller1', 'Recovered-Pass-01')).rejects.toThrow('User not found')
    await auth.recoverAdminPassword('owner', 'Recovered-Pass-01') // gitleaks:allow test-only credential
    const r = await auth.login({ username: 'owner', password: 'Recovered-Pass-01' }) // gitleaks:allow test-only credential
    expect(r.mustChangePassword).toBe(false)
    expect((await audit()).map((e) => e.action)).toContain('password.recovered')
  })

  it('user IDs: existing users numbered 1..n in creation order; automatic or typed by hand, never twice', async () => {
    await auth.migrateRoles()
    const numbered = await users().find({}).sort({ createdAt: 1 }).toArray()
    expect(numbered.every((u) => Number.isInteger(u.userNo))).toBe(true)
    expect(new Set(numbered.map((u) => u.userNo)).size).toBe(numbered.length)
    expect(numbered[0].userNo).toBe(1) // the first administrator (setup)
    const typed = await auth.createUser({ username: 'byhand', password: 'abc', role: 'Seller', userNo: 50 })
    expect(typed.userNo).toBe(50)
    expect((await auth.createUser({ username: 'next', password: 'abc', role: 'Seller' })).userNo).toBe(51)
    await expect(auth.createUser({ username: 'dup', password: 'abc', role: 'Seller', userNo: 50 })).rejects.toThrow('USER_NO_TAKEN')
    await expect(auth.createUser({ username: 'zero', password: 'abc', role: 'Seller', userNo: 0 })).rejects.toThrow('USER_NO_INVALID')
  })

  it('exports: Administrators only; user exports never carry password hashes', async () => {
    const { exportSection } = await import('../../src/main/exports')
    const { readSheet } = await import('../../src/main/sheet')
    const db = await exportSection('users', 'db')
    expect(String(db.data)).not.toMatch(/passwordHash|argon2/)
    const rows = readSheet(((await exportSection('users', 'xlsx')).data) as Uint8Array, 'u.xlsx')
    expect(rows[0]).toEqual(['User ID', 'Username', 'Role', 'Active', 'Created', 'Record ID'])
    expect(rows.length - 1).toBe(db.count)
    await expect(exportSection('secrets', 'xlsx')).rejects.toThrow('EXPORT_SECTION_INVALID')
    await auth.login({ username: 'mgr1', password: 'Manager-Pass-01' }) // gitleaks:allow test-only credential
    expect(() => auth.requirePermission('data.transfer')).toThrow('PERMISSION_DENIED')
  })
})

describe('audit chain in MongoDB (Gate 1 S5)', () => {
  it('every audit entry written above is chained and the chain verifies', async () => {
    const report = await auth.verifyAuditLog()
    expect(report.ok).toBe(true)
    expect(report.checked).toBeGreaterThan(10)
    expect(report.unchained).toBe(0)
  })

  it('concurrent writes do not fork the chain', async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => auth.logAudit({ action: `concurrent.${i}`, resource: 'test' })))
    expect((await auth.verifyAuditLog()).ok).toBe(true)
  })

  it('detects an edited, then a deleted, audit entry', async () => {
    const col = raw.db(DB_NAME).collection('audit')
    await col.updateOne({ seq: 3 }, { $set: { actorUsername: 'someone-else' } })
    expect(await auth.verifyAuditLog()).toMatchObject({ ok: false, brokenAtSeq: 3 })
    await col.deleteOne({ seq: 3 })
    expect(await auth.verifyAuditLog()).toMatchObject({ ok: false, brokenAtSeq: 3, reason: 'missing or duplicate entry' })
  })
})
