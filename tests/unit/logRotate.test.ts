import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { rotateIfLarge } from '../../src/main/logRotate'

const dir = mkdtempSync(join(tmpdir(), 'rotate-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('log rotation (Gate 1 S5)', () => {
  it('leaves small or missing files alone', async () => {
    const file = join(dir, 'small.log')
    writeFileSync(file, 'x')
    expect(await rotateIfLarge(file, 10)).toBe(false)
    expect(await rotateIfLarge(join(dir, 'missing.log'), 10)).toBe(false)
  })

  it('rotates past the limit and keeps at most N old files', async () => {
    const file = join(dir, 'app.log')
    for (let i = 1; i <= 5; i++) {
      writeFileSync(file, `gen${i}-`.padEnd(20, 'x'))
      expect(await rotateIfLarge(file, 10, 3)).toBe(true)
    }
    expect(existsSync(file)).toBe(false)
    expect(readFileSync(`${file}.1`, 'utf8')).toMatch(/^gen5/)
    expect(readFileSync(`${file}.3`, 'utf8')).toMatch(/^gen3/)
    expect(existsSync(`${file}.4`)).toBe(false)
  })
})
