import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { verifyResetCode } from '../../src/main/recovery'

// A reset code signed by the real panel code (anubis-switcher src/lib/recovery.ts) with a throwaway key.
// No signing here: the app repo only verifies (scripts/scan-signing.mjs).
const fx = JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', 'reset-codes.json'), 'utf8'))
const keys = [fx.key]
const lease = JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', 'anb2-panel-leases.json'), 'utf8')).subscription.lease.token
const check = (token: string, over: Partial<{ deviceId: string; requestCode: string; nowSeconds: number }> = {}) =>
  verifyResetCode(token, { keys, deviceId: fx.deviceId, requestCode: fx.requestCode, nowSeconds: fx.iat + 60, ...over })

describe('forgotten-password reset code', () => {
  it('accepts the panel-signed code for this device and request (line breaks from copying are ignored)', () => {
    expect(check(fx.code)).toMatchObject({ v: 1, prod: 'PHM', dev: fx.deviceId, req: fx.requestCode })
    expect(fx.exp - fx.iat).toBe(3600)
    expect(check(`${fx.code.slice(0, 40)}\n ${fx.code.slice(40)}`).req).toBe(fx.requestCode)
  })

  it('refuses another device, another request, expired, tampered, license and junk codes', () => {
    expect(() => check(fx.code, { deviceId: 'f'.repeat(32) })).toThrow('RESET_CODE_WRONG_DEVICE')
    expect(() => check(fx.code, { requestCode: 'ZZZZ-ZZZZ-ZZZZ' })).toThrow('RESET_CODE_WRONG_REQUEST')
    expect(() => check(fx.code, { nowSeconds: fx.exp })).toThrow('RESET_CODE_EXPIRED')
    expect(() => verifyResetCode(fx.code, { keys: [{ ...fx.key, retired: true }], deviceId: fx.deviceId, requestCode: fx.requestCode, nowSeconds: fx.iat })).toThrow('RESET_CODE_INVALID')
    // A longer validity written into the payload breaks the signature.
    const [p, h, , s] = fx.code.split('.')
    const longer = Buffer.from(JSON.stringify({ v: 1, prod: 'PHM', dev: fx.deviceId, req: fx.requestCode, iat: fx.iat, exp: fx.iat + 86400 })).toString('base64url')
    expect(() => check([p, h, longer, s].join('.'))).toThrow('RESET_CODE_INVALID')
    expect(() => check(lease)).toThrow('RESET_CODE_INVALID') // a license is not a reset code
    expect(() => check('RST1.e30.e30.AAAA')).toThrow('RESET_CODE_INVALID')
    expect(() => check('')).toThrow('RESET_CODE_INVALID')
  })
})
