export type LicenseStatus = 'pending' | 'active' | 'suspended' | 'expired' | 'revoked'

export type DeviceActivationStatus = 'active' | 'inactive' | 'revoked' | 'replacement_pending'

export type ReplacementStatus = 'pending' | 'approved' | 'rejected'

export interface HardwareFingerprint {
  version: number
  diskSerial?: string
  motherboardUuid?: string
  biosSerial?: string
  macAddress?: string
  osMachineId?: string
  hash: string
}

export interface License {
  _id?: string
  licenseId: string
  customerId?: string
  subscriptionId?: string
  maxActiveDevices: number
  currentActiveDeviceCount: number
  status: LicenseStatus
  createdAt: string
  updatedAt: string
}

export interface DeviceActivation {
  _id?: string
  deviceId: string
  licenseId: string
  fingerprintHash: string
  fingerprintVersion: number
  deviceDisplayName?: string
  os?: string
  activationDate: string
  lastValidationDate: string
  activationStatus: DeviceActivationStatus
  deactivationDate?: string
  deactivationReason?: string
}

export interface ReplacementRequest {
  _id?: string
  requestId: string
  licenseId: string
  existingDeviceId: string
  requestedFingerprintHash: string
  requestedFingerprintVersion: number
  reason: string
  requestDate: string
  status: ReplacementStatus
  reviewedBy?: string
  reviewDate?: string
  decisionReason?: string
}

export interface SignedEntitlement {
  licenseId: string
  deviceId: string
  status: LicenseStatus
  maxActiveDevices: number
  currentActiveDeviceCount: number
  issuedAt: string
  expiresAt?: string
  fingerprintHash: string
  signature: string
  keyVersion: number
}
