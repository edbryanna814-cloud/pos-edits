import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const dir = join(homedir(), '.pharmacy-pos-license')
const privatePath = join(dir, 'private.pem')
const publicPath = join(dir, 'public.pem')
const force = process.argv.includes('--force')

if (existsSync(privatePath) && !force) {
  console.error(`Private key already exists: ${privatePath}`)
  console.error('Refusing to overwrite. Use --force only if you intend to invalidate every existing license code.')
  process.exit(1)
}

mkdirSync(dir, { recursive: true })
const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' })
const publicPem = publicKey.export({ type: 'spki', format: 'pem' })

writeFileSync(privatePath, privatePem)
writeFileSync(publicPath, publicPem)

console.log(`Private key: ${privatePath}`)
console.log(`Public key:  ${publicPath}`)
console.log('Back up the private key. Keep it out of the app folder and never ship it.')
console.log('')
console.log('Public key (must match PUBLIC_KEY_PEM in src/main/license.ts):')
console.log(publicPem)
