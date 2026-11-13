import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { argon2id } from 'hash-wasm'

// Gate 1 S3/S4: Argon2id with a per-user salt. Electron's node:crypto exposes argon2() but its BoringSSL
// throws ERR_CRYPTO_ARGON2_NOT_SUPPORTED, so the WASM implementation (hash-wasm, MIT, pinned) is used.
// Parameters: OWASP minimum for Argon2id (19 MiB, t=2, p=1).
const MEMORY_KIB = 19456
const PASSES = 2
const PARALLELISM = 1
const TAG_LENGTH = 32
const SALT_BYTES = 16

export const MIN_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_LENGTH = 256

const PHC = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/
const LEGACY_SHA256 = /^[0-9a-f]{64}$/

async function derive(password: string, salt: Buffer, memory: number, passes: number, parallelism: number, tagLength: number): Promise<Buffer> {
  const key = await argon2id({ password, salt, memorySize: memory, iterations: passes, parallelism, hashLength: tagLength, outputType: 'binary' })
  return Buffer.from(key)
}

const b64 = (buf: Buffer) => buf.toString('base64').replace(/=+$/, '')

/** Returns a PHC string: $argon2id$v=19$m=…,t=…,p=…$salt$hash */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const key = await derive(password, salt, MEMORY_KIB, PASSES, PARALLELISM, TAG_LENGTH)
  return `$argon2id$v=19$m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM}$${b64(salt)}$${b64(key)}`
}

export function isLegacyHash(stored: string): boolean {
  return LEGACY_SHA256.test(stored)
}

/**
 * `legacy: true` means the stored value is a pre-Gate-1 unsalted SHA-256 hash. It is accepted once,
 * only so the caller can re-hash it with Argon2id and force a password reset. No code creates such hashes.
 */
export async function verifyPassword(password: string, stored: string): Promise<{ ok: boolean; legacy: boolean }> {
  if (typeof stored !== 'string') return { ok: false, legacy: false }
  if (isLegacyHash(stored)) {
    const candidate = Buffer.from(createHash('sha256').update(password).digest('hex'))
    return { ok: timingSafeEqual(candidate, Buffer.from(stored)), legacy: true }
  }
  const m = PHC.exec(stored)
  if (!m) return { ok: false, legacy: false }
  const [, memory, passes, parallelism, salt, hash] = m
  const expected = Buffer.from(hash, 'base64')
  const key = await derive(password, Buffer.from(salt, 'base64'), Number(memory), Number(passes), Number(parallelism), expected.length)
  return { ok: key.length === expected.length && timingSafeEqual(key, expected), legacy: false }
}

/** Stable error code for a new password, or null when acceptable. */
export function newPasswordError(password: unknown): 'PASSWORD_TOO_SHORT' | 'PASSWORD_TOO_LONG' | null {
  const text = typeof password === 'string' ? password : ''
  if (text.length < MIN_PASSWORD_LENGTH) return 'PASSWORD_TOO_SHORT'
  if (text.length > MAX_PASSWORD_LENGTH) return 'PASSWORD_TOO_LONG'
  return null
}

/** Session tokens are stored only as this hash; the raw token stays with the renderer. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
