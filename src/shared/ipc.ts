import type { CompanySettings, StoredCompanySettings } from './settings'
import type { ReturnableLine } from './returns'
import type { AttendanceDay, AttendanceImportResult, SellerKpi } from './attendance'
import type { Customer } from './customers'
import type { AuthState, ChangePasswordInput, LoginInput, LoginResult, Permission, User } from './auth'
import type { Category, Product, PurchaseOrder, PurchaseReceipt, StockMovement, Supplier, Unit } from './inventory'
import type { CashboxMovement, CashierShift, Payment, Return, Sale } from './pos'

/** A checked sheet: every row with its problems; nothing is added before the user confirms. */
export type ProductImportPreview = {
  batchId: string
  fileName: string
  rows: { line: number; name: string; sku: string; packaging: 'box' | 'strip' | 'pill'; unitPriceCents: number; stock: number; errors: string[] }[]
}

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
  DbConnectionGet: 'db:connection-get',
  DbConnectionTest: 'db:connection-test',
  DbConnectionSave: 'db:connection-save',
  AuthSetupRequired: 'auth:setup-required',
  AuthSetup: 'auth:setup',
  AuthChangePassword: 'auth:change-password',
  AuthRecoveryStart: 'auth:recovery-start',
  AuthRecoveryVerify: 'auth:recovery-verify',
  AuthRecoveryReset: 'auth:recovery-reset',
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
  InvImportPreview: 'inv:import:preview',
  InvImportConfirm: 'inv:import:confirm',
  AttendanceImport: 'attendance:import',
  AttendanceDays: 'attendance:days',
  KpiSellers: 'kpi:sellers',
  ExportSection: 'export:section',
  InvCategoriesDelete: 'inv:categories:delete',
  InvProductsDelete: 'inv:products:delete',
  InvSuppliersDelete: 'inv:suppliers:delete',
  CustomersDelete: 'customers:delete',
  PosCheckout: 'pos:checkout',
  CustomersList: 'customers:list',
  CustomersCreate: 'customers:create',
  CustomersUpdate: 'customers:update',
  PosSalesList: 'pos:sales:list',
  PosReturn: 'pos:return',
  PosReturnable: 'pos:returnable',
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
  dbConnectionGet(): Promise<{ mode: 'local' | 'shared' | 'host'; hosts?: string; ips: string[]; port: number; joinCode?: string; securityCode?: string }>
  dbConnectionTest(input: { uri: string } | { ip: string; code: string }): Promise<{ ok: true; serverVersion: string; topology: string; hosts: string; securityCode?: string }>
  dbConnectionSave(input: { mode: 'local' } | { mode: 'host' } | { mode: 'shared'; uri: string } | { mode: 'join'; ip: string; code: string; securityCode: string }): Promise<{ ok: true; restarting: true }>
  authSetupRequired(): Promise<boolean>
  authSetup(input: LoginInput): Promise<LoginResult>
  authChangePassword(input: ChangePasswordInput): Promise<{ success: true }>
  authRecoveryStart(): Promise<{ deviceId: string; requestCode: string }>
  authRecoveryVerify(input: { code: string }): Promise<{ admins: string[] }>
  authRecoveryReset(input: { username: string; password: string }): Promise<{ ok: true }>
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
  invImportPreview(): Promise<ProductImportPreview | null>
  invImportConfirm(batchId: string): Promise<{ added: number; skipped: number }>
  attendanceImport(): Promise<AttendanceImportResult | null>
  attendanceDays(range: { from: string; to: string }): Promise<AttendanceDay[]>
  kpiSellers(range: { from: string; to: string }): Promise<SellerKpi[]>
  exportSection(section: string, format: 'xlsx' | 'db'): Promise<{ fileName: string; count: number } | null>
  invCategoriesDelete(id: string): Promise<{ ok: true }>
  invProductsDelete(id: string): Promise<{ ok: true }>
  invSuppliersDelete(id: string): Promise<{ ok: true }>
  customersDelete(id: string): Promise<{ ok: true }>
  customersList(): Promise<Customer[]>
  customersCreate(input: Partial<Customer>): Promise<Customer>
  customersUpdate(id: string, input: Partial<Customer>): Promise<Customer>
  posSalesList(): Promise<Sale[]>
  posReturn(input: { saleId: string; reason: string; lineIndex?: number }): Promise<Return>
  posReturnable(): Promise<ReturnableLine[]>
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
