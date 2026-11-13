import { describe, expect, it } from 'vitest'
import { decryptBackup, encryptBackup, isEncryptedBackup } from '../../src/main/backupCrypto'

const PASS = 'correct horse battery staple'
const DATA = JSON.stringify({ version: 2, collections: { customers: [{ name: 'Test Pharmacy customer', phone: '+20 100 000 0000' }] } })

describe('encrypted backups (Gate 1 S4)', () => {
  it('round-trips with the right passphrase and hides the content', async () => {
    const text = await encryptBackup(DATA, PASS)
    expect(text).not.toContain('Test Pharmacy customer')
    expect(text).not.toContain('+20 100')
    const envelope = JSON.parse(text)
    expect(isEncryptedBackup(envelope)).toBe(true)
    expect(envelope.kdf).toMatchObject({ alg: 'argon2id', m: 65536, t: 3, p: 1 })
    expect(envelope.cipher.alg).toBe('aes-256-gcm')
    expect(await decryptBackup(envelope, PASS)).toBe(DATA)
  })

  it('uses a fresh salt and IV every time', async () => {
    const a = JSON.parse(await encryptBackup(DATA, PASS))
    const b = JSON.parse(await encryptBackup(DATA, PASS))
    expect(a.kdf.salt).not.toBe(b.kdf.salt)
    expect(a.cipher.iv).not.toBe(b.cipher.iv)
    expect(a.data).not.toBe(b.data)
  })

  it('refuses a short or missing passphrase on export', async () => {
    await expect(encryptBackup(DATA, 'short')).rejects.toThrow('BACKUP_PASSPHRASE_REQUIRED')
    await expect(encryptBackup(DATA, undefined)).rejects.toThrow('BACKUP_PASSPHRASE_REQUIRED')
  })

  it('fails on a wrong or missing passphrase', async () => {
    const envelope = JSON.parse(await encryptBackup(DATA, PASS))
    await expect(decryptBackup(envelope, 'wrong passphrase!!')).rejects.toThrow('BACKUP_DECRYPT_FAILED')
    await expect(decryptBackup(envelope, undefined)).rejects.toThrow('BACKUP_PASSPHRASE_REQUIRED')
  })

  it('detects tampering with the data, the tag, or the authenticated header', async () => {
    const original = JSON.parse(await encryptBackup(DATA, PASS))
    const flip = (b64: string) => { const buf = Buffer.from(b64, 'base64'); buf[0] ^= 1; return buf.toString('base64') }
    for (const tampered of [
      { ...original, data: flip(original.data) },
      { ...original, cipher: { ...original.cipher, tag: flip(original.cipher.tag) } },
      { ...original, kdf: { ...original.kdf, t: 4 } },
      { ...original, kdf: { ...original.kdf, m: 1 << 22 } } // a file may not demand an unbounded KDF
    ]) {
      await expect(decryptBackup(tampered, PASS)).rejects.toThrow('BACKUP_DECRYPT_FAILED')
    }
  })
})
