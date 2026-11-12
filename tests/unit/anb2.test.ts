import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { anb2ExpiryMs, extractToken, isAnb2, verifyAnb2, type PanelKey } from '../../src/main/anb2'

// Leases issued by the real panel code (anubis-switcher, licence issue API) with a scratch key.
const fx = JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', 'anb2-panel-leases.json'), 'utf8'))
const keys: PanelKey[] = [fx.key]
const sub = fx.subscription
const perp = fx.perpetual
const at = (s: number) => ({ keys, appVersion: '0.2.2', nowSeconds: s })

describe('panel licences (ANB2)', () => {
  it('accepts a 1-hour subscription on its device inside the window', () => {
    const p = verifyAnb2(sub.lease.token, { ...at(sub.payload.nbf + 60), deviceId: sub.payload.dev })
    expect(p).toMatchObject({ prod: 'PHM', kind: 'standard', minApp: '0.2.2' })
    expect(p.exp! - p.nbf).toBe(3600)
    expect(anb2ExpiryMs(p)).toBe(p.exp! * 1000)
  })

  it('refuses the subscription once it has expired, but reports it for the status screen', () => {
    const opts = { ...at(sub.payload.exp), deviceId: sub.payload.dev }
    expect(() => verifyAnb2(sub.lease.token, opts)).toThrow('already expired')
    expect(verifyAnb2(sub.lease.token, { ...opts, allowExpired: true }).lid).toBe(sub.payload.lid)
  })

  it('refuses a lease before its start time', () => {
    expect(() => verifyAnb2(sub.lease.token, { ...at(sub.payload.nbf - 60), deviceId: sub.payload.dev })).toThrow('not valid yet')
  })

  it('accepts a one-time (perpetual) licence with no expiry, years later', () => {
    const p = verifyAnb2(perp.lease.token, { ...at(perp.payload.nbf + 10 * 365 * 86400), deviceId: perp.payload.dev })
    expect(p.kind).toBe('perpetual')
    expect(anb2ExpiryMs(p)).toBe(Number.POSITIVE_INFINITY)
  })

  it('refuses another device', () => {
    expect(() => verifyAnb2(sub.lease.token, { ...at(sub.payload.nbf + 60), deviceId: '0'.repeat(32) })).toThrow('different device')
  })

  it('refuses an unknown or retired signing key', () => {
    const opts = { appVersion: '0.2.2', nowSeconds: sub.payload.nbf + 60, deviceId: sub.payload.dev }
    expect(() => verifyAnb2(sub.lease.token, { ...opts, keys: [{ ...fx.key, kid: 'phm-2099-01' }] })).toThrow('signature')
    expect(() => verifyAnb2(sub.lease.token, { ...opts, keys: [{ ...fx.key, retired: true }] })).toThrow('signature')
    expect(() => verifyAnb2(sub.lease.token, { ...opts, keys: [] })).toThrow('signature')
  })

  it('refuses a tampered payload or signature', () => {
    const [prefix, header, payload, signature] = sub.lease.token.split('.')
    const forged = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    forged.exp = null
    forged.kind = 'perpetual'
    const tampered = [prefix, header, Buffer.from(JSON.stringify(forged)).toString('base64url'), signature].join('.')
    const opts = { ...at(sub.payload.nbf + 60), deviceId: sub.payload.dev }
    expect(() => verifyAnb2(tampered, opts)).toThrow('signature')
    const sig = Buffer.from(signature, 'base64url')
    sig[0] ^= 1
    expect(() => verifyAnb2([prefix, header, payload, sig.toString('base64url')].join('.'), opts)).toThrow('signature')
  })

  it('refuses an app older than the lease minimum', () => {
    expect(() =>
      verifyAnb2(sub.lease.token, { keys, appVersion: '0.2.1', nowSeconds: sub.payload.nbf + 60, deviceId: sub.payload.dev })
    ).toThrow('newer app version')
    expect(verifyAnb2(sub.lease.token, { keys, appVersion: '1.0.0', nowSeconds: sub.payload.nbf + 60, deviceId: sub.payload.dev }).prod).toBe('PHM')
  })

  it('reads the token from a .anbc file or a raw paste, and rejects junk', () => {
    expect(extractToken(JSON.stringify(sub.lease))).toBe(sub.lease.token)
    expect(extractToken(`  ${sub.lease.token}\n`)).toBe(sub.lease.token)
    expect(isAnb2(sub.lease.token)).toBe(true)
    expect(() => extractToken('{"format":"something-else"}')).toThrow('format')
    expect(() => verifyAnb2('ANB2.x.y', { ...at(0), deviceId: 'x' })).toThrow('format')
    expect(() => verifyAnb2('ANB2.' + 'A'.repeat(9000), { ...at(0), deviceId: 'x' })).toThrow('format')
  })
})
