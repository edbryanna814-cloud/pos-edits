// Gate 1 S3: argument validation for every IPC channel, applied centrally in handle() (index.ts).
// Kept free of Electron imports so it can be unit-tested. The map is a full Record over IpcChannel,
// so adding a channel without a schema fails typecheck.
import { IPC, type IpcChannel } from '../shared/ipc'

export type ArgSpec = 'id' | 'string' | 'optString' | 'int' | 'optInt' | 'object'

export const LIMITS = { maxString: 10_000, maxArray: 1_000, maxKeys: 200, maxDepth: 8 } as const

/** Stable code returned to the renderer for any rejected argument. */
export const VALIDATION_FAILED = 'VALIDATION_FAILED'

const OBJECT_ID = /^[0-9a-f]{24}$/i

const none: ArgSpec[] = []
export const IPC_ARGS: Record<IpcChannel, ArgSpec[]> = {
  [IPC.Ping]: none,
  [IPC.GetVersion]: none,
  [IPC.DbHealth]: none,
  [IPC.LicenseStatus]: none,
  [IPC.LicenseApply]: ['string'],
  [IPC.SettingsGet]: none,
  [IPC.SettingsSave]: ['object'],
  [IPC.BackupExport]: ['object'],
  [IPC.BackupImport]: ['object'],
  [IPC.AuthLogin]: ['object'],
  [IPC.AuthLogout]: ['optString'],
  [IPC.AuthState]: ['optString'],
  [IPC.DbConnectionGet]: none,
  [IPC.DbConnectionTest]: ['object'],
  [IPC.DbConnectionSave]: ['object'],
  [IPC.AuthSetupRequired]: none,
  [IPC.AuthSetup]: ['object'],
  [IPC.AuthChangePassword]: ['object'],
  [IPC.UsersList]: none,
  [IPC.UsersCreate]: ['object'],
  [IPC.UsersUpdate]: ['id', 'object'],
  [IPC.RolesList]: none,
  [IPC.AuditList]: ['optInt'],
  [IPC.InvCategoriesList]: none,
  [IPC.InvCategoriesCreate]: ['object'],
  [IPC.InvUnitsList]: none,
  [IPC.InvUnitsCreate]: ['object'],
  [IPC.InvProductsList]: none,
  [IPC.InvProductsCreate]: ['object'],
  [IPC.InvProductsUpdate]: ['id', 'object'],
  [IPC.InvReceiveCarton]: ['object'],
  [IPC.InvStockMovementsList]: ['optString'],
  [IPC.InvStockAdjust]: ['object'],
  [IPC.InvSuppliersList]: none,
  [IPC.InvSuppliersCreate]: ['object'],
  [IPC.InvPOList]: none,
  [IPC.InvPOCreate]: ['object'],
  [IPC.InvPOReceive]: ['id', 'optString'],
  [IPC.PosCheckout]: ['object'],
  [IPC.PosSalesList]: none,
  [IPC.PosReturn]: ['object'],
  [IPC.PosCashIn]: ['int', 'string'],
  [IPC.PosCashOut]: ['int', 'string'],
  [IPC.PosCashboxList]: none,
  [IPC.PosShiftOpen]: ['int'],
  [IPC.PosShiftClose]: none,
  [IPC.PosShiftsList]: none,
  [IPC.ReportsSales]: none,
  [IPC.ReportsCashbox]: none,
  [IPC.ReportsInventory]: none
}

function fail(): never {
  throw new Error(VALIDATION_FAILED)
}

/**
 * Only JSON-like data may cross IPC: plain objects, arrays, finite numbers, strings, booleans, null.
 * Object keys starting with "$" or containing "." are refused, so a renderer value can never become
 * a MongoDB operator or a dotted path (NoSQL injection). Sizes and depth are bounded.
 */
export function assertSafeValue(value: unknown, depth = 0): void {
  if (depth > LIMITS.maxDepth) fail()
  if (value === null || value === undefined || typeof value === 'boolean') return
  if (typeof value === 'number') return Number.isFinite(value) ? undefined : fail()
  if (typeof value === 'string') return value.length <= LIMITS.maxString ? undefined : fail()
  if (Array.isArray(value)) {
    if (value.length > LIMITS.maxArray) fail()
    for (const item of value) assertSafeValue(item, depth + 1)
    return
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) fail()
    const keys = Object.keys(value)
    if (keys.length > LIMITS.maxKeys) fail()
    for (const key of keys) {
      if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') fail()
      assertSafeValue((value as Record<string, unknown>)[key], depth + 1)
    }
    return
  }
  fail() // functions, symbols, bigint
}

function check(spec: ArgSpec, value: unknown): void {
  switch (spec) {
    case 'id':
      return typeof value === 'string' && OBJECT_ID.test(value) ? undefined : fail()
    case 'string':
      return typeof value === 'string' ? undefined : fail()
    case 'optString':
      return value === undefined || value === null || typeof value === 'string' ? undefined : fail()
    case 'int':
      return Number.isSafeInteger(value) ? undefined : fail()
    case 'optInt':
      return value === undefined || value === null || Number.isSafeInteger(value) ? undefined : fail()
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value) ? undefined : fail()
  }
}

/** Throws VALIDATION_FAILED unless `args` match the channel's schema exactly (no extra arguments). */
export function validateIpcArgs(channel: IpcChannel, args: unknown[]): void {
  const specs = IPC_ARGS[channel]
  if (!specs) fail()
  // Trailing undefined arguments are what an omitted optional parameter looks like.
  let length = args.length
  while (length > specs.length && args[length - 1] === undefined) length--
  if (length > specs.length) fail()
  specs.forEach((spec, i) => check(spec, args[i]))
  for (const arg of args) assertSafeValue(arg)
}

/**
 * Errors that reach the renderer: stable codes and service validation messages pass through;
 * anything from the database driver or the runtime becomes INTERNAL_ERROR (details stay in the main log).
 */
export function publicError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error('INTERNAL_ERROR')
  if (/^Mongo/.test(error.name) || error.name === 'BSONError') {
    return new Error((error as { code?: number }).code === 11000 ? 'DUPLICATE' : 'INTERNAL_ERROR')
  }
  if (error instanceof TypeError || error instanceof RangeError || error instanceof SyntaxError || error instanceof ReferenceError) {
    return new Error('INTERNAL_ERROR')
  }
  return new Error(error.message)
}
