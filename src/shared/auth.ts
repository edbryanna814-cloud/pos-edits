export type Permission =
  | 'users.read'
  | 'users.manage'
  | 'roles.manage'
  | 'permissions.manage'
  | 'pos.use'
  | 'inventory.manage'
  | 'reports.view'
  | 'cashbox.manage'
  | 'settings.manage'
  | 'audit.view'
  | 'database.manage'

export type Role = {
  name: string
  permissions: Permission[]
}

/** The three roles. Permissions come only from the role (no per-user overrides). */
export const ADMIN_ROLE = 'Administrator'
export const BUILTIN_ROLES: Role[] = [
  // Everything, including where the database lives.
  { name: 'Administrator', permissions: ['users.read', 'users.manage', 'roles.manage', 'permissions.manage', 'pos.use', 'inventory.manage', 'reports.view', 'cashbox.manage', 'settings.manage', 'audit.view', 'database.manage'] },
  // Everything except the database location; Administrator accounts are hidden from managers.
  { name: 'Manager', permissions: ['users.read', 'users.manage', 'pos.use', 'inventory.manage', 'reports.view', 'cashbox.manage', 'settings.manage', 'audit.view'] },
  // POS and inventory only.
  { name: 'Seller', permissions: ['pos.use', 'inventory.manage'] }
]

/** Roles from earlier versions, renamed on startup. */
export const LEGACY_ROLES: Record<string, string> = { Cashier: 'Seller', 'Inventory Manager': 'Seller', Accountant: 'Seller' }

export type User = {
  _id?: string
  username: string
  passwordHash: string
  role: string
  permissions?: Permission[]
  active: boolean
  mustChangePassword?: boolean
  failedLoginCount?: number
  lockedUntil?: string
  createdAt: string
  updatedAt: string
}

export type Session = {
  _id?: string
  /** SHA-256 of the session token; the raw token is never stored. */
  tokenHash: string
  userId: string
  username: string
  role: string
  permissions: Permission[]
  mustChangePassword?: boolean
  expiresAt: string
  createdAt: string
}

export type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
}

export type AuditEvent = {
  _id?: string
  actorId?: string
  actorUsername?: string
  action: string
  resource: string
  resourceId?: string
  ip?: string
  userAgent?: string
  details?: Record<string, unknown>
  createdAt: string
}

export type LoginInput = {
  username: string
  password: string
}

export type LoginResult = {
  token: string
  user: {
    username: string
    role: string
    permissions: Permission[]
  }
  expiresAt: string
  /** True after a legacy-hash migration or an administrator reset: only changePassword is allowed. */
  mustChangePassword?: boolean
}

export type AuthState = {
  authenticated: boolean
  user?: {
    username: string
    role: string
    permissions: Permission[]
  }
}

export const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours
