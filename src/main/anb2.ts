import { createPublicKey, verify } from 'node:crypto'

// Panel licences (anubis-switcher contract v3 §6): ANB2.<b64url(header)>.<b64url(payload)>.<b64url(sig)>,
// Ed25519 over "<b64url(header)>.<b64url(payload)>", times in seconds. No Electron imports: unit-tested.
// Shortcut: signature, kid, product, device, fpv, nbf/exp, minApp only. The sequence high-water mark
// and clock-rollback stores (contract §9.1/§9.2, Gate 2 L1/L4) are not implemented yet.

export type PanelKey = { kid: string; publicKey: string; retired?: boolean }

export type Anb2Payload = {
  v: 2
  prod: string
  lid: string
  cid: string
  dev: string
  fpv: number
  seats: number
  plan: string
  feat: string[]
  iat: number
  nbf: number
  exp: number | null
  term: number | null
  grace: number
  minApp: string
  seq: number
  kind: 'standard' | 'support' | 'perpetual'
}

export const PRODUCT = 'PHM'
const SUPPORTED_FPV = new Set([1])
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
const MAX_TOKEN = 8192

/** Accepts the raw token or the text of a .anbc lease file. */
export function extractToken(input: string): string {
  const text = String(input ?? '').trim()
  if (text.startsWith('{')) {
    try {
      const file = JSON.parse(text) as { format?: string; token?: unknown }
      if (file.format === 'anubis-lease-v1' && typeof file.token === 'string') return file.token.trim()
    } catch {
      // fall through: not a lease file
    }
    throw new Error('Invalid license code format')
  }
  return text
}

export function isAnb2(token: string): boolean {
  return token.startsWith('ANB2.')
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

/**
 * Verifies a panel licence for this device. Throws an Error whose message the activation screen
 * maps to a user-facing text (wrong device, expired, product, app version, invalid).
 * Returns the payload for a token that is currently usable; an expired subscription throws only
 * when `allowExpired` is false (status checks pass true and compare exp themselves).
 */
export function verifyAnb2(
  token: string,
  opts: { keys: PanelKey[]; deviceId: string; appVersion: string; nowSeconds: number; allowExpired?: boolean }
): Anb2Payload {
  if (token.length > MAX_TOKEN) throw new Error('Invalid license code format')
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== 'ANB2') throw new Error('Invalid license code format')
  let header: { alg?: string; kid?: string; typ?: string }
  let payload: Anb2Payload
  try {
    header = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    payload = JSON.parse(Buffer.from(parts[2], 'base64url').toString('utf8'))
  } catch {
    throw new Error('Invalid license code format')
  }
  if (header.alg !== 'Ed25519' || header.typ !== 'ANB-ENT') throw new Error('Invalid license code format')
  const key = opts.keys.find((k) => k.kid === header.kid)
  if (!key || key.retired) throw new Error('Invalid license code signature')
  const raw = Buffer.from(key.publicKey, 'base64')
  if (raw.length !== 32) throw new Error('Invalid license code signature')
  const publicKey = createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, raw]), format: 'der', type: 'spki' })
  if (!verify(null, Buffer.from(`${parts[1]}.${parts[2]}`, 'ascii'), publicKey, Buffer.from(parts[3], 'base64url'))) {
    throw new Error('Invalid license code signature')
  }
  if (payload.v !== 2) throw new Error('Unsupported license code version')
  if (payload.prod !== PRODUCT) throw new Error('This license code is for a different product')
  if (payload.dev !== opts.deviceId) throw new Error('This license code belongs to a different device')
  if (!SUPPORTED_FPV.has(payload.fpv)) throw new Error('Unsupported license code version')
  if (typeof payload.minApp !== 'string' || compareVersions(opts.appVersion, payload.minApp) < 0) {
    throw new Error('This license code needs a newer app version')
  }
  if (typeof payload.nbf !== 'number' || opts.nowSeconds < payload.nbf) throw new Error('This license code is not valid yet')
  if (payload.kind === 'perpetual') {
    if (payload.exp !== null) throw new Error('Invalid license code format')
  } else {
    if (typeof payload.exp !== 'number') throw new Error('Invalid license code format')
    if (!opts.allowExpired && opts.nowSeconds >= payload.exp) throw new Error('This license code has already expired')
  }
  return payload
}

/** Milliseconds, Infinity for a perpetual licence (used by the downgrade guard and the status). */
export function anb2ExpiryMs(payload: Anb2Payload): number {
  return payload.exp === null ? Number.POSITIVE_INFINITY : payload.exp * 1000
}
