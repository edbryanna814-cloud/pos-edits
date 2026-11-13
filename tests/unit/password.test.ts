import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { hashPassword, hashToken, isLegacyHash, newPasswordError, verifyPassword } from '../../src/main/password'

describe('password hashing (Gate 1, Argon2id)', () => {
  it('produces an Argon2id PHC string with a per-user salt', async () => {
    const a = await hashPassword('correct horse battery')
    const b = await hashPassword('correct horse battery')
    expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/)
    expect(a).not.toBe(b)
  })

  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery')
    expect(await verifyPassword('correct horse battery', stored)).toEqual({ ok: true, legacy: false })
    expect(await verifyPassword('wrong horse battery', stored)).toEqual({ ok: false, legacy: false })
  })

  it('rejects malformed or tampered hashes', async () => {
    const stored = await hashPassword('correct horse battery')
    const tampered = stored.slice(0, -2) + (stored.endsWith('AA') ? 'BB' : 'AA')
    expect((await verifyPassword('correct horse battery', tampered)).ok).toBe(false)
    expect((await verifyPassword('x', 'not-a-hash')).ok).toBe(false)
    expect((await verifyPassword('x', undefined as unknown as string)).ok).toBe(false)
  })

  it('recognises a legacy unsalted SHA-256 hash only for migration', async () => {
    const legacy = createHash('sha256').update('admin').digest('hex')
    expect(isLegacyHash(legacy)).toBe(true)
    expect(await verifyPassword('admin', legacy)).toEqual({ ok: true, legacy: true })
    expect(await verifyPassword('nope', legacy)).toEqual({ ok: false, legacy: true })
    expect(isLegacyHash(await hashPassword('correct horse battery'))).toBe(false)
  })

  it('enforces a 12-character minimum', () => {
    expect(newPasswordError('admin')).toBe('PASSWORD_TOO_SHORT')
    expect(newPasswordError('elevenchars')).toBe('PASSWORD_TOO_SHORT')
    expect(newPasswordError('twelve-chars')).toBeNull()
    expect(newPasswordError('x'.repeat(257))).toBe('PASSWORD_TOO_LONG')
    expect(newPasswordError(undefined)).toBe('PASSWORD_TOO_SHORT')
  })

  it('matches Node’s reference Argon2id output for the same inputs (where node:crypto supports it)', async () => {
    const crypto = await import('node:crypto')
    if (typeof (crypto as any).argon2Sync !== 'function') return
    const stored = await hashPassword('correct horse battery')
    const [, , , , salt, hash] = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(stored)!
    const reference: Buffer = (crypto as any).argon2Sync('argon2id', {
      message: Buffer.from('correct horse battery'), nonce: Buffer.from(salt, 'base64'), memory: 19456, passes: 2, parallelism: 1, tagLength: 32
    })
    expect(reference.equals(Buffer.from(hash, 'base64'))).toBe(true)
  })

  it('hashes session tokens deterministically', () => {
    expect(hashToken('abc')).toBe(createHash('sha256').update('abc').digest('hex'))
  })
})
