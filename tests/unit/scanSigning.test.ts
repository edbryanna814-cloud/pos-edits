import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

// Planted inputs are built at runtime from random bytes: no real key, and this file does not trip the scan.
const dir = mkdtempSync(join(tmpdir(), 'scan-signing-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function plant(name: string, text: string): string {
  const file = join(dir, name)
  writeFileSync(file, text)
  return file
}

function scan(...files: string[]) {
  return spawnSync(process.execPath, ['scripts/scan-signing.mjs', ...files], { encoding: 'utf8' })
}

const header = (edge: 'BEGIN' | 'END') => `-----${edge} ` + 'PRIVATE KEY-----'
const body = randomBytes(48).toString('base64')

describe('signing scan', () => {
  it('fails on a planted private key block with a base64 body', () => {
    const r = scan(plant('leak.pem.txt', `${header('BEGIN')}\n${body}\n${header('END')}\n`))
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/private key block/)
  })

  it('fails on a key block embedded in source with an escaped newline', () => {
    const r = scan(plant('leak.ts', `const k = '${header('BEGIN')}\\n${body}'\n`))
    expect(r.status).toBe(1)
  })

  it('fails on key generation or private key loading in code', () => {
    const r = scan(plant('mint.ts', `import { generate${'KeyPair'}Sync } from 'node:crypto'\n`))
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/key generation/)
    expect(scan(plant('load.mjs', `create${'PrivateKey'}(pem)\n`)).status).toBe(1)
  })

  it('fails on any scripts/license-*.mjs path', () => {
    const r = scan('scripts/license-generator.mjs')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/issuance script/)
  })

  it('allows a bare header mention in prose', () => {
    const r = scan(plant('rule.md', `CI fails on \`${header('BEGIN')}\` followed by key material.\n`))
    expect(r.status).toBe(0)
  })

  it('passes on the tracked repository', () => {
    const r = scan()
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
  })
})
