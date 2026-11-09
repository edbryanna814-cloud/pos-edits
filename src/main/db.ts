import { MongoClient, type Db } from 'mongodb'
import type { DbHealth } from '../shared/ipc'

const defaultUri = 'mongodb://127.0.0.1:27017/?replicaSet=rs0'
const databaseName = process.env['MONGODB_DB'] ?? 'pharmacy_pos'

function mongoUri(): string {
  return process.env['MONGODB_URI'] ?? defaultUri
}

let client: MongoClient | null = null
let db: Db | null = null
let lastError: string | null = null

export async function connectDb(): Promise<Db | null> {
  if (db) return db

  let next: MongoClient | null = null

  try {
    next = new MongoClient(mongoUri(), { serverSelectionTimeoutMS: 3000 })
    await next.connect()
    const nextDb = next.db(databaseName)
    await nextDb.command({ ping: 1 })
    client = next
    db = nextDb
    lastError = null
    return db
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error)
    db = null
    if (next) await next.close().catch(() => undefined)
    if (client === next) client = null
    return null
  }
}

export async function closeDb(): Promise<void> {
  const current = client
  client = null
  db = null
  if (current) await current.close().catch(() => undefined)
}

export function getDb(): Db | null {
  return db
}

export function getClient(): MongoClient | null {
  return client
}

export async function dbHealth(): Promise<DbHealth> {
  if (!db) await connectDb()

  if (!db) {
    return {
      status: 'disconnected',
      database: databaseName,
      supportsTransactions: false,
      error: lastError ?? 'Not connected'
    }
  }

  try {
    const start = Date.now()
    await db.command({ ping: 1 })
    const [buildInfo, hello] = await Promise.all([
      db.admin().command({ buildInfo: 1 }),
      db.admin().command({ hello: 1 })
    ])
    const isReplicaSet = typeof hello.setName === 'string'
    const isSharded = hello.msg === 'isdbgrid'

    return {
      status: 'connected',
      database: databaseName,
      serverVersion: typeof buildInfo.version === 'string' ? buildInfo.version : undefined,
      topology: isReplicaSet ? `replicaSet:${hello.setName}` : isSharded ? 'sharded' : 'standalone',
      supportsTransactions: isReplicaSet || isSharded,
      latencyMs: Date.now() - start
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error)
    return {
      status: 'disconnected',
      database: databaseName,
      supportsTransactions: false,
      error: lastError
    }
  }
}
