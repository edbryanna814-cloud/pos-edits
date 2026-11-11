import { describe, expect, it } from 'vitest'
import { IPC } from '../../src/shared/ipc'

describe('smoke', () => {
  it('loads shared app code under Vitest', () => {
    expect(IPC.LicenseStatus).toBe('license:status')
  })
})
