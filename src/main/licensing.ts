import { randomUUID } from 'node:crypto'
import type { Db } from 'mongodb'
import { getClient, getDb } from './db'
import { logAudit } from './auth'
import { hashFingerprint, signEntitlement } from '../shared/licensingCrypto'
import type { DeviceActivation, License, ReplacementRequest, SignedEntitlement } from '../shared/licensing'

const LICENSES = 'lic_licenses'
const DEVICES = 'lic_devices'
const REPL = 'lic_replacements'

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

function withStringId<T>(doc: T): T {
  return { ...doc, _id: String((doc as { _id?: unknown })._id) }
}

function requireText(value: unknown, field: string): string {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${field} is required`)
  return text
}

function toDeviceLimit(value: unknown): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) throw new Error('Device limit must be an integer of 1 or more')
  return n
}

const SIGNING_KEY = process.env.LICENSING_SIGNING_KEY || 'dev-licensing-signing-key-change-me'
const PUB_KEY = process.env.LICENSING_PUBLIC_KEY || SIGNING_KEY

export async function ensureLicensingSchema(): Promise<void> {
  const db = requireDb()
  const cols = await db.listCollections({ name: { $in: [LICENSES, DEVICES, REPL] } }).toArray()
  const names = new Set(cols.map((c) => c.name))
  if (!names.has(LICENSES)) await db.createCollection(LICENSES)
  if (!names.has(DEVICES)) await db.createCollection(DEVICES)
  if (!names.has(REPL)) await db.createCollection(REPL)
  await db.collection(LICENSES).createIndex({ licenseId: 1 }, { unique: true }).catch(() => {})
  await db.collection(DEVICES).createIndex({ licenseId: 1 }).catch(() => {})
  await db.collection(DEVICES).createIndex({ fingerprintHash: 1 }).catch(() => {})
  await db.collection(REPL).createIndex({ requestId: 1 }, { unique: true }).catch(() => {})
}

export async function listLicenses(): Promise<License[]> {
  const db = requireDb()
  return (await db.collection<License>(LICENSES).find({}).sort({ createdAt: -1 }).toArray()).map(withStringId)
}

export async function createLicense(input: Partial<License>): Promise<License> {
  const db = requireDb()
  const now = new Date().toISOString()
  const statuses: License['status'][] = ['pending', 'active', 'suspended', 'expired', 'revoked']
  const lic: any = {
    licenseId: input.licenseId ? requireText(input.licenseId, 'License ID') : randomUUID(),
    customerId: input.customerId ? String(input.customerId) : undefined,
    subscriptionId: input.subscriptionId ? String(input.subscriptionId) : undefined,
    maxActiveDevices: toDeviceLimit(input.maxActiveDevices ?? 1),
    currentActiveDeviceCount: 0,
    status: statuses.includes(input.status as License['status']) ? input.status : 'active',
    createdAt: now,
    updatedAt: now
  }
  let insertedId: string
  try {
    const r = await db.collection(LICENSES).insertOne(lic)
    insertedId = r.insertedId.toString()
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) throw new Error('License ID already exists')
    throw error
  }
  await logAudit({ action: 'license.create', resource: 'lic_licenses', resourceId: lic.licenseId })
  return { ...lic, _id: insertedId }
}

export async function configureDeviceLimit(licenseId: string, maxActiveDevices: number): Promise<License> {
  const db = requireDb()
  const limit = toDeviceLimit(maxActiveDevices)
  const lic = await db.collection<License>(LICENSES).findOne({ licenseId })
  if (!lic) throw new Error('License not found')
  if (limit < lic.currentActiveDeviceCount) throw new Error('Device limit cannot be below the number of active devices')
  const result = await db.collection<License>(LICENSES).findOneAndUpdate(
    { licenseId },
    { $set: { maxActiveDevices: limit, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  )
  if (!result) throw new Error('License not found')
  await logAudit({ action: 'license.limit.configure', resource: 'lic_licenses', resourceId: licenseId, details: { maxActiveDevices: limit } })
  return withStringId(result)
}

export async function activateDevice(input: { licenseId: string; fingerprint: any; deviceDisplayName?: string; os?: string }): Promise<{ entitlement: SignedEntitlement; device: DeviceActivation }> {
  const db = requireDb()
  const licenseId = requireText(input?.licenseId, 'License')
  const lic = await db.collection<License>(LICENSES).findOne({ licenseId })
  if (!lic) throw new Error('License not found')
  if (lic.status !== 'active') throw new Error('License not active')
  const now = new Date().toISOString()
  const { hash } = hashFingerprint(input.fingerprint || {})
  const existing = await db.collection<DeviceActivation>(DEVICES).findOne({ licenseId, fingerprintHash: hash, activationStatus: 'active' })
  if (existing) {
    await db.collection(DEVICES).updateOne({ _id: existing._id } as any, { $set: { lastValidationDate: now } })
    const activeCount = await db.collection<DeviceActivation>(DEVICES).countDocuments({ licenseId, activationStatus: 'active' })
    if (activeCount !== lic.currentActiveDeviceCount) {
      await db.collection<License>(LICENSES).updateOne({ licenseId }, { $set: { currentActiveDeviceCount: activeCount, updatedAt: now } })
    }
    const payload = { licenseId, deviceId: existing.deviceId, status: lic.status, maxActiveDevices: lic.maxActiveDevices, currentActiveDeviceCount: activeCount, fingerprintHash: hash, issuedAt: now, keyVersion: 1 }
    return { entitlement: { ...payload, signature: signEntitlement(payload, SIGNING_KEY) }, device: withStringId(existing) }
  }

  const client = getClient()
  if (!client) throw new Error('Database unavailable')
  const session = client.startSession()
  let deviceId: string
  try {
    deviceId = await session.withTransaction(async () => {
      const activeCount = await db.collection<DeviceActivation>(DEVICES).countDocuments({ licenseId, activationStatus: 'active' }, { session })
      if (activeCount >= lic.maxActiveDevices) throw new Error('Device limit reached')
      const id = randomUUID()
      await db.collection(DEVICES).insertOne(
        {
          deviceId: id,
          licenseId,
          fingerprintHash: hash,
          fingerprintVersion: 1,
          deviceDisplayName: input.deviceDisplayName ? String(input.deviceDisplayName) : undefined,
          os: input.os ? String(input.os) : undefined,
          activationDate: now,
          lastValidationDate: now,
          activationStatus: 'active'
        } as any,
        { session }
      )
      await db.collection<License>(LICENSES).updateOne(
        { licenseId },
        { $set: { currentActiveDeviceCount: activeCount + 1, updatedAt: now } },
        { session }
      )
      return id
    })
  } finally {
    await session.endSession()
  }
  const activeCount = await db.collection<DeviceActivation>(DEVICES).countDocuments({ licenseId, activationStatus: 'active' })
  const payload = { licenseId, deviceId, status: lic.status, maxActiveDevices: lic.maxActiveDevices, currentActiveDeviceCount: activeCount, fingerprintHash: hash, issuedAt: now, keyVersion: 1 }
  await logAudit({ action: 'license.device.activate', resource: 'lic_devices', resourceId: deviceId })
  return {
    entitlement: { ...payload, signature: signEntitlement(payload, SIGNING_KEY) },
    device: {
      _id: deviceId,
      deviceId,
      licenseId,
      fingerprintHash: hash,
      fingerprintVersion: 1,
      deviceDisplayName: input.deviceDisplayName,
      os: input.os,
      activationDate: now,
      lastValidationDate: now,
      activationStatus: 'active'
    }
  }
}

export async function listDevices(licenseId?: string): Promise<DeviceActivation[]> {
  const db = requireDb()
  const q: any = {}
  if (licenseId) q.licenseId = String(licenseId)
  return (await db.collection<DeviceActivation>(DEVICES).find(q).sort({ activationDate: -1 }).toArray()).map(withStringId)
}

export async function revokeDevice(deviceId: string, reason: string): Promise<void> {
  const db = requireDb()
  const why = requireText(reason, 'Revocation reason')
  const dev = await db.collection<DeviceActivation>(DEVICES).findOne({ deviceId })
  if (!dev) throw new Error('Device not found')
  if (dev.activationStatus === 'revoked') throw new Error('Device is already revoked')
  const now = new Date().toISOString()
  await db.collection(DEVICES).updateOne(
    { deviceId },
    { $set: { activationStatus: 'revoked', deactivationDate: now, deactivationReason: why } }
  )
  if (dev.activationStatus === 'active') {
    const activeCount = await db.collection<DeviceActivation>(DEVICES).countDocuments({ licenseId: dev.licenseId, activationStatus: 'active' })
    await db.collection<License>(LICENSES).updateOne({ licenseId: dev.licenseId }, { $set: { currentActiveDeviceCount: activeCount, updatedAt: now } })
  }
  await logAudit({ action: 'license.device.revoke', resource: 'lic_devices', resourceId: deviceId, details: { reason: why } })
}

export async function requestReplacement(input: { licenseId: string; existingDeviceId: string; requestedFingerprint: any; reason: string }): Promise<ReplacementRequest> {
  const db = requireDb()
  const licenseId = requireText(input?.licenseId, 'License')
  const existingDeviceId = requireText(input?.existingDeviceId, 'Existing device')
  const reason = requireText(input?.reason, 'Replacement reason')
  const lic = await db.collection<License>(LICENSES).findOne({ licenseId })
  if (!lic) throw new Error('License not found')
  const device = await db.collection<DeviceActivation>(DEVICES).findOne({ deviceId: existingDeviceId, licenseId })
  if (!device) throw new Error('Existing device not found for this license')
  if (device.activationStatus !== 'active') throw new Error('Existing device is not active')
  const now = new Date().toISOString()
  const { hash } = hashFingerprint(input.requestedFingerprint || {})
  const req: any = {
    requestId: randomUUID(),
    licenseId,
    existingDeviceId,
    requestedFingerprintHash: hash,
    requestedFingerprintVersion: 1,
    reason,
    requestDate: now,
    status: 'pending'
  }
  await db.collection(REPL).insertOne(req)
  await db.collection(DEVICES).updateOne({ deviceId: existingDeviceId }, { $set: { activationStatus: 'replacement_pending' } })
  await logAudit({ action: 'license.replacement.request', resource: 'lic_replacements', resourceId: req.requestId })
  return { ...req, _id: req.requestId }
}

export async function listReplacements(status?: string): Promise<ReplacementRequest[]> {
  const db = requireDb()
  const q: any = {}
  if (status) q.status = String(status)
  return (await db.collection<ReplacementRequest>(REPL).find(q).sort({ requestDate: -1 }).toArray()).map(withStringId)
}

export async function approveReplacement(requestId: string, reviewedBy: string, decisionReason: string): Promise<{ oldDeviceDeactivated: boolean; newDeviceEligible: boolean }> {
  const db = requireDb()
  const reviewer = requireText(reviewedBy, 'Reviewer')
  const reason = requireText(decisionReason, 'Decision reason')
  const req = await db.collection<ReplacementRequest>(REPL).findOne({ requestId })
  if (!req) throw new Error('Replacement request not found')
  if (req.status !== 'pending') throw new Error('Replacement request is not pending')
  const now = new Date().toISOString()
  await db.collection(DEVICES).updateOne(
    { deviceId: req.existingDeviceId },
    { $set: { activationStatus: 'inactive', deactivationDate: now, deactivationReason: 'replacement_approved' } }
  )
  const activeCount = await db.collection<DeviceActivation>(DEVICES).countDocuments({ licenseId: req.licenseId, activationStatus: 'active' })
  await db.collection<License>(LICENSES).updateOne(
    { licenseId: req.licenseId },
    { $set: { currentActiveDeviceCount: activeCount, updatedAt: now } }
  )
  await db.collection(REPL).updateOne(
    { requestId },
    { $set: { status: 'approved', reviewedBy: reviewer, reviewDate: now, decisionReason: reason } }
  )
  await logAudit({ action: 'license.replacement.approve', resource: 'lic_replacements', resourceId: requestId, details: { reviewedBy: reviewer } })
  return { oldDeviceDeactivated: true, newDeviceEligible: true }
}

export async function rejectReplacement(requestId: string, reviewedBy: string, decisionReason: string): Promise<void> {
  const db = requireDb()
  const reviewer = requireText(reviewedBy, 'Reviewer')
  const reason = requireText(decisionReason, 'Decision reason')
  const req = await db.collection<ReplacementRequest>(REPL).findOne({ requestId })
  if (!req) throw new Error('Replacement request not found')
  if (req.status !== 'pending') throw new Error('Replacement request is not pending')
  const now = new Date().toISOString()
  await db.collection(REPL).updateOne(
    { requestId },
    { $set: { status: 'rejected', reviewedBy: reviewer, reviewDate: now, decisionReason: reason } }
  )
  const device = await db.collection<DeviceActivation>(DEVICES).findOne({ deviceId: req.existingDeviceId })
  if (device && device.activationStatus === 'replacement_pending') {
    await db.collection(DEVICES).updateOne({ deviceId: req.existingDeviceId }, { $set: { activationStatus: 'active' } })
  }
  await logAudit({ action: 'license.replacement.reject', resource: 'lic_replacements', resourceId: requestId, details: { reviewedBy: reviewer } })
}
