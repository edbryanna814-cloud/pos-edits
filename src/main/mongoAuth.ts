import { randomBytes } from 'node:crypto'
import { MongoClient } from 'mongodb'

// Gate 1 S4: the bundled MongoDB runs with access control (keyFile => auth on a replica set).
// Two users: an administrator used only by the app's own bootstrap/shutdown code, and a
// least-privilege application user (readWrite on the app database) that every query uses.
// No Electron imports here, so the bootstrap can be tested against a real mongod.

export const ADMIN_USER = 'pharmacy_admin'
export const APP_USER = 'pharmacy_app'
export const APP_ROLE = 'pharmacyApp'

export type MongoSecrets = { adminPassword: string; appPassword: string; keyFile: string }

export function createSecrets(): MongoSecrets {
  return {
    adminPassword: randomBytes(32).toString('base64url'),
    appPassword: randomBytes(32).toString('base64url'),
    // mongod keyFile: 6–1024 base64 characters.
    keyFile: randomBytes(750).toString('base64') // exactly 1000 characters
  }
}

export function isSecrets(value: unknown): value is MongoSecrets {
  const v = value as MongoSecrets
  return !!v && [v.adminPassword, v.appPassword, v.keyFile].every((s) => typeof s === 'string' && s.length >= 32)
}

export type Endpoint = { host: string; port: number; replicaSet: string }

const base = (e: Endpoint) => `${e.host}:${e.port}`
export const directUri = (e: Endpoint) => `mongodb://${base(e)}/?directConnection=true`
export const adminUri = (e: Endpoint, s: MongoSecrets) =>
  `mongodb://${ADMIN_USER}:${encodeURIComponent(s.adminPassword)}@${base(e)}/?directConnection=true&authSource=admin`
/** The only URI the application uses. */
export const appUri = (e: Endpoint, s: MongoSecrets) =>
  `mongodb://${APP_USER}:${encodeURIComponent(s.appPassword)}@${base(e)}/?replicaSet=${e.replicaSet}&authSource=admin`

async function withClient<T>(uri: string, fn: (client: MongoClient) => Promise<T>): Promise<T> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 })
  try {
    await client.connect()
    return await fn(client)
  } finally {
    await client.close().catch(() => undefined)
  }
}

async function waitPrimary(client: MongoClient): Promise<void> {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    if ((await client.db('admin').command({ hello: 1 })).isWritablePrimary) return
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error('MongoDB replica set did not become primary')
}

async function canAuthenticate(uri: string): Promise<boolean> {
  try {
    return await withClient(uri, async (c) => (await c.db('admin').command({ connectionStatus: 1 })).authInfo.authenticatedUsers.length > 0)
  } catch {
    return false
  }
}

/**
 * Brings a mongod started with --keyFile to the secured state:
 *  1. replica set initiated (via the localhost exception on a fresh or pre-Gate-1 data directory);
 *  2. the administrator created via the localhost exception if no user exists yet;
 *  3. the application user created, or its password and roles re-asserted from the stored secrets.
 * Idempotent; safe on every start.
 */
export async function secureBundledMongo(e: Endpoint, s: MongoSecrets, appDb: string): Promise<'created' | 'existing'> {
  const admin = adminUri(e, s)
  let result: 'created' | 'existing' = 'existing'
  if (!(await canAuthenticate(admin))) {
    // Localhost exception: no users exist yet, so this unauthenticated connection may initiate the
    // replica set and create the first (administrator) user, nothing else.
    await withClient(directUri(e), async (c) => {
      try {
        await c.db('admin').command({ replSetInitiate: { _id: e.replicaSet, members: [{ _id: 0, host: base(e) }] } })
      } catch (error) {
        if ((error as { codeName?: string }).codeName !== 'AlreadyInitialized') throw error
      }
      await waitPrimary(c)
      await c.db('admin').command({ createUser: ADMIN_USER, pwd: s.adminPassword, roles: [{ role: 'root', db: 'admin' }] })
    })
    result = 'created'
  }
  await withClient(admin, async (c) => {
    await waitPrimary(c)
    // Least privilege: readWrite on the app database plus collMod (settings schema validator). Not dbAdmin
    // (which adds dropDatabase, compact, …) and no access to any other database.
    const privileges = [{ resource: { db: appDb, collection: '' }, actions: ['collMod'] }]
    const inherited = [{ role: 'readWrite', db: appDb }]
    const roleExists = (await c.db('admin').command({ rolesInfo: { role: APP_ROLE, db: 'admin' } })).roles.length > 0
    if (roleExists) await c.db('admin').command({ updateRole: APP_ROLE, privileges, roles: inherited })
    else await c.db('admin').command({ createRole: APP_ROLE, privileges, roles: inherited })
    const roles = [{ role: APP_ROLE, db: 'admin' }]
    const existing = await c.db('admin').command({ usersInfo: { user: APP_USER, db: 'admin' } })
    if (existing.users.length === 0) await c.db('admin').command({ createUser: APP_USER, pwd: s.appPassword, roles })
    else await c.db('admin').command({ updateUser: APP_USER, pwd: s.appPassword, roles })
  })
  return result
}

/** Clean shutdown needs the administrator once access control is on. */
function isAuthError(error: unknown): boolean {
  const e = error as { codeName?: string; message?: string }
  return e?.codeName === 'AuthenticationFailed' || e?.codeName === 'Unauthorized' ||
    /authentication failed|requires authentication|not authorized/i.test(String(e?.message))
}

/**
 * Tries the administrator first, then an anonymous shutdown (a pre-Gate-1 server has no users).
 * An authentication/authorisation error means "try the next way"; any other error is the server
 * dropping the socket while it shuts down, which counts as success.
 */
export async function shutdownBundledMongo(e: Endpoint, s: MongoSecrets | null): Promise<void> {
  for (const uri of s ? [adminUri(e, s), directUri(e)] : [directUri(e)]) {
    try {
      await withClient(uri, (c) => c.db('admin').command({ shutdown: 1, force: true }))
      return
    } catch (error) {
      if (!isAuthError(error)) return
    }
  }
}
