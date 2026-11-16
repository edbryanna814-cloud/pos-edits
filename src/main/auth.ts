import { randomBytes } from 'node:crypto'
import { appendFile } from 'node:fs/promises'
import { ObjectId, type Db } from 'mongodb'
import { getDb } from './db'
import { hashPassword, hashToken, newPasswordError, verifyPassword } from './password'
import { chainEntry, verifyChain, type ChainReport } from './auditChain'
import type { AuditEvent, LoginInput, LoginResult, Permission, Session, User } from '../shared/auth'
import { ADMIN_ROLE, BUILTIN_ROLES, DEFAULT_SESSION_TTL_MS, LEGACY_ROLES } from '../shared/auth'

const USERS_COL = 'users'
const SESSIONS_COL = 'sessions'
const AUDIT_COL = 'audit'

// Gate 1 auth rules: 5 consecutive failures lock the account for 15 minutes (stored on the user, survives restarts).
export const MAX_FAILED_LOGINS = 5
export const LOCKOUT_MS = 15 * 60 * 1000

/** Stable codes returned to the renderer; the renderer maps them to AR/EN text. */
export const AUTH_ERRORS = {
  loginFailed: 'LOGIN_FAILED',
  authRequired: 'AUTH_REQUIRED',
  permissionDenied: 'PERMISSION_DENIED',
  passwordChangeRequired: 'PASSWORD_CHANGE_REQUIRED',
  setupNotAllowed: 'SETUP_NOT_ALLOWED',
  usernameTaken: 'USERNAME_TAKEN',
  passwordReused: 'PASSWORD_REUSED'
} as const

let currentSession: Session | null = null
let auditFallbackFile: string | null = null

/** Where audit events go when MongoDB is unavailable (set by main to a file under userData). */
export function setAuditFallbackFile(path: string | null): void {
  auditFallbackFile = path
}

export function getCurrentSession(): Session | null {
  return currentSession
}

export function requireSession(): Session {
  if (!currentSession) throw new Error(AUTH_ERRORS.authRequired)
  if (currentSession.mustChangePassword) throw new Error(AUTH_ERRORS.passwordChangeRequired)
  return currentSession
}

export function requirePermission(...permissions: Permission[]): Session {
  const session = requireSession()
  if (permissions.length > 0 && !permissions.some((permission) => session.permissions.includes(permission))) {
    throw new Error(AUTH_ERRORS.permissionDenied)
  }
  return session
}

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

function getRolePermissions(role: string): Permission[] {
  const r = BUILTIN_ROLES.find((x) => x.name === (LEGACY_ROLES[role] ?? role))
  return r ? r.permissions : []
}

const isAdminViewer = () => currentSession?.role === ADMIN_ROLE

/** Earlier versions had Cashier / Inventory Manager / Accountant roles and per-user permissions. */
const COUNTERS = 'counters'

/** Next user ID: 1, 2, 3… (never reused). */
async function nextUserNo(db: Db): Promise<number> {
  const r = await db.collection<{ _id: string; seq: number }>(COUNTERS).findOneAndUpdate({ _id: 'userNo' }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' })
  return r!.seq
}

/** A user ID typed by hand: whole number 1…999999999; the counter moves past it. */
async function reserveUserNo(db: Db, value: unknown): Promise<number> {
  const n = Number(value)
  if (!(Number.isInteger(n) && n >= 1 && n <= 999_999_999)) throw new Error('USER_NO_INVALID')
  await db.collection<{ _id: string; seq: number }>(COUNTERS).updateOne({ _id: 'userNo' }, { $max: { seq: n } }, { upsert: true })
  return n
}

const userNoTaken = (error: unknown) => (error as { code?: number; keyPattern?: Record<string, unknown> })?.code === 11000 && 'userNo' in ((error as any).keyPattern ?? {})

export async function migrateRoles(): Promise<number> {
  const db = requireDb()
  let changed = 0
  // User IDs (0.3.0): unique, and given to existing users in the order they were created.
  await db.collection(USERS_COL).createIndex({ userNo: 1 }, { unique: true, partialFilterExpression: { userNo: { $exists: true } } })
  const top = await db.collection<User>(USERS_COL).find({ userNo: { $exists: true } }).sort({ userNo: -1 }).limit(1).next()
  if (top?.userNo) await reserveUserNo(db, top.userNo)
  for (const u of await db.collection<User>(USERS_COL).find({ userNo: { $exists: false } }).sort({ createdAt: 1 }).toArray()) {
    changed += (await db.collection(USERS_COL).updateOne({ _id: (u as any)._id, userNo: { $exists: false } }, { $set: { userNo: await nextUserNo(db) } })).modifiedCount
  }
  for (const [from, to] of Object.entries(LEGACY_ROLES)) {
    changed += (await db.collection(USERS_COL).updateMany({ role: from }, { $set: { role: to } })).modifiedCount
  }
  changed += (await db.collection(USERS_COL).updateMany({ permissions: { $exists: true } }, { $unset: { permissions: '' } })).modifiedCount
  if (changed) await logAudit({ actorUsername: 'system:migration', action: 'users.roles_migrated', resource: 'users', details: { changed } })
  return changed
}

export async function ensureAuthSchema(): Promise<void> {
  const db = requireDb()
  const collections = await db.listCollections({ name: { $in: [USERS_COL, SESSIONS_COL, AUDIT_COL] } }).toArray()
  const names = new Set(collections.map((c) => c.name))
  if (!names.has(USERS_COL)) {
    await db.createCollection(USERS_COL)
    await db.collection(USERS_COL).createIndex({ username: 1 }, { unique: true })
  }
  if (!names.has(SESSIONS_COL)) {
    await db.createCollection(SESSIONS_COL)
    await db.collection(SESSIONS_COL).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  }
  if (!names.has(AUDIT_COL)) {
    await db.createCollection(AUDIT_COL)
    await db.collection(AUDIT_COL).createIndex({ createdAt: -1 })
  }
  // Sessions are stored by token hash only. Drop pre-Gate-1 plaintext sessions and their index.
  const sessions = db.collection(SESSIONS_COL)
  await sessions.deleteMany({ token: { $exists: true } })
  if ((await sessions.indexes()).some((index) => index.name === 'token_1')) await sessions.dropIndex('token_1')
  await sessions.createIndex({ tokenHash: 1 }, { unique: true })
  // One entry per chain position: stops two writers forking the audit chain.
  await db.collection(AUDIT_COL).createIndex({ seq: 1 }, { unique: true, partialFilterExpression: { seq: { $exists: true } } })
}

// Audit writes are serialised so each entry links to the previous one (see auditChain.ts).
let auditQueue: Promise<unknown> = Promise.resolve()

async function appendChained(db: Db, record: AuditEvent): Promise<void> {
  const audit = db.collection<AuditEvent & { seq?: number; hash?: string }>(AUDIT_COL)
  // Several PCs on one shared database can race for the same seq: retry with a short random wait.
  const ATTEMPTS = 8
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 5 + Math.floor(Math.random() * 40) * attempt))
    // Read the tail on every write (indexed): stays correct after a backup import replaces the log.
    const last = await audit.find({ seq: { $exists: true } }).sort({ seq: -1 }).limit(1).next()
    const entry = chainEntry({ ...record } as Record<string, unknown>, last ? { seq: last.seq as number, hash: last.hash as string } : null)
    try {
      await audit.insertOne(entry as any)
      return
    } catch (error) {
      // Another writer took this seq (unique index): re-read the tail and retry.
      if ((error as { code?: number })?.code !== 11000 || attempt === ATTEMPTS - 1) throw error
    }
  }
}

/** Verifies the whole audit hash chain (Gate 1 S5). */
export async function verifyAuditLog(): Promise<ChainReport> {
  const db = requireDb()
  // shortcut: loads every entry; fine for a single pharmacy, paginate if the log reaches millions of rows.
  return verifyChain(await db.collection(AUDIT_COL).find({}).toArray())
}

/** Writes to the audit collection; if MongoDB is unavailable, appends a JSON line to the fallback file. */
export async function logAudit(event: Omit<AuditEvent, 'createdAt'> & { createdAt?: string }): Promise<void> {
  const record = { ...event, createdAt: event.createdAt ?? new Date().toISOString() } as AuditEvent
  if (record.details === undefined) delete record.details
  const db = getDb()
  if (db) {
    const write = auditQueue.then(() => appendChained(db, record))
    auditQueue = write.catch(() => undefined)
    await write
    return
  }
  if (!auditFallbackFile) {
    console.error('[audit] database unavailable and no fallback file', record.action)
    return
  }
  await appendFile(auditFallbackFile, JSON.stringify({ ...record, fallback: true }) + '\n', 'utf8')
}

function auditLogin(username: string, outcome: 'success' | 'failure', reason?: string): Promise<void> {
  return logAudit({
    actorUsername: username.slice(0, 64),
    action: outcome === 'success' ? 'login.success' : 'login.failure',
    resource: 'auth',
    details: reason ? { reason } : undefined
  })
}

function normalizeUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function startSession(db: Db, user: User & { _id?: unknown }, mustChangePassword: boolean): Promise<LoginResult> {
  // The role decides; per-user permissions from older versions are ignored so nobody can escalate.
  const permissions = getRolePermissions(user.role)
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  const session: Session = {
    tokenHash: hashToken(token),
    userId: String(user._id ?? ''),
    username: user.username,
    role: user.role,
    permissions,
    mustChangePassword,
    expiresAt: new Date(now + DEFAULT_SESSION_TTL_MS).toISOString(),
    createdAt: new Date(now).toISOString()
  }
  await db.collection<Session>(SESSIONS_COL).insertOne({ ...session })
  currentSession = session
  return { token, user: { username: user.username, role: user.role, permissions }, expiresAt: session.expiresAt, mustChangePassword }
}

/** True only when the database is reachable and has no users (first run). */
export async function isSetupRequired(): Promise<boolean> {
  const db = getDb()
  if (!db) return false
  return (await db.collection(USERS_COL).countDocuments({}, { limit: 1 })) === 0
}

/** First-run setup: creates the first Administrator with a chosen password. Refused once any user exists. */
export async function setupFirstAdmin(input: LoginInput): Promise<LoginResult> {
  const db = requireDb()
  const username = normalizeUsername(input?.username)
  if (!username) throw new Error(AUTH_ERRORS.loginFailed)
  const passwordError = newPasswordError(input?.password)
  if (passwordError) throw new Error(passwordError)
  if (!(await isSetupRequired())) {
    await logAudit({ actorUsername: username.slice(0, 64), action: 'setup.refused', resource: 'auth' })
    throw new Error(AUTH_ERRORS.setupNotAllowed)
  }
  const now = new Date().toISOString()
  const user: User = {
    userNo: await nextUserNo(db),
    username,
    passwordHash: await hashPassword(input.password),
    role: 'Administrator',
    active: true,
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection<User>(USERS_COL).insertOne({ ...user })
  await logAudit({ actorUsername: username, action: 'setup.admin_created', resource: 'users', resourceId: result.insertedId.toString() })
  return startSession(db, { ...user, _id: result.insertedId }, false)
}

/**
 * Fails closed: any error (including an unavailable database) ends in LOGIN_FAILED with no session.
 * Every attempt is audited. A legacy SHA-256 hash is re-hashed with Argon2id on success and forces a reset.
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  const username = normalizeUsername(input?.username)
  const password = typeof input?.password === 'string' ? input.password : ''
  currentSession = null
  const db = getDb()
  if (!db) {
    await auditLogin(username, 'failure', 'db_unavailable').catch(() => undefined)
    throw new Error(AUTH_ERRORS.loginFailed)
  }
  try {
    const users = db.collection<User>(USERS_COL)
    const user = username ? await users.findOne({ username }) : null
    if (!user || !user.active) {
      await auditLogin(username, 'failure', user ? 'inactive' : 'unknown_user')
      throw new Error(AUTH_ERRORS.loginFailed)
    }
    const now = Date.now()
    if (user.lockedUntil && Date.parse(user.lockedUntil) > now) {
      await auditLogin(username, 'failure', 'locked')
      throw new Error(AUTH_ERRORS.loginFailed)
    }
    const { ok, legacy } = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      const failed = (user.failedLoginCount ?? 0) + 1
      const locked = failed >= MAX_FAILED_LOGINS
      await users.updateOne(
        { _id: user._id } as any,
        { $set: locked ? { failedLoginCount: 0, lockedUntil: new Date(now + LOCKOUT_MS).toISOString() } : { failedLoginCount: failed } }
      )
      await auditLogin(username, 'failure', locked ? 'bad_password_locked' : 'bad_password')
      throw new Error(AUTH_ERRORS.loginFailed)
    }
    const mustChangePassword = legacy || user.mustChangePassword === true
    const set: Partial<User> = { failedLoginCount: 0, mustChangePassword, updatedAt: new Date(now).toISOString() }
    if (legacy) set.passwordHash = await hashPassword(password)
    await users.updateOne({ _id: user._id } as any, { $set: set, $unset: { lockedUntil: '' } })
    if (legacy) await logAudit({ actorUsername: username, action: 'password.legacy_rehashed', resource: 'users', resourceId: String(user._id) })
    const result = await startSession(db, user, mustChangePassword)
    await auditLogin(username, 'success', mustChangePassword ? 'password_change_required' : undefined)
    return result
  } catch (error) {
    currentSession = null
    if (error instanceof Error && error.message === AUTH_ERRORS.loginFailed) throw error
    console.error('[auth] login error', error instanceof Error ? error.message : error)
    await auditLogin(username, 'failure', 'error').catch(() => undefined)
    throw new Error(AUTH_ERRORS.loginFailed)
  }
}

/** Allowed for a session flagged mustChangePassword; that is the only call such a session may make. */
export async function changePassword(input: { currentPassword?: unknown; newPassword?: unknown }): Promise<{ success: true }> {
  const session = currentSession
  if (!session) throw new Error(AUTH_ERRORS.authRequired)
  const db = requireDb()
  const passwordError = newPasswordError(input?.newPassword)
  if (passwordError) throw new Error(passwordError)
  const newPassword = input.newPassword as string
  const user = await db.collection<User>(USERS_COL).findOne({ _id: new ObjectId(session.userId) } as any)
  const current = typeof input?.currentPassword === 'string' ? input.currentPassword : ''
  if (!user || !(await verifyPassword(current, user.passwordHash)).ok) {
    await logAudit({ actorUsername: session.username, action: 'password.change_failed', resource: 'users', resourceId: session.userId })
    throw new Error(AUTH_ERRORS.loginFailed)
  }
  if (current === newPassword) throw new Error(AUTH_ERRORS.passwordReused)
  await db.collection<User>(USERS_COL).updateOne(
    { _id: user._id } as any,
    { $set: { passwordHash: await hashPassword(newPassword), mustChangePassword: false, updatedAt: new Date().toISOString() } }
  )
  await db.collection<Session>(SESSIONS_COL).updateMany({ userId: session.userId }, { $set: { mustChangePassword: false } })
  currentSession = { ...session, mustChangePassword: false }
  await logAudit({ actorUsername: session.username, action: 'password.changed', resource: 'users', resourceId: session.userId })
  return { success: true }
}

export async function logout(token: string): Promise<void> {
  const tokenHash = hashToken(String(token ?? ''))
  if (currentSession?.tokenHash === tokenHash) currentSession = null
  const db = getDb()
  if (!db) return
  const session = await db.collection<Session>(SESSIONS_COL).findOneAndDelete({ tokenHash })
  if (session) await logAudit({ actorUsername: session.username, action: 'logout', resource: 'auth' })
}

export async function validateSession(token?: string): Promise<Session | null> {
  if (!token || typeof token !== 'string') return null
  const db = requireDb()
  const tokenHash = hashToken(token)
  const session = await db.collection<Session>(SESSIONS_COL).findOne({ tokenHash })
  if (!session) return null
  if (new Date(session.expiresAt) < new Date()) {
    await db.collection<Session>(SESSIONS_COL).deleteOne({ tokenHash })
    return null
  }
  return session
}

export async function getAuthState(token?: string) {
  try {
    const session = await validateSession(token)
    // A session that still owes a password change is not resumed; the user signs in again and changes it.
    if (!session || session.mustChangePassword) return { authenticated: false }
    currentSession = session
    return {
      authenticated: true,
      user: { username: session.username, role: session.role, permissions: session.permissions }
    }
  } catch {
    return { authenticated: false }
  }
}

function withStringId<T>(doc: T): T {
  return { ...doc, _id: String((doc as { _id?: unknown })._id) }
}

function requireText(value: unknown, field: string): string {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${field} is required`)
  return text
}

function validateRole(role: unknown): string {
  const name = String(role ?? '').trim()
  if (!BUILTIN_ROLES.some((item) => item.name === name)) throw new Error('Invalid role')
  return name
}

const USER_PROJECTION = { passwordHash: 0, failedLoginCount: 0, lockedUntil: 0 }

/** Managers never see Administrator accounts. */
export async function listUsers(): Promise<User[]> {
  const db = requireDb()
  const filter = isAdminViewer() ? {} : { role: { $ne: ADMIN_ROLE } }
  const users = await db.collection<User>(USERS_COL).find(filter, { projection: USER_PROJECTION }).toArray()
  return users.map(withStringId)
}

export async function createUser(input: any): Promise<User> {
  const db = requireDb()
  const now = new Date().toISOString()
  const username = requireText(input?.username, 'Username')
  const passwordError = newPasswordError(input?.password)
  if (passwordError) throw new Error(passwordError)
  if (!isAdminViewer() && input?.role === ADMIN_ROLE) throw new Error(AUTH_ERRORS.permissionDenied)
  const manualNo = input?.userNo !== undefined && input?.userNo !== null && input?.userNo !== ''
  const user: any = {
    userNo: manualNo ? await reserveUserNo(db, input.userNo) : await nextUserNo(db),
    username,
    passwordHash: await hashPassword(input.password),
    role: validateRole(input?.role || 'Seller'),
    active: input?.active !== false,
    createdAt: now,
    updatedAt: now
  }
  let insertedId: string
  try {
    const result = await db.collection(USERS_COL).insertOne(user)
    insertedId = result.insertedId.toString()
  } catch (error) {
    if (userNoTaken(error)) throw new Error('USER_NO_TAKEN')
    if ((error as { code?: number })?.code === 11000) throw new Error(AUTH_ERRORS.usernameTaken)
    throw error
  }
  const { passwordHash, ...rest } = user
  await logAudit({ actorUsername: currentSession?.username, action: 'user.create', resource: 'users', resourceId: insertedId })
  return { _id: insertedId, ...rest } as User
}

export async function updateUser(id: string, input: any): Promise<User> {
  const db = requireDb()
  if (!ObjectId.isValid(id)) throw new Error('Invalid user')
  if (!isAdminViewer()) {
    // A manager cannot touch, or even confirm the existence of, an Administrator account.
    const target = await db.collection<User>(USERS_COL).findOne({ _id: new ObjectId(id) } as any, { projection: { role: 1 } })
    if (!target || target.role === ADMIN_ROLE) throw new Error('User not found')
    if (input?.role === ADMIN_ROLE) throw new Error(AUTH_ERRORS.permissionDenied)
  }
  const update: any = { updatedAt: new Date().toISOString() }
  if (input?.role !== undefined) update.role = validateRole(input.role)
  if (typeof input?.active === 'boolean') update.active = input.active
  if (input?.password) {
    const passwordError = newPasswordError(input.password)
    if (passwordError) throw new Error(passwordError)
    update.passwordHash = await hashPassword(input.password)
    // An administrator-set password is temporary: the user must choose their own at next sign-in.
    update.mustChangePassword = true
  }
  if (Object.keys(update).length === 1) throw new Error('No user changes supplied')
  const result = await db.collection<User>(USERS_COL).findOneAndUpdate(
    { _id: new ObjectId(id) } as any,
    { $set: update },
    { returnDocument: 'after', projection: USER_PROJECTION } as any
  )
  if (!result) throw new Error('User not found')
  await logAudit({ actorUsername: currentSession?.username, action: 'user.update', resource: 'users', resourceId: id, details: input?.password ? { passwordReset: true } : undefined })
  return withStringId(result as unknown as User)
}

export async function listAudit(limit = 100): Promise<AuditEvent[]> {
  const db = requireDb()
  const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(1000, limit)) : 100
  // Managers do not see entries made by Administrator accounts.
  let filter = {}
  if (!isAdminViewer()) {
    const admins = await db.collection<User>(USERS_COL).find({ role: ADMIN_ROLE }, { projection: { username: 1 } }).toArray()
    filter = { actorUsername: { $nin: admins.map((a) => a.username) } }
  }
  return (await db.collection<AuditEvent>(AUDIT_COL).find(filter).sort({ createdAt: -1 }).limit(safeLimit).toArray()).map(withStringId)
}

export function listRoles() {
  return isAdminViewer() ? BUILTIN_ROLES : BUILTIN_ROLES.filter((r) => r.name !== ADMIN_ROLE)
}

/** Forgotten-password recovery (after a panel-signed reset code): the administrator accounts by name. */
export async function listAdminUsernames(): Promise<string[]> {
  const db = requireDb()
  return (await db.collection<User>(USERS_COL).find({ role: ADMIN_ROLE }, { projection: { username: 1 } }).sort({ username: 1 }).toArray()).map((u) => u.username)
}

/** Sets a new password for an administrator account and reopens it (unlocked, active). Caller checks the reset code. */
export async function recoverAdminPassword(username: unknown, newPassword: unknown): Promise<void> {
  const db = requireDb()
  const passwordError = newPasswordError(newPassword)
  if (passwordError) throw new Error(passwordError)
  const result = await db.collection<User>(USERS_COL).updateOne(
    { username: String(username ?? ''), role: ADMIN_ROLE },
    {
      $set: { passwordHash: await hashPassword(String(newPassword)), active: true, mustChangePassword: false, updatedAt: new Date().toISOString() },
      $unset: { failedLoginCount: '', lockedUntil: '' }
    }
  )
  if (result.matchedCount !== 1) throw new Error('User not found')
  await logAudit({ actorUsername: 'system:recovery', action: 'password.recovered', resource: 'users', details: { username: String(username) } })
}
