import type { CompanySettings, StoredCompanySettings } from './settings'
import type { AuthState, LoginInput, LoginResult, Permission, User } from './auth'
import type { Activity, Contact, Customer, Deal, Lead, Note } from './crm'
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
  UsersList: 'users:list',
  UsersCreate: 'users:create',
  UsersUpdate: 'users:update',
  RolesList: 'roles:list',
  AuditList: 'audit:list',
  CrmCustomersList: 'crm:customers:list',
  CrmCustomersCreate: 'crm:customers:create',
  CrmCustomersUpdate: 'crm:customers:update',
  CrmContactsList: 'crm:contacts:list',
  CrmContactsCreate: 'crm:contacts:create',
  CrmLeadsList: 'crm:leads:list',
  CrmLeadsCreate: 'crm:leads:create',
  CrmDealsList: 'crm:deals:list',
  CrmDealsCreate: 'crm:deals:create',
  CrmActivitiesList: 'crm:activities:list',
  CrmActivitiesCreate: 'crm:activities:create',
  CrmNotesList: 'crm:notes:list',
  CrmNotesCreate: 'crm:notes:create',
  InvCategoriesList: 'inv:categories:list',
  InvCategoriesCreate: 'inv:categories:create',
  InvUnitsList: 'inv:units:list',
  InvUnitsCreate: 'inv:units:create',
  InvProductsList: 'inv:products:list',
  InvProductsCreate: 'inv:products:create',
  InvProductsUpdate: 'inv:products:update',
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
  SubPlansList: 'sub:plans:list',
  SubPlansCreate: 'sub:plans:create',
  SubGet: 'sub:get',
  SubCreate: 'sub:create',
  SubRenew: 'sub:renew',
  SubSetStatus: 'sub:set-status',
  SubPaymentsList: 'sub:payments:list',
  LicList: 'lic:list',
  LicCreate: 'lic:create',
  LicConfigureLimit: 'lic:configureLimit',
  LicDevicesList: 'lic:devices:list',
  LicActivate: 'lic:activate',
  LicRevoke: 'lic:revoke',
  LicReplList: 'lic:repl:list',
  LicReplRequest: 'lic:repl:request',
  LicReplApprove: 'lic:repl:approve',
  LicReplReject: 'lic:repl:reject',
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
  mac: string
  deviceId: string
  licenseId?: string
  expiresAt?: string
  price?: string
  currency?: string
  period?: string
  count?: number
  reason?: string
}

export interface PreloadApi {
  ping(): Promise<string>
  getVersion(): Promise<string>
  dbHealth(): Promise<DbHealth>
  getSettings(): Promise<StoredCompanySettings | null>
  saveSettings(input: CompanySettings): Promise<StoredCompanySettings>
  exportBackup(): Promise<BackupResult>
  importBackup(): Promise<BackupResult>
  authLogin(input: LoginInput): Promise<LoginResult>
  authLogout(token: string): Promise<{ success: boolean }>
  authState(token?: string): Promise<AuthState>
  usersList(): Promise<User[]>
  usersCreate(input: Partial<User> & { password: string }): Promise<User>
  usersUpdate(id: string, input: Partial<User>): Promise<User>
  rolesList(): Promise<{ name: string; permissions: Permission[] }[]>
  auditList(limit?: number): Promise<import('./auth').AuditEvent[]>
  crmCustomersList(): Promise<Customer[]>
  crmCustomersCreate(input: Partial<Customer>): Promise<Customer>
  crmCustomersUpdate(id: string, input: Partial<Customer>): Promise<Customer>
  crmContactsList(customerId?: string): Promise<Contact[]>
  crmContactsCreate(input: Partial<Contact>): Promise<Contact>
  crmLeadsList(): Promise<Lead[]>
  crmLeadsCreate(input: Partial<Lead>): Promise<Lead>
  crmDealsList(): Promise<Deal[]>
  crmDealsCreate(input: Partial<Deal>): Promise<Deal>
  crmActivitiesList(customerId?: string): Promise<Activity[]>
  crmActivitiesCreate(input: Partial<Activity>): Promise<Activity>
  crmNotesList(customerId: string): Promise<Note[]>
  crmNotesCreate(input: Partial<Note>): Promise<Note>
  invCategoriesList(): Promise<Category[]>
  invCategoriesCreate(input: Partial<Category>): Promise<Category>
  invUnitsList(): Promise<Unit[]>
  invUnitsCreate(input: Partial<Unit>): Promise<Unit>
  invProductsList(): Promise<Product[]>
  invProductsCreate(input: Partial<Product>): Promise<Product>
  invProductsUpdate(id: string, input: Partial<Product>): Promise<Product>
  invStockMovementsList(productId?: string): Promise<StockMovement[]>
  invStockAdjust(input: { productId: string; quantity: number; reason: string }): Promise<StockMovement>
  invSuppliersList(): Promise<Supplier[]>
  invSuppliersCreate(input: Partial<Supplier>): Promise<Supplier>
  invPOList(): Promise<PurchaseOrder[]>
  invPOCreate(input: Partial<PurchaseOrder>): Promise<PurchaseOrder>
  invPOReceive(purchaseOrderId: string, notes?: string): Promise<PurchaseReceipt>
  posCheckout(input: any): Promise<Sale>
  posSalesList(): Promise<Sale[]>
  posReturn(input: { saleId: string; reason: string; lines?: any[] }): Promise<Return>
  posCashIn(amountCents: number, reason: string): Promise<CashboxMovement>
  posCashOut(amountCents: number, reason: string): Promise<CashboxMovement>
  posCashboxList(): Promise<CashboxMovement[]>
  posShiftOpen(openingBalanceCents: number): Promise<CashierShift>
  posShiftClose(): Promise<CashierShift>
  posShiftsList(): Promise<CashierShift[]>
  reportsSales(): Promise<any>
  reportsCashbox(): Promise<any>
  reportsInventory(): Promise<any>
  subPlansList(): Promise<any[]>
  subPlansCreate(input: any): Promise<any>
  subGet(): Promise<any>
  subCreate(input: any): Promise<any>
  subRenew(): Promise<any>
  subSetStatus(status: string): Promise<any>
  subPaymentsList(): Promise<any[]>
  licList(): Promise<any[]>
  licCreate(input: any): Promise<any>
  licConfigureLimit(licenseId: string, maxActiveDevices: number): Promise<any>
  licDevicesList(licenseId?: string): Promise<any[]>
  licActivate(input: any): Promise<any>
  licRevoke(deviceId: string, reason: string): Promise<void>
  licReplList(status?: string): Promise<any[]>
  licReplRequest(input: any): Promise<any>
  licReplApprove(requestId: string, reviewedBy: string, decisionReason: string): Promise<any>
  licReplReject(requestId: string, reviewedBy: string, decisionReason: string): Promise<void>
  licenseStatus(): Promise<LicenseState>
  licenseApply(code: string): Promise<LicenseState>
}
