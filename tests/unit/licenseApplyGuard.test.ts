import { describe, expect, it } from 'vitest'
import { APPLY_LIMIT, APPLY_WINDOW_MS, expiryRefusal, preApplyRefusal } from '../../src/main/licenseApplyGuard'

const NOW = Date.UTC(2026, 10, 10, 12, 0, 0)
const DAY = 24 * 60 * 60 * 1000

describe('license:apply guard (D-LIC-16)', () => {
  it('allows apply when no licence is installed', () => {
    expect(preApplyRefusal('missing', [], NOW)).toBeNull()
    expect(preApplyRefusal('expired', [], NOW)).toBeNull()
    expect(preApplyRefusal('invalid', [], NOW)).toBeNull()
  })

  it('refuses apply while the installed licence is valid', () => {
    expect(preApplyRefusal('valid', [], NOW)).toMatch(/already installed/)
  })

  it('refuses the 6th attempt within an hour', () => {
    const attempts = Array.from({ length: APPLY_LIMIT }, (_, i) => NOW - i * 60_000)
    expect(preApplyRefusal('missing', attempts, NOW)).toMatch(/Too many/)
  })

  it('allows again once old attempts leave the window, and prunes them', () => {
    const attempts = Array.from({ length: APPLY_LIMIT }, () => NOW - APPLY_WINDOW_MS)
    expect(preApplyRefusal('missing', attempts, NOW)).toBeNull()
    expect(attempts).toHaveLength(0)
  })

  it('accepts a code that expires later than the installed one', () => {
    const installed = new Date(NOW - DAY).toISOString()
    expect(expiryRefusal(installed, NOW + 30 * DAY, NOW)).toBeNull()
    expect(expiryRefusal(undefined, NOW + 30 * DAY, NOW)).toBeNull()
  })

  it('refuses an expiry downgrade', () => {
    const installed = new Date(NOW + 60 * DAY).toISOString()
    expect(expiryRefusal(installed, NOW + 30 * DAY, NOW)).toMatch(/earlier than the installed/)
  })

  it('refuses an already-expired code', () => {
    expect(expiryRefusal(undefined, NOW, NOW)).toMatch(/already expired/)
  })
})
