import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { argon2id } from 'hash-wasm'

// Gate 1 S4: encrypted backups. Key = Argon2id(passphrase, salt); data = AES-256-GCM.
// The header (format, version, KDF parameters, IV) is authenticated as AAD, so changing any
// parameter makes decryption fail. The passphrase is never stored by the app.

export const BACKUP_FORMAT = 'pharmacy-pos-backup'
export const ENCRYPTED_VERSION = 3
export const MIN_BACKUP_PASSPHRASE = 12
const KDF = { alg: 'argon2id', m: 65536, t: 3, p: 1 } as const

export const BACKUP_ERRORS = {
  passphrase: 'BACKUP_PASSPHRASE_REQUIRED',
  decrypt: 'BACKUP_DECRYPT_FAILED'
} as const

type Envelope = {
  format: typeof BACKUP_FORMAT
  version: typeof ENCRYPTED_VERSION
  kdf: { alg: 'argon2id'; m: number; t: number; p: number; salt: string }
  cipher: { alg: 'aes-256-gcm'; iv: string; tag: string }
  data: string
}

async function deriveKey(passphrase: string, salt: Buffer, kdf: { m: number; t: number; p: number }): Promise<Buffer> {
  return Buffer.from(await argon2id({ password: passphrase, salt, memorySize: kdf.m, iterations: kdf.t, parallelism: kdf.p, hashLength: 32, outputType: 'binary' }))
}

function aad(e: Pick<Envelope, 'format' | 'version' | 'kdf'> & { cipher: { alg: string; iv: string } }): Buffer {
  const { m, t, p, salt, alg } = e.kdf
  return Buffer.from(JSON.stringify([e.format, e.version, alg, m, t, p, salt, e.cipher.alg, e.cipher.iv]))
}

export function isEncryptedBackup(value: unknown): value is Envelope {
  const v = value as Envelope
  return !!v && v.format === BACKUP_FORMAT && v.version === ENCRYPTED_VERSION && typeof v.data === 'string'
}

export async function encryptBackup(plaintext: string, passphrase: unknown): Promise<string> {
  if (typeof passphrase !== 'string' || passphrase.length < MIN_BACKUP_PASSPHRASE) throw new Error(BACKUP_ERRORS.passphrase)
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const kdf = { ...KDF, salt: salt.toString('base64') }
  const head = { format: BACKUP_FORMAT, version: ENCRYPTED_VERSION, kdf, cipher: { alg: 'aes-256-gcm', iv: iv.toString('base64') } } as const
  const cipher = createCipheriv('aes-256-gcm', await deriveKey(passphrase, salt, KDF), iv)
  cipher.setAAD(aad(head))
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const envelope: Envelope = { ...head, cipher: { ...head.cipher, tag: cipher.getAuthTag().toString('base64') }, data: data.toString('base64') }
  return JSON.stringify(envelope)
}

export async function decryptBackup(envelope: Envelope, passphrase: unknown): Promise<string> {
  if (typeof passphrase !== 'string' || !passphrase) throw new Error(BACKUP_ERRORS.passphrase)
  try {
    const { kdf, cipher: c } = envelope
    // Bound the KDF cost a file can demand (a crafted file must not exhaust memory).
    if (kdf.alg !== 'argon2id' || kdf.m > 1 << 20 || kdf.t > 10 || kdf.p > 4 || c.alg !== 'aes-256-gcm') throw new Error('unsupported')
    const key = await deriveKey(passphrase, Buffer.from(kdf.salt, 'base64'), kdf)
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(c.iv, 'base64'))
    decipher.setAAD(aad(envelope))
    decipher.setAuthTag(Buffer.from(c.tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    throw new Error(BACKUP_ERRORS.decrypt) // wrong passphrase, tampered file or unsupported parameters
  }
}
