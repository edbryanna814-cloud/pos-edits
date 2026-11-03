import type { Db } from 'mongodb'
import { getDb } from './db'
import { logAudit } from './auth'
import { hashFingerprint, signEntitlement } from '../shared/licensingCrypto'
import type { DeviceActivation, License, ReplacementRequest, SignedEntitlement } from '../shared/licensing'
import { randomUUID } from 'node:crypto'

const LICENSES = 'lic_licenses'
const DEVICES = 'lic_devices'
const REPL = 'lic_replacements'

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
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
}

export async function listLicenses(): Promise<License[]> {
  const db = requireDb()
  return db.collection<License>(LICENSES).find({}).toArray()
}

export async function createLicense(input: Partial<License>): Promise<License> {
  const db = requireDb()
  const now = new Date().toISOString()
  const lic: any = {
    licenseId: input.licenseId || randomUUID(),
    customerId: input.customerId,
    subscriptionId: input.subscriptionId,
    maxActiveDevices: Number(input.maxActiveDevices) || 1,
    currentActiveDeviceCount: 0,
    status: input.status || 'active',
    createdAt: now,
    updatedAt: now
  }
  const r = await db.collection(LICENSES).insertOne(lic)
  await logAudit({ action: 'license.create', resource: 'lic_licenses', resourceId: lic.licenseId })
  return { _id: r.insertedId.toString(), ...lic }
}

export async function configureDeviceLimit(licenseId: string, maxActiveDevices: number): Promise<License> {
  const db = requireDb()
  const now = new Date().toISOString()
  const { ObjectId } = await import('mongodb')
  const result = await db.collection<License>(LICENSES).findOneAndUpdate({ licenseId }, { $set: { maxActiveDevices: Number(maxActiveDevices), updatedAt: now } }, { returnDocument: 'after' } as any)
  if (!result) throw new Error('License not found')
  await logAudit({ action: 'license.limit.configure', resource: 'lic_licenses', resourceId: licenseId, details: { maxActiveDevices } })
  return result as any
}

export async function activateDevice(input: { licenseId: string; fingerprint: any; deviceDisplayName?: string; os?: string }): Promise<{ entitlement: SignedEntitlement; device: DeviceActivation }> {
  const db = requireDb()
  const now = new Date().toISOString()
  const lic = await db.collection<License>(LICENSES).findOne({ licenseId: input.licenseId })
  if (!lic) throw new Error('License not found')
  if (lic.status !== 'active') throw new Error('License not active')
  const { hash } = hashFingerprint(input.fingerprint || {})
  // check if already activated
  const existing = await db.collection<DeviceActivation>(DEVICES).findOne({ licenseId: input.licenseId, fingerprintHash: hash, activationStatus: 'active' })
  if (existing) {
    // re-validate
    await db.collection(DEVICES).updateOne({ _id: existing._id } as any, { $set: { lastValidationDate: now } })
    const payload = { licenseId: lic.licenseId, deviceId: existing.deviceId, status: lic.status, maxActiveDevices: lic.maxActiveDevices, currentActiveDeviceCount: lic.currentActiveDeviceCount, fingerprintHash: hash, issuedAt: now, keyVersion: 1 }
    const sig = signEntitlement(payload, SIGNING_KEY)
    return { entitlement: { ...payload, signature: sig }, device: existing }
  }
  const activeCount = await db.collection<DeviceActivation>(DEVICES).countDocuments({ licenseId: input.licenseId, activationStatus: 'active' })
  if (activeCount >= lic.maxActiveDevices) throw new Error('Device limit reached')
  const deviceId = randomUUID()
  const dev: any = { deviceId, licenseId: lic.licenseId, fingerprintHash: hash, fingerprintVersion: 1, deviceDisplayName: input.deviceDisplayName, os: input.os, activationDate: now, lastValidationDate: now, activationStatus: 'active' }
  await db.collection(DEVICES).insertOne(dev)
  await db.collection<License>(LICENSES).updateOne({ licenseId: lic.licenseId }, { $set: { currentActiveDeviceCount: activeCount + 1, updatedAt: now } })
  const payload = { licenseId: lic.licenseId, deviceId, status: lic.status, maxActiveDevices: lic.maxActiveDevices, currentActiveDeviceCount: activeCount + 1, fingerprintHash: hash, issuedAt: now, keyVersion: 1 }
  const sig = signEntitlement(payload, SIGNING_KEY)
  await logAudit({ action: 'license.device.activate', resource: 'lic_devices', resourceId: deviceId })
  return { entitlement: { ...payload, signature: sig }, device: dev }
}

export async function listDevices(licenseId?: string): Promise<DeviceActivation[]> {
  const db = requireDb()
  const q: any = {}
  if (licenseId) q.licenseId = licenseId
  return db.collection<DeviceActivation>(DEVICES).find(q).toArray()
}

export async function revokeDevice(deviceId: string, reason: string): Promise<void> {
  const db = requireDb()
  const now = new Date().toISOString()
  const dev = await db.collection<DeviceActivation>(DEVICES).findOne({ deviceId })
  if (!dev) throw new Error('Device not found')
  await db.collection(DEVICES).updateOne({ deviceId }, { $set: { activationStatus: 'revoked', deactivationDate: now, deactivationReason: reason } })
  const lic = await db.collection<License>(LICENSES).findOne({ licenseId: dev.licenseId })
  if (lic && lic.currentActiveDeviceCount > 0) {
    await db.collection<License>(LICENSES).updateOne({ licenseId: dev.licenseId }, { $set: { currentActiveDeviceCount: lic.currentActiveDeviceCount - 1, updatedAt: now } })
  }
  await logAudit({ action: 'license.device.revoke', resource: 'lic_devices', resourceId: deviceId, details: { reason } })
}

export async function requestReplacement(input: { licenseId: string; existingDeviceId: string; requestedFingerprint: any; reason: string }): Promise<ReplacementRequest> {
  const db = requireDb()
  const now = new Date().toISOString()
  const { hash } = hashFingerprint(input.requestedFingerprint || {})
  const req: any = {
    requestId: randomUUID(),
    licenseId: input.licenseId,
    existingDeviceId: input.existingDeviceId,
    requestedFingerprintHash: hash,
    requestedFingerprintVersion: 1,
    reason: input.reason,
    requestDate: now,
    status: 'pending'
  }
  await db.collection(REPL).insertOne(req)
  await logAudit({ action: 'license.replacement.request', resource: 'lic_replacements', resourceId: req.requestId })
  return req
}

export async function listReplacements(status?: string): Promise<ReplacementRequest[]> {
  const db = requireDb()
  const q: any = {}
  if (status) q.status = status
  return db.collection<ReplacementRequest>(REPL).find(q).toArray()
}

export async function approveReplacement(requestId: string, reviewedBy: string, decisionReason: string): Promise<{ oldDeviceDeactivated: boolean; newDeviceEligible: boolean }> {
  const db = requireDb()
  const now = new Date().toISOString()
  const req = await db.collection<ReplacementRequest>(REPL).findOne({ requestId })
  if (!req || req.status !== 'pending') throw new Error('Invalid request')
  await db.collection(DEVICES).updateOne({ deviceId: req.existingDeviceId }, { $set: { activationStatus: 'inactive', deactivationDate: now, deactivationReason: 'replacement_approved' } })
  await db.collection(REPL).updateOne({ requestId }, { $set: { status: 'approved', reviewedBy, reviewDate: now, decisionReason } })
  await logAudit({ action: 'license.replacement.approve', resource: 'lic_replacements', resourceId: requestId })
  return { oldDeviceDeactivated: true, newDeviceEligible: true }
}

export async function rejectReplacement(requestId: string, reviewedBy: string, decisionReason: string): Promise<void> {
  const db = requireDb()
  const now = new Date().toISOString()
  await db.collection(REPL).updateOne({ requestId }, { $set: { status: 'rejected', reviewedBy, reviewDate: now, decisionReason } })
  await logAudit({ action: 'license.replacement.reject', resource: 'lic_replacements', resourceId: requestId })
}
