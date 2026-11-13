import { panelSignatureOk, PRODUCT, type PanelKey } from './anb2'

// Forgotten administrator password (passwords are one-way hashes: they can be reset, never read back).
// The sign-in screen shows this device's code and a one-time request code; the vendor signs a reset code
// for exactly that device + request in the license panel (product signing key + passphrase). Only a code
// signed by the panel unlocks the reset, so a seller at the till cannot reset the administrator alone.
// No Electron imports: unit-tested.

export type ResetPayload = { v: 1; prod: string; dev: string; req: string; iat: number; exp: number }

export const RESET_ERRORS = {
  invalid: 'RESET_CODE_INVALID',
  device: 'RESET_CODE_WRONG_DEVICE',
  request: 'RESET_CODE_WRONG_REQUEST',
  expired: 'RESET_CODE_EXPIRED',
  locked: 'RESET_NOT_UNLOCKED'
} as const

/** RST1.<b64url header>.<b64url payload>.<b64url Ed25519 sig>, header typ ANB-RST. */
export function verifyResetCode(
  input: unknown,
  opts: { keys: PanelKey[]; deviceId: string; requestCode: string; nowSeconds: number }
): ResetPayload {
  const token = String(input ?? '').replace(/\s+/g, '')
  const parts = token.split('.')
  if (token.length > 4096 || parts.length !== 4 || parts[0] !== 'RST1') throw new Error(RESET_ERRORS.invalid)
  let header: { alg?: string; kid?: string; typ?: string }
  let payload: ResetPayload
  try {
    header = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    payload = JSON.parse(Buffer.from(parts[2], 'base64url').toString('utf8'))
  } catch {
    throw new Error(RESET_ERRORS.invalid)
  }
  if (header.alg !== 'Ed25519' || header.typ !== 'ANB-RST') throw new Error(RESET_ERRORS.invalid)
  if (!panelSignatureOk(parts, header.kid, opts.keys)) throw new Error(RESET_ERRORS.invalid)
  if (payload.v !== 1 || payload.prod !== PRODUCT) throw new Error(RESET_ERRORS.invalid)
  if (payload.dev !== opts.deviceId) throw new Error(RESET_ERRORS.device)
  if (payload.req !== opts.requestCode) throw new Error(RESET_ERRORS.request)
  // Short-lived: at most 2 hours from signing; a small allowance for clock differences.
  if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number' || payload.exp - payload.iat > 7200) throw new Error(RESET_ERRORS.invalid)
  if (opts.nowSeconds >= payload.exp || opts.nowSeconds < payload.iat - 600) throw new Error(RESET_ERRORS.expired)
  return payload
}
