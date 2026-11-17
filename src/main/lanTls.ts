import { X509Certificate, createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { connect } from 'node:tls'

// LAN mode encryption: the main computer's database speaks TLS with its own self-signed certificate.
// The other tills pin that certificate when they join (first contact, checked by the security code
// both screens show), so nobody on the Wi-Fi can read the data or sit in the middle.

// Minimal DER writer: just what one self-signed X.509 v3 certificate needs.
const len = (n: number) => (n < 0x80 ? Buffer.from([n]) : n < 0x100 ? Buffer.from([0x81, n]) : Buffer.from([0x82, n >> 8, n & 0xff]))
const tlv = (tag: number, ...parts: Buffer[]) => {
  const body = Buffer.concat(parts)
  return Buffer.concat([Buffer.from([tag]), len(body.length), body])
}
const seq = (...p: Buffer[]) => tlv(0x30, ...p)
const int = (b: Buffer) => tlv(0x02, b[0] & 0x80 ? Buffer.concat([Buffer.from([0]), b]) : b)
const oid = (s: string) => {
  const [a, b, ...rest] = s.split('.').map(Number)
  const out = [a * 40 + b]
  for (const n of rest) {
    const bytes = [n & 0x7f]
    for (let v = n >> 7; v > 0; v >>= 7) bytes.unshift((v & 0x7f) | 0x80)
    out.push(...bytes)
  }
  return tlv(0x06, Buffer.from(out))
}
const ext = (id: string, critical: boolean, value: Buffer) =>
  seq(oid(id), ...(critical ? [tlv(0x01, Buffer.from([0xff]))] : []), tlv(0x04, value))
const pem = (label: string, der: Buffer) =>
  `-----BEGIN ${label}-----\n${der.toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END ${label}-----\n`

/** A new RSA-2048 self-signed certificate (RSA: the Windows TLS stack MongoDB uses accepts it). */
export function makeCertificate(): { cert: string; key: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const alg = seq(oid('1.2.840.113549.1.1.11'), Buffer.from([0x05, 0x00])) // sha256WithRSAEncryption
  const name = seq(tlv(0x31, seq(oid('2.5.4.3'), tlv(0x0c, Buffer.from('Pharmacy POS main computer')))))
  const serial = randomBytes(16)
  serial[0] &= 0x7f
  const tbs = seq(
    tlv(0xa0, int(Buffer.from([2]))), // v3
    int(serial),
    alg,
    name,
    seq(tlv(0x17, Buffer.from('260101000000Z')), tlv(0x18, Buffer.from('20991231235959Z'))),
    name,
    publicKey.export({ type: 'spki', format: 'der' }),
    tlv(0xa3, seq(
      ext('2.5.29.19', true, seq(tlv(0x01, Buffer.from([0xff])))), // CA: it is its own trust anchor
      ext('2.5.29.15', true, Buffer.from([0x03, 0x02, 0x02, 0xa4])), // digitalSignature, keyEncipherment, keyCertSign
      ext('2.5.29.37', false, seq(oid('1.3.6.1.5.5.7.3.1'))) // serverAuth
    ))
  )
  const der = seq(tbs, alg, tlv(0x03, Buffer.from([0]), sign('sha256', tbs, privateKey)))
  return { cert: pem('CERTIFICATE', der), key: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() }
}

/** Short code people compare on both screens: the first 6 bytes of the certificate's SHA-256. */
export function securityCode(certPem: string): string {
  const hex = createHash('sha256').update(new X509Certificate(certPem).raw).digest('hex').slice(0, 12).toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`
}

/** First contact with the main computer: read the certificate it presents (verified by the security code). */
export function fetchCertificate(host: string, port: number, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port, rejectUnauthorized: false, timeout: timeoutMs }, () => {
      const peer = socket.getPeerX509Certificate()
      socket.destroy()
      if (!peer) reject(new Error('DB_TLS_REQUIRED'))
      else resolve(peer.toString())
    })
    socket.on('timeout', () => socket.destroy(new Error('DB_UNREACHABLE')))
    socket.on('error', reject)
  })
}
