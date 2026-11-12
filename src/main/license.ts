import { app } from 'electron'
import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { networkInterfaces } from 'node:os'
import type { LicenseState } from '../shared/ipc'
import { logAudit } from './auth'
import { expiryRefusal, preApplyRefusal } from './licenseApplyGuard'

const execFileAsync = promisify(execFile)

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA61OdJ1imcoCzYW6DImq2veDwk0fFfe9YdXeevRMyK98=
-----END PUBLIC KEY-----`

const LICENSE_FILE = () => join(app.getPath('userData'), 'license.json')

interface HardwareInfo {
  deviceId: string
}

interface LicensePayload {
  v: number
  lid: string
  dev: string
  exp: number
}

let cached: Promise<HardwareInfo> | null = null

function normalize(value?: string): string {
  return value ? value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : ''
}

function computeDeviceId(ids: { mac?: string; disk?: string; board?: string; bios?: string }): string {
  // ponytail: board/BIOS only, so USB/dock/disk changes don't break the license; disk then MAC are fallbacks
  const serials = [ids.board, ids.bios].map(normalize).filter(Boolean)
  const fallback = [ids.disk].map(normalize).filter(Boolean)
  const parts = serials.length ? serials : fallback
  const base = parts.length ? JSON.stringify({ v: 1, hw: parts }) : JSON.stringify({ v: 1, mac: normalize(ids.mac) })
  return createHash('sha256').update(base).digest('hex').slice(0, 32)
}

function fallbackMac(): string {
  const macs: string[] = []
  for (const list of Object.values(networkInterfaces())) {
    for (const item of list ?? []) {
      if (!item.internal && item.mac && item.mac !== '00:00:00:00:00:00') macs.push(item.mac)
    }
  }
  macs.sort()
  return macs[0] ?? ''
}

const PS_SCRIPT = [
  '$ErrorActionPreference = "SilentlyContinue"',
  '$macs = @(Get-CimInstance Win32_NetworkAdapter | Where-Object { $_.PhysicalAdapter -and $_.MACAddress } | ForEach-Object { $_.MACAddress }) | Sort-Object',
  '$disk = Get-CimInstance Win32_DiskDrive | Where-Object { $_.SerialNumber -and $_.MediaType -notmatch "Removable" } | Select-Object -First 1 -ExpandProperty SerialNumber',
  '$board = Get-CimInstance Win32_ComputerSystemProduct | Select-Object -First 1 -ExpandProperty UUID',
  '$bios = Get-CimInstance Win32_BIOS | Select-Object -First 1 -ExpandProperty SerialNumber',
  'ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ mac = ($macs | Select-Object -First 1); disk = $disk; board = $board; bios = $bios })'
].join('; ')

async function readHardwareIds(): Promise<{ mac?: string; disk?: string; board?: string; bios?: string }> {
  if (process.platform !== 'win32') return { mac: fallbackMac() }
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT],
      { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 }
    )
    const parsed = JSON.parse(stdout.trim()) as { mac?: string; disk?: string; board?: string; bios?: string }
    return {
      mac: parsed.mac || fallbackMac(),
      disk: parsed.disk,
      board: parsed.board,
      bios: parsed.bios
    }
  } catch {
    return { mac: fallbackMac() }
  }
}

export function getHardwareInfo(): Promise<HardwareInfo> {
  if (!cached) {
    cached = readHardwareIds().then((ids) => ({ deviceId: computeDeviceId(ids) }))
  }
  return cached
}

function devBypass(): boolean {
  return !app.isPackaged && process.env['LICENSE_ENFORCE'] !== '1'
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

function verifyCode(code: string, deviceId: string): LicensePayload {
  const parts = code.trim().split('.')
  if (parts.length !== 3 || parts[0] !== 'PHM1') throw new Error('Invalid license code format')
  const payloadBytes = decodeBase64Url(parts[1])
  const signature = decodeBase64Url(parts[2])
  const key = createPublicKey(PUBLIC_KEY_PEM)
  if (!verifySignature(null, payloadBytes, key, signature)) throw new Error('Invalid license code signature')
  const payload = JSON.parse(payloadBytes.toString('utf8')) as LicensePayload
  if (payload.v !== 1) throw new Error('Unsupported license code version')
  if (payload.dev !== deviceId) throw new Error('This license code belongs to a different device')
  return payload
}

async function readStoredCode(): Promise<string | null> {
  try {
    const raw = await readFile(LICENSE_FILE(), 'utf8')
    const parsed = JSON.parse(raw) as { code?: string }
    return typeof parsed.code === 'string' ? parsed.code : null
  } catch {
    return null
  }
}

function validState(info: HardwareInfo, payload: LicensePayload): LicenseState {
  return {
    status: 'valid',
    deviceId: info.deviceId,
    licenseId: payload.lid,
    expiresAt: new Date(payload.exp).toISOString()
  }
}

function expiredState(info: HardwareInfo, payload: LicensePayload): LicenseState {
  return {
    ...validState(info, payload),
    status: 'expired'
  }
}

export async function getLicenseState(): Promise<LicenseState> {
  if (devBypass()) return { status: 'valid', deviceId: 'dev' }

  const info = await getHardwareInfo()
  const code = await readStoredCode()
  if (!code) return { status: 'missing', deviceId: info.deviceId }

  try {
    const payload = verifyCode(code, info.deviceId)
    return payload.exp > Date.now() ? validState(info, payload) : expiredState(info, payload)
  } catch {
    return { status: 'invalid', deviceId: info.deviceId }
  }
}

// shortcut: in-memory, so an app restart resets the 5/hour limit; acceptable because B3 removes license:apply.
const applyAttempts: number[] = []

export async function applyLicenseCode(code: string): Promise<LicenseState> {
  const now = Date.now()
  const current = await getLicenseState()
  let refusal = preApplyRefusal(current.status, applyAttempts, now)
  applyAttempts.push(now)
  const info = await getHardwareInfo()
  let payload: LicensePayload | undefined
  if (!refusal) {
    try {
      payload = verifyCode(String(code ?? ''), info.deviceId)
      refusal = expiryRefusal(current.expiresAt, payload.exp, now)
    } catch (error) {
      refusal = error instanceof Error ? error.message : String(error)
    }
  }
  // Audit before writing: if the audit fails, nothing is installed. The code itself is never logged.
  await logAudit({
    actorUsername: 'system:license-apply',
    action: 'license.apply',
    resource: 'license',
    resourceId: payload?.lid,
    details: { outcome: refusal ? 'refused' : 'accepted', reason: refusal ?? undefined, previousStatus: current.status }
  })
  if (refusal || !payload) throw new Error(refusal ?? 'License code rejected')
  await writeFile(LICENSE_FILE(), JSON.stringify({ code: code.trim(), appliedAt: new Date().toISOString() }, null, 2), 'utf8')
  return validState(info, payload)
}

export async function hasValidLicense(): Promise<boolean> {
  if (devBypass()) return true
  const state = await getLicenseState()
  return state.status === 'valid'
}
