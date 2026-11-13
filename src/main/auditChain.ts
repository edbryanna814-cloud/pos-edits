import { createHash } from 'node:crypto'

// Gate 1 S5: the audit log is a hash chain. Each entry stores seq, prevHash and
// hash = SHA-256(prevHash + canonical JSON of the entry without hash). Editing, deleting,
// reordering or inserting an entry breaks every later hash, which startup verification reports.
// Entries written before Gate 1 have no hash and are reported as unchained, not as tampering.

export const GENESIS = '0'.repeat(64)

type Entry = Record<string, unknown> & { seq?: number; prevHash?: string; hash?: string }

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj).filter((k) => obj[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`
}

export function entryHash(entry: Entry): string {
  const { hash: _hash, _id: _id, ...body } = entry
  return createHash('sha256').update(String(entry.prevHash ?? '')).update(canonical(body)).digest('hex')
}

export function chainEntry<T extends Record<string, unknown>>(entry: T, previous: { seq: number; hash: string } | null): T & { seq: number; prevHash: string; hash: string } {
  const linked = { ...entry, seq: (previous?.seq ?? 0) + 1, prevHash: previous?.hash ?? GENESIS }
  return { ...linked, hash: entryHash(linked) }
}

export type ChainReport = { ok: boolean; checked: number; unchained: number; brokenAtSeq?: number; reason?: string }

/** `entries` must be every audit document; order does not matter. */
export function verifyChain(entries: Entry[]): ChainReport {
  const chained = entries.filter((e) => typeof e.seq === 'number').sort((a, b) => (a.seq as number) - (b.seq as number))
  const unchained = entries.length - chained.length
  let previous = GENESIS
  for (let i = 0; i < chained.length; i++) {
    const e = chained[i]
    if (e.seq !== i + 1) return { ok: false, checked: i, unchained, brokenAtSeq: i + 1, reason: 'missing or duplicate entry' }
    if (e.prevHash !== previous) return { ok: false, checked: i, unchained, brokenAtSeq: e.seq, reason: 'prevHash mismatch' }
    if (e.hash !== entryHash(e)) return { ok: false, checked: i, unchained, brokenAtSeq: e.seq, reason: 'hash mismatch (entry edited)' }
    previous = e.hash as string
  }
  return { ok: true, checked: chained.length, unchained }
}
