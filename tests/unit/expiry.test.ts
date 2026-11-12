import { describe, expect, it } from 'vitest'
import { EXPIRY_WARNING_MONTHS, expiryState } from '../../src/shared/expiry'

const NOW = new Date('2026-11-12T10:00:00')

describe('product expiry warning (8 months)', () => {
  it('uses 8 months', () => expect(EXPIRY_WARNING_MONTHS).toBe(8))
  it('far dates are fine (the 2030 case)', () => expect(expiryState('2030-11-12', NOW)).toBe('ok'))
  it('just over 8 months is fine', () => expect(expiryState('2027-07-13', NOW)).toBe('ok'))
  it('under 8 months warns', () => expect(expiryState('2027-07-11', NOW)).toBe('soon'))
  it('today still counts as soon, yesterday is expired', () => {
    expect(expiryState('2026-11-12', NOW)).toBe('soon')
    expect(expiryState('2026-11-11', NOW)).toBe('expired')
  })
  it('missing or bad dates give no warning', () => {
    expect(expiryState(undefined, NOW)).toBe('none')
    expect(expiryState('not-a-date', NOW)).toBe('none')
  })
})
