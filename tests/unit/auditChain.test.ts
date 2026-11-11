import { describe, expect, it } from 'vitest'
import { GENESIS, chainEntry, verifyChain } from '../../src/main/auditChain'

function build(n: number) {
  const entries: ReturnType<typeof chainEntry>[] = []
  for (let i = 0; i < n; i++) {
    const prev = entries.at(-1)
    entries.push(chainEntry({ action: `a${i}`, resource: 'r', createdAt: `2026-11-11T00:00:0${i}Z`, details: { i } }, prev ? { seq: prev.seq, hash: prev.hash } : null))
  }
  return entries
}

describe('audit hash chain (Gate 1 S5)', () => {
  it('links entries from genesis and verifies', () => {
    const entries = build(4)
    expect(entries[0].prevHash).toBe(GENESIS)
    expect(entries[1].prevHash).toBe(entries[0].hash)
    expect(verifyChain(entries)).toEqual({ ok: true, checked: 4, unchained: 0 })
    expect(verifyChain([...entries].reverse()).ok).toBe(true) // order of input does not matter
  })

  it('detects an edited entry', () => {
    const entries = build(4)
    ;(entries[2].details as any).i = 99
    expect(verifyChain(entries)).toMatchObject({ ok: false, brokenAtSeq: 3, reason: 'hash mismatch (entry edited)' })
  })

  it('detects a deleted entry', () => {
    const entries = build(4)
    entries.splice(1, 1)
    expect(verifyChain(entries)).toMatchObject({ ok: false, brokenAtSeq: 2 })
  })

  it('detects a forged entry with a recomputed own hash', () => {
    const entries = build(3)
    const forged = chainEntry({ action: 'forged', resource: 'r', createdAt: 'x' }, { seq: 1, hash: 'f'.repeat(64) })
    entries[1] = forged
    expect(verifyChain(entries)).toMatchObject({ ok: false, brokenAtSeq: 2, reason: 'prevHash mismatch' })
  })

  it('counts pre-Gate-1 entries as unchained, not as tampering', () => {
    expect(verifyChain([{ action: 'old', createdAt: 'x' }, ...build(2)])).toEqual({ ok: true, checked: 2, unchained: 1 })
  })
})
