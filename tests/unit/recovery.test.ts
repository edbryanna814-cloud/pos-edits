import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyResetCode } from '../../src/main/recovery'

// Same signing as the panel (anubis-switcher src/lib/recovery.ts), with a throwaway key.
const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const keys = [{ kid: 'test-01', publicKey: publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64') }]
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const DEV = '0123456789abcdef0123456789abcdef'
const NOW = 1_800_000_000

function code(payload: Record<string, unknown>, header: Record<string, unknown> = {}): string {
  const input = `${enc({ alg: 'Ed25519', kid: 'test-01', typ: 'ANB-RST', ...header })}.${enc({ v: 1, prod: 'PHM', dev: DEV, req: 'ABCD-EFGH-JKMN', iat: NOW, exp: NOW + 3600, ...payload })}`
  return `RST1.${input}.${sign(null, Buffer.from(input), privateKey).toString('base64url')}`
}
const check = (token: string, over: Partial<{ deviceId: string; requestCode: string; nowSeconds: number }> = {}) =>
  verifyResetCode(token, { keys, deviceId: DEV, requestCode: 'ABCD-EFGH-JKMN', nowSeconds: NOW + 60, ...over })

describe('forgotten-password reset code', () => {
  it('accepts a panel-signed code for this device and request (line breaks from copying are ignored)', () => {
    const token = code({})
    expect(check(token).dev).toBe(DEV)
    expect(check(`${token.slice(0, 40)}\n${token.slice(40)}`).req).toBe('ABCD-EFGH-JKMN')
  })

  it('refuses another device, another request, expired, long-lived, forged and junk codes', () => {
    expect(() => check(code({}), { deviceId: 'f'.repeat(32) })).toThrow('RESET_CODE_WRONG_DEVICE')
    expect(() => check(code({}), { requestCode: 'ZZZZ-ZZZZ-ZZZZ' })).toThrow('RESET_CODE_WRONG_REQUEST')
    expect(() => check(code({}), { nowSeconds: NOW + 3600 })).toThrow('RESET_CODE_EXPIRED')
    expect(() => check(code({ exp: NOW + 86400 }))).toThrow('RESET_CODE_INVALID')
    expect(() => check(code({ prod: 'OTHER' }))).toThrow('RESET_CODE_INVALID')
    expect(() => check(code({}, { typ: 'ANB-ENT' }))).toThrow('RESET_CODE_INVALID') // a license is not a reset code
    const [p, h, , s] = code({}).split('.')
    expect(() => check([p, h, enc({ v: 1, prod: 'PHM', dev: DEV, req: 'ABCD-EFGH-JKMN', iat: NOW, exp: NOW + 7000 }), s].join('.'))).toThrow('RESET_CODE_INVALID')
    expect(() => check('ANB2.a.b.c')).toThrow('RESET_CODE_INVALID')
    expect(() => check('')).toThrow('RESET_CODE_INVALID')
  })
})
