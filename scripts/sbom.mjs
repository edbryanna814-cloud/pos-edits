// Gate 1 S1: CycloneDX SBOM for the shipped app plus a licence check.
// `npm sbom` covers the npm production tree only, so the runtime components that ship
// beside it are added here: Electron (with Chromium/Node/V8), the bundled MongoDB server,
// and the Microsoft VC++ runtime DLLs copied by scripts/prepare-mongodb.ps1.
// Usage: node scripts/sbom.mjs [outFile]   (default release/sbom.cdx.json)
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const MONGODB_VERSION = '9.0.8' // pinned in scripts/prepare-mongodb.ps1
const out = process.argv[2] ?? join('release', 'sbom.cdx.json')

// Fixed command string (no user input); execSync so npm.cmd resolves on Windows.
const sbom = JSON.parse(execSync('npm sbom --sbom-format cyclonedx --omit dev', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))

const electronVersion = JSON.parse(readFileSync('node_modules/electron/package.json', 'utf8')).version
let mongodVersion = MONGODB_VERSION
const vendored = join('vendor', 'mongodb', 'mongod.exe')
if (existsSync(vendored)) {
  const match = /db version v(\d+\.\d+\.\d+)/.exec(execFileSync(vendored, ['--version'], { encoding: 'utf8' }))
  if (match) mongodVersion = match[1]
}

const runtime = [
  { name: 'electron', version: electronVersion, license: 'MIT', purl: `pkg:npm/electron@${electronVersion}`, note: 'Runtime; bundles Chromium, Node.js and V8 (see electron LICENSES.chromium.html in the package).' },
  { name: 'mongodb-server', version: mongodVersion, license: 'SSPL-1.0', purl: `pkg:generic/mongodb/mongodb-server@${mongodVersion}`, note: 'Bundled mongod.exe (vendor/mongodb). SSPL: owner legal decision required before distribution.' },
  { name: 'microsoft-vc-runtime', version: '14.x', license: 'LicenseRef-Microsoft-VC-Redistributable', purl: 'pkg:generic/microsoft/vc-runtime@14', note: 'vcruntime140*.dll / msvcp140*.dll copied beside mongod.exe.' }
]
for (const c of runtime) {
  sbom.components.push({
    type: c.name === 'electron' ? 'framework' : 'application',
    name: c.name,
    version: c.version,
    purl: c.purl,
    'bom-ref': c.purl,
    licenses: [c.license.startsWith('LicenseRef-') ? { license: { name: c.license } } : { license: { id: c.license } }],
    properties: [{ name: 'pharmacy-pos:note', value: c.note }]
  })
}

// Licence check over every component. SSPL is allowed into the SBOM but flagged: no distribution
// until the owner has a written legal opinion or a commercial licence (TD, 2026-11-11).
const ALLOWED = new Set(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'BlueOak-1.0.0'])
const FLAGGED = new Map([['SSPL-1.0', 'owner legal decision required'], ['LicenseRef-Microsoft-VC-Redistributable', 'Microsoft redistributable terms']])
const summary = new Map()
const problems = []
for (const c of sbom.components) {
  const ids = (c.licenses ?? []).map((l) => l.license?.id ?? l.license?.name ?? l.expression).filter(Boolean)
  const key = ids.join(' OR ') || 'UNKNOWN'
  summary.set(key, (summary.get(key) ?? 0) + 1)
  if (!ids.length) problems.push(`${c.name}@${c.version}: no licence`)
  else if (!ids.some((id) => ALLOWED.has(id) || FLAGGED.has(id))) problems.push(`${c.name}@${c.version}: ${key} not in allowlist`)
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(sbom, null, 2))
console.log(`SBOM: ${out} (CycloneDX ${sbom.specVersion}, ${sbom.components.length} components)`)
for (const [license, count] of [...summary].sort()) console.log(`  ${license}: ${count}${FLAGGED.has(license) ? `  [FLAG: ${FLAGGED.get(license)}]` : ''}`)
if (problems.length) {
  console.error(`licence check FAILED:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('licence check ok (flags above need owner action before distribution)')
