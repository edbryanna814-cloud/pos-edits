import { describe, expect, it } from 'vitest'
import { X509Certificate } from 'node:crypto'
import { connect, createServer } from 'node:tls'
import type { AddressInfo } from 'node:net'
import { fetchCertificate, makeCertificate, securityCode } from '../../src/main/lanTls'

describe('LAN TLS certificate', () => {
  const { cert, key } = makeCertificate()

  it('is a valid self-signed CA certificate', () => {
    const x = new X509Certificate(cert)
    expect(x.ca).toBe(true)
    expect(x.verify(x.publicKey)).toBe(true)
    expect(x.subject).toContain('Pharmacy POS main computer')
    expect(new Date(x.validTo).getUTCFullYear()).toBe(2099)
    expect(securityCode(cert)).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/)
    expect(securityCode(makeCertificate().cert)).not.toBe(securityCode(cert))
  })

  it('a pinned client trusts it, and a client pinning another certificate refuses', async () => {
    const server = createServer({ cert, key }, (s) => s.end('ok'))
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as AddressInfo).port
    const hello = (ca: string) =>
      new Promise<string>((resolve, reject) => {
        // Hostnames are not checked (the main PC's IP changes); the pinned certificate is the check.
        const s = connect({ host: '127.0.0.1', port, ca, checkServerIdentity: () => undefined }, () => s.once('data', (d) => resolve(String(d))))
        s.on('error', reject)
      })
    try {
      expect(await fetchCertificate('127.0.0.1', port)).toBe(new X509Certificate(cert).toString())
      expect(await hello(cert)).toBe('ok')
      await expect(hello(makeCertificate().cert)).rejects.toThrow()
    } finally {
      server.close()
    }
  })
})
