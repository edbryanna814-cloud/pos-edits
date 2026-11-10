// C0 containment scan (ADR-001 E1, NFR-LIC-012): no signing material or issuance code in this repo.
// Usage: node scripts/scan-signing.mjs [files...]   (no args = every git-tracked file)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Patterns are split so this file does not match itself.
// A key block needs a base64 body (real line break or an escaped \n in source); a bare header in prose is allowed.
const KEY_BLOCK = new RegExp('-----BEGIN [A-Z0-9 ]*' + 'PRIVATE KEY-----[ \\t]*(?:\\r?\\n|\\\\n)[ \\t]*[A-Za-z0-9+/=]{40,}')
const ISSUANCE_CALL = new RegExp('\\b(?:generate' + 'KeyPair(?:Sync)?|create' + 'PrivateKey)\\b')
const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/i
const ISSUANCE_SCRIPT = /^scripts\/license-[^/]*\.mjs$/

const args = process.argv.slice(2)
const files = args.length
  ? args
  : execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)

const problems = []
for (const file of files) {
  const path = file.replace(/\\/g, '/')
  if (ISSUANCE_SCRIPT.test(path)) problems.push(`${path}: licence issuance script must not exist in this repo`)
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  if (KEY_BLOCK.test(text)) problems.push(`${path}: private key block with key material`)
  if (CODE_FILE.test(path) && ISSUANCE_CALL.test(text)) problems.push(`${path}: key generation / private key loading in code`)
}

if (problems.length) {
  console.error(`signing scan FAILED (${problems.length}):`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log(`signing scan ok: ${files.length} files`)
