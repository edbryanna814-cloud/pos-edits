import type { CompanySettings, StoredCompanySettings } from './settings'
import type { AuthState, ChangePasswordInput, LoginInput, LoginResult, Permission, User } from './auth'
import type { Category, Product, PurchaseOrder, PurchaseReceipt, StockMovement, Supplier, Unit } from './inventory'
import type { CashboxMovement, CashierShift, Payment, Return, Sale } from './pos'

export const IPC = {
  Ping: 'app:ping',
  GetVersion: 'app:get-version',
  DbHealth: 'db:health',
  SettingsGet: 'settings:get',
  SettingsSave: 'settings:save',
  BackupExport: 'backup:export',
  BackupImport: 'backup:import',
  AuthLogin: 'auth:login',
  AuthLogout: 'auth:logout',
  AuthState: 'auth:state',
  AuthSetupRequired: 'auth:setup-required',
  AuthSetup: 'auth:setup',
  AuthChangePassword: 'auth:change-password',
  UsersList: 'users:list',
  UsersCreate: 'users:create',
  UsersUpdate: 'users:update',
  RolesList: 'roles:list',
  AuditList: 'audit:list',
  InvCategoriesList: 'inv:categories:list',
  InvCategoriesCreate: 'inv:categories:create',
  InvUnitsList: 'inv:units:list',
  InvUnitsCreate: 'inv:units:create',
  InvProductsList: 'inv:products:list',
  InvProductsCreate: 'inv:products:create',
  InvProductsUpdate: 'inv:products:update',
  InvReceiveCarton: 'inv:receive-carton',
  InvStockMovementsList: 'inv:stock:list',
  InvStockAdjust: 'inv:stock:adjust',
  InvSuppliersList: 'inv:suppliers:list',
  InvSuppliersCreate: 'inv:suppliers:create',
  InvPOList: 'inv:po:list',
  InvPOCreate: 'inv:po:create',
  InvPOReceive: 'inv:po:receive',
  PosCheckout: 'pos:checkout',
  PosSalesList: 'pos:sales:list',
  PosReturn: 'pos:return',
  PosCashIn: 'pos:cash:in',
  PosCashOut: 'pos:cash:out',
  PosCashboxList: 'pos:cashbox:list',
  PosShiftOpen: 'pos:shift:open',
  PosShiftClose: 'pos:shift:close',
  PosShiftsList: 'pos:shifts:list',
  ReportsSales: 'reports:sales',
  ReportsCashbox: 'reports:cashbox',
  ReportsInventory: 'reports:inventory',
  LicenseStatus: 'license:status',
  LicenseApply: 'license:apply'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

export interface DbHealth {
  status: 'connected' | 'disconnected'
  database: string
  serverVersion?: string
  topology?: string
  supportsTransactions: boolean
  latencyMs?: number
  error?: string
}

export interface BackupResult {
  canceled: boolean
  filePath?: string
  imported?: number
}

export type LicenseStateStatus = 'valid' | 'missing' | 'expired' | 'invalid'

export interface LicenseState {
  status: LicenseStateStatus
  deviceId: string
  licenseId?: string
  expiresAt?: string
}

export interface PreloadApi {
  ping(): Promise<string>
  getVersion(): Promise<string>
  dbHealth(): Promise<DbHealth>
  getSettings(): Promise<StoredCompanySettings | null>
  saveSettings(input: CompanySettings): Promise<StoredCompanySettings>
  /** Gate 1 S4: the passphrase encrypts the backup; it is never stored. */
  exportBackup(input: { passphrase: string }): Promise<BackupResult>
  importBackup(input: { passphrase?: string }): Promise<BackupResult>
  authLogin(input: LoginInput): Promise<LoginResult>
  authLogout(token: string): Promise<{ success: boolean }>
  authState(token?: string): Promise<AuthState>
  authSetupRequired(): Promise<boolean>
  authSetup(input: LoginInput): Promise<LoginResult>
  authChangePassword(input: ChangePasswordInput): Promise<{ success: true }>
  usersList(): Promise<User[]>
  usersCreate(input: Partial<User> & { password: string }): Promise<User>
  usersUpdate(id: string, input: Partial<User>): Promise<User>
  rolesList(): Promise<{ name: string; permissions: Permission[] }[]>
  auditList(limit?: number): Promise<import('./auth').AuditEvent[]>
  invCategoriesList(): Promise<Category[]>
  invCategoriesCreate(input: Partial<Category>): Promise<Category>
  invUnitsList(): Promise<Unit[]>
  invUnitsCreate(input: Partial<Unit>): Promise<Unit>
  invProductsList(): Promise<Product[]>
  invProductsCreate(input: Partial<Product>): Promise<Product>
  invProductsUpdate(id: string, input: Partial<Product>): Promise<Product>
  invReceiveCarton(input: {
    productId: string
    cartons: number
    boxesPerCarton: number
    sellingPriceCents?: number
    boxPriceCents?: number
    expiryDate?: string
  }): Promise<Product>
  invStockMovementsList(productId?: string): Promise<StockMovement[]>
  invStockAdjust(input: { productId: string; quantity: number; reason: string }): Promise<StockMovement>
  invSuppliersList(): Promise<Supplier[]>
  invSuppliersCreate(input: Partial<Supplier>): Promise<Supplier>
  invPOList(): Promise<PurchaseOrder[]>
  invPOCreate(input: Partial<PurchaseOrder>): Promise<PurchaseOrder>
  invPOReceive(purchaseOrderId: string, notes?: string): Promise<PurchaseReceipt>
  posCheckout(input: any): Promise<Sale>
  posSalesList(): Promise<Sale[]>
  posReturn(input: { saleId: string; reason: string }): Promise<Return>
  posCashIn(amountCents: number, reason: string): Promise<CashboxMovement>
  posCashOut(amountCents: number, reason: string): Promise<CashboxMovement>
  posCashboxList(): Promise<CashboxMovement[]>
  posShiftOpen(openingBalanceCents: number): Promise<CashierShift>
  posShiftClose(): Promise<CashierShift>
  posShiftsList(): Promise<CashierShift[]>
  reportsSales(): Promise<any>
  reportsCashbox(): Promise<any>
  reportsInventory(): Promise<any>
  licenseStatus(): Promise<LicenseState>
  licenseApply(code: string): Promise<LicenseState>
}
