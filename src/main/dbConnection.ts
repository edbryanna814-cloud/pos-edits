import { MongoClient } from 'mongodb'

// Shared live database: several cashier PCs use one MongoDB server over the internet (e.g. MongoDB
// Atlas) instead of each PC's bundled database. No Electron imports here: validation and the
// connection test are unit-tested; storage (DPAPI) lives in dbConfig.ts.

export const DB_ERRORS = {
  invalid: 'DB_URI_INVALID',
  tls: 'DB_TLS_REQUIRED',
  auth: 'DB_LOGIN_REQUIRED',
  unreachable: 'DB_UNREACHABLE',
  authFailed: 'DB_AUTH_FAILED',
  noTransactions: 'DB_NO_TRANSACTIONS'
} as const

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

type Parsed = { srv: boolean; hosts: string[]; username: string; params: URLSearchParams }

function parse(uri: string): Parsed {
  const match = /^(mongodb(?:\+srv)?):\/\/(?:([^:@/]*)(?::[^@/]*)?@)?([^/?]+)(\/[^?]*)?(?:\?(.*))?$/.exec(uri)
  if (!match) throw new Error(DB_ERRORS.invalid)
  const [, scheme, username = '', hostPart, , query = ''] = match
  const hosts = hostPart.split(',').map((h) => h.replace(/:\d+$/, '').toLowerCase()).filter(Boolean)
  if (!hosts.length) throw new Error(DB_ERRORS.invalid)
  return { srv: scheme === 'mongodb+srv', hosts, username: decodeURIComponent(username), params: new URLSearchParams(query) }
}

/**
 * A shared server must be reachable only over TLS (mongodb+srv implies TLS; mongodb:// needs tls=true)
 * and must require a login. A server on this PC is exempt (no network involved).
 */
export function validateSharedUri(value: unknown): string {
  const uri = typeof value === 'string' ? value.trim() : ''
  if (!uri || uri.length > 2000) throw new Error(DB_ERRORS.invalid)
  const parsed = parse(uri)
  const local = parsed.hosts.every((h) => LOCAL_HOSTS.has(h))
  if (!local) {
    const tls = parsed.srv || ['tls', 'ssl'].some((k) => parsed.params.get(k) === 'true')
    if (!tls) throw new Error(DB_ERRORS.tls)
    if (['tlsInsecure', 'tlsAllowInvalidCertificates', 'tlsAllowInvalidHostnames'].some((k) => parsed.params.get(k) === 'true')) {
      throw new Error(DB_ERRORS.tls)
    }
    if (!parsed.username) throw new Error(DB_ERRORS.auth)
  }
  return uri
}

/** Hosts only (no user, no password, no options): what the app may show or log. */
export function describeUri(uri: string): string {
  try {
    return parse(uri).hosts.join(', ')
  } catch {
    return ''
  }
}

export type DbTestResult = { ok: true; serverVersion: string; topology: string; hosts: string }

/** Connects, checks the server answers and supports transactions (replica set or sharded). */
export async function testSharedUri(value: unknown, timeoutMs = 8000): Promise<DbTestResult> {
  const uri = validateSharedUri(value)
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: timeoutMs, connectTimeoutMS: timeoutMs })
  try {
    await client.connect()
    const admin = client.db('admin')
    await admin.command({ ping: 1 })
    const [hello, build] = await Promise.all([admin.command({ hello: 1 }), admin.command({ buildInfo: 1 }).catch(() => ({ version: '' }))])
    const topology = typeof hello.setName === 'string' ? `replicaSet:${hello.setName}` : hello.msg === 'isdbgrid' ? 'sharded' : 'standalone'
    if (topology === 'standalone') throw new Error(DB_ERRORS.noTransactions)
    return { ok: true, serverVersion: String(build.version ?? ''), topology, hosts: describeUri(uri) }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (Object.values(DB_ERRORS).includes(message as never)) throw error
    const e = error as { codeName?: string; name?: string }
    if (e.codeName === 'AuthenticationFailed' || /auth/i.test(message)) throw new Error(DB_ERRORS.authFailed)
    throw new Error(DB_ERRORS.unreachable)
  } finally {
    await client.close().catch(() => undefined)
  }
}
