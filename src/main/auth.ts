import { randomBytes } from 'node:crypto'
import { appendFile } from 'node:fs/promises'
import { ObjectId, type Db } from 'mongodb'
import { getDb } from './db'
import { hashPassword, hashToken, newPasswordError, verifyPassword } from './password'
import type { AuditEvent, LoginInput, LoginResult, Permission, Session, User } from '../shared/auth'
import { BUILTIN_ROLES, DEFAULT_SESSION_TTL_MS } from '../shared/auth'

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
  const r = BUILTIN_ROLES.find((x) => x.name === role)
  return r ? r.permissions : []
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
}

/** Writes to the audit collection; if MongoDB is unavailable, appends a JSON line to the fallback file. */
export async function logAudit(event: Omit<AuditEvent, 'createdAt'> & { createdAt?: string }): Promise<void> {
  const record = { ...event, createdAt: event.createdAt ?? new Date().toISOString() } as AuditEvent
  const db = getDb()
  if (db) {
    await db.collection<AuditEvent>(AUDIT_COL).insertOne(record)
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
  const permissions = user.permissions?.length ? user.permissions : getRolePermissions(user.role)
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

export async function listUsers(): Promise<User[]> {
  const db = requireDb()
  const users = await db.collection<User>(USERS_COL).find({}, { projection: USER_PROJECTION }).toArray()
  return users.map(withStringId)
}

export async function createUser(input: any): Promise<User> {
  const db = requireDb()
  const now = new Date().toISOString()
  const username = requireText(input?.username, 'Username')
  const passwordError = newPasswordError(input?.password)
  if (passwordError) throw new Error(passwordError)
  const user: any = {
    username,
    passwordHash: await hashPassword(input.password),
    role: validateRole(input?.role || 'Cashier'),
    permissions: Array.isArray(input?.permissions) ? input.permissions : undefined,
    active: input?.active !== false,
    createdAt: now,
    updatedAt: now
  }
  let insertedId: string
  try {
    const result = await db.collection(USERS_COL).insertOne(user)
    insertedId = result.insertedId.toString()
  } catch (error) {
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
  const update: any = { updatedAt: new Date().toISOString() }
  if (input?.role !== undefined) update.role = validateRole(input.role)
  if (typeof input?.active === 'boolean') update.active = input.active
  if (input?.permissions !== undefined) update.permissions = Array.isArray(input.permissions) ? input.permissions : undefined
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
  return (await db.collection<AuditEvent>(AUDIT_COL).find({}).sort({ createdAt: -1 }).limit(safeLimit).toArray()).map(withStringId)
}

export function listRoles() {
  return BUILTIN_ROLES
}
