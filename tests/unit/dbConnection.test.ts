import { describe, expect, it } from 'vitest'
import { describeUri, testSharedUri, validateSharedUri } from '../../src/main/dbConnection'

// Shared live database (several tills, one server). CI: mongo:9.0 service (standalone); local: rs0.
const LOCAL = process.env['MONGODB_TEST_URI'] ?? 'mongodb://127.0.0.1:27017/?directConnection=true'

describe('shared database connection', () => {
  it('accepts Atlas-style and TLS connection strings with a login', () => {
    expect(validateSharedUri(' mongodb+srv://pos:secret@cluster0.ab1cd.mongodb.net/?retryWrites=true ')).toBe(
      'mongodb+srv://pos:secret@cluster0.ab1cd.mongodb.net/?retryWrites=true'
    )
    expect(validateSharedUri('mongodb://pos:secret@db1.example.com:27017,db2.example.com/?replicaSet=rs0&tls=true')).toContain('db1')
  })

  it('refuses plain-text connections, missing logins, weakened TLS and junk', () => {
    expect(() => validateSharedUri('mongodb://pos:secret@db.example.com:27017/')).toThrow('DB_TLS_REQUIRED')
    expect(() => validateSharedUri('mongodb://pos:secret@db.example.com/?tls=true&tlsAllowInvalidCertificates=true')).toThrow('DB_TLS_REQUIRED')
    expect(() => validateSharedUri('mongodb+srv://cluster0.example.mongodb.net/')).toThrow('DB_LOGIN_REQUIRED')
    expect(() => validateSharedUri('https://example.com')).toThrow('DB_URI_INVALID')
    expect(() => validateSharedUri('')).toThrow('DB_URI_INVALID')
    expect(() => validateSharedUri(42)).toThrow('DB_URI_INVALID')
  })

  it('allows a server on this PC without TLS', () => {
    expect(validateSharedUri('mongodb://127.0.0.1:27017/?replicaSet=rs0')).toContain('127.0.0.1')
  })

  it('never shows the user or password', () => {
    expect(describeUri('mongodb+srv://pos:Sup3rSecret@cluster0.ab1cd.mongodb.net/?x=1')).toBe('cluster0.ab1cd.mongodb.net')
  })

  it('reports an unreachable server', async () => {
    await expect(testSharedUri('mongodb://127.0.0.1:27099/?directConnection=true', 1500)).rejects.toThrow('DB_UNREACHABLE')
  })

  it('accepts a replica set and refuses a standalone server (transactions)', async () => {
    const outcome = await testSharedUri(LOCAL, 5000).then(
      (r) => r.topology,
      (e: Error) => e.message
    )
    // Local dev: rs0 replica set; CI service container: standalone.
    expect(['replicaSet:rs0', 'DB_NO_TRANSACTIONS']).toContain(outcome)
  })
})
