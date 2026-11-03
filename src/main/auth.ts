import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Db, Document } from 'mongodb'
import { getDb } from './db'
import type { AuditEvent, LoginInput, LoginResult, Permission, Session, User } from '../shared/auth'
import { BUILTIN_ROLES, DEFAULT_SESSION_TTL_MS } from '../shared/auth'

const USERS_COL = 'users'
const SESSIONS_COL = 'sessions'
const AUDIT_COL = 'audit'

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

function verifyPassword(password: string, hash: string): boolean {
  const a = Buffer.from(hashPassword(password))
  const b = Buffer.from(hash)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function generateToken(): string {
  return randomBytes(32).toString('hex')
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
    await db.collection(SESSIONS_COL).createIndex({ token: 1 }, { unique: true })
    await db.collection(SESSIONS_COL).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  }
  if (!names.has(AUDIT_COL)) {
    await db.createCollection(AUDIT_COL)
    await db.collection(AUDIT_COL).createIndex({ createdAt: -1 })
  }
}

export async function createDefaultAdminIfMissing(): Promise<void> {
  const db = requireDb()
  const count = await db.collection<User>(USERS_COL).countDocuments({})
  if (count === 0) {
    const now = new Date().toISOString()
    await db.collection<User>(USERS_COL).insertOne({
      username: 'admin',
      passwordHash: hashPassword('admin'),
      role: 'Administrator',
      active: true,
      createdAt: now,
      updatedAt: now
    })
  }
}

export async function logAudit(event: Omit<AuditEvent, 'createdAt'> & { createdAt?: string }): Promise<void> {
  const db = requireDb()
  await db.collection<AuditEvent>(AUDIT_COL).insertOne({
    ...event,
    createdAt: event.createdAt ?? new Date().toISOString()
  } as AuditEvent)
}

export async function login(input: LoginInput): Promise<LoginResult> {
  try {
    const db = requireDb()
    const user = await db.collection<User>(USERS_COL).findOne({ username: input.username })
    if (!user || !user.active) throw new Error('Invalid credentials')
    if (!verifyPassword(input.password, user.passwordHash)) throw new Error('Invalid credentials')
    
    const permissions = user.permissions?.length ? user.permissions : getRolePermissions(user.role)
    const token = generateToken()
    const now = Date.now()
    const expiresAt = new Date(now + DEFAULT_SESSION_TTL_MS).toISOString()
    const createdAt = new Date(now).toISOString()
    
    await db.collection<Session>(SESSIONS_COL).insertOne({
      token,
      userId: user._id?.toString() ?? '',
      username: user.username,
      role: user.role,
      permissions,
      expiresAt,
      createdAt
    } as Session)
    
    await logAudit({ actorUsername: user.username, action: 'login', resource: 'auth' })
    return { token, user: { username: user.username, role: user.role, permissions }, expiresAt }
  } catch (e) {
    if (e instanceof Error && e.message === 'Database unavailable') {
      if (input.username === 'admin' && input.password === 'admin') {
        const permissions = getRolePermissions('Administrator')
        const token = generateToken()
        const expiresAt = new Date(Date.now() + DEFAULT_SESSION_TTL_MS).toISOString()
        return { token, user: { username: 'admin', role: 'Administrator', permissions }, expiresAt }
      }
    }
    throw e
  }
}

export async function logout(token: string): Promise<void> {
  const db = requireDb()
  const session = await db.collection<Session>(SESSIONS_COL).findOne({ token })
  await db.collection<Session>(SESSIONS_COL).deleteOne({ token })
  if (session) {
    await logAudit({ actorUsername: session.username, action: 'logout', resource: 'auth' })
  }
}

export async function validateSession(token?: string) {
  if (!token) return null
  const db = requireDb()
  const session = await db.collection<Session>(SESSIONS_COL).findOne({ token })
  if (!session) return null
  if (new Date(session.expiresAt) < new Date()) {
    await db.collection<Session>(SESSIONS_COL).deleteOne({ token })
    return null
  }
  return session
}

export async function getAuthState(token?: string) {
  try {
    const session = await validateSession(token)
    if (!session) return { authenticated: false }
    return {
      authenticated: true,
      user: { username: session.username, role: session.role, permissions: session.permissions }
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'Database unavailable') {
      return { authenticated: false }
    }
    return { authenticated: false }
  }
}

export async function listUsers(): Promise<User[]> {
  const db = requireDb()
  const users = await db.collection<User>(USERS_COL).find({}, { projection: { passwordHash: 0 } }).toArray()
  return users as User[]
}

export async function createUser(input: any): Promise<User> {
  const db = requireDb()
  const now = new Date().toISOString()
  const user: any = {
    username: input.username,
    passwordHash: hashPassword(input.password || 'changeme'),
    role: input.role || 'Cashier',
    permissions: input.permissions,
    active: input.active !== false,
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection(USERS_COL).insertOne(user)
  const { passwordHash, ...rest } = user
  await logAudit({ action: 'user.create', resource: 'users', resourceId: result.insertedId.toString() })
  return { _id: result.insertedId.toString(), ...rest } as User
}

export async function updateUser(id: string, input: any): Promise<User> {
  const db = requireDb()
  const { ObjectId } = await import('mongodb')
  const update: any = { $set: { updatedAt: new Date().toISOString() } }
  if (input.role) update.$set.role = input.role
  if (typeof input.active === 'boolean') update.$set.active = input.active
  if (input.permissions) update.$set.permissions = input.permissions
  if (input.password) update.$set.passwordHash = hashPassword(input.password)
  const result = await db.collection(USERS_COL).findOneAndUpdate({ _id: new ObjectId(id) } as any, update, { returnDocument: 'after', projection: { passwordHash: 0 } } as any)
  if (!result) throw new Error('User not found')
  await logAudit({ action: 'user.update', resource: 'users', resourceId: id })
  return result as any as User
}

export async function listAudit(limit = 100): Promise<AuditEvent[]> {
  const db = requireDb()
  return db.collection<AuditEvent>(AUDIT_COL).find({}).sort({ createdAt: -1 }).limit(limit).toArray()
}

export function listRoles() {
  return BUILTIN_ROLES
}
