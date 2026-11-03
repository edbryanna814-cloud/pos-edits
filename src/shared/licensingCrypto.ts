const FP_VERSION = 1

function norm(v?: string): string | undefined {
  if (!v) return undefined
  return v.trim().toLowerCase().replace(/[^a-z0-9:-]/g, '')
}

function sha256(s: string): string {
  const crypto = (globalThis as any).require ? (globalThis as any).require('crypto') : null
  if (crypto) return crypto.createHash('sha256').update(s).digest('hex')
  // fallback
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 131542391 + s.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(64, '0')
}

function hmacSha256(s: string, key: string): string {
  const crypto = (globalThis as any).require ? (globalThis as any).require('crypto') : null
  if (crypto) return crypto.createHmac('sha256', key).update(s).digest('hex')
  return sha256(s + ':' + key)
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const crypto = (globalThis as any).require ? (globalThis as any).require('crypto') : null
  if (crypto && (globalThis as any).Buffer) {
    try { return crypto.timingSafeEqual((globalThis as any).Buffer.from(a), (globalThis as any).Buffer.from(b)) } catch {}
  }
  let res = 0
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return res === 0
}

export function hashFingerprint(parts: { diskSerial?: string; motherboardUuid?: string; biosSerial?: string; macAddress?: string; osMachineId?: string }): { hash: string; parts: any } {
  const p = {
    diskSerial: norm(parts.diskSerial),
    motherboardUuid: norm(parts.motherboardUuid),
    biosSerial: norm(parts.biosSerial),
    macAddress: norm(parts.macAddress),
    osMachineId: norm(parts.osMachineId)
  }
  const base = JSON.stringify({ v: FP_VERSION, ...p })
  const hash = sha256(base)
  return { hash, parts: p }
}

export function signEntitlement(payload: any, key: string): string {
  return hmacSha256(JSON.stringify(payload), key)
}

export function verifyEntitlement(payload: any, signature: string, key: string): boolean {
  try {
    const expected = signEntitlement(payload, key)
    return timingSafeEqualHex(signature, expected)
  } catch {
    return false
  }
}
