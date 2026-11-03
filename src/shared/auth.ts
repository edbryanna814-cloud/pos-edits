export type Permission =
  | 'users.read'
  | 'users.manage'
  | 'roles.manage'
  | 'permissions.manage'
  | 'pos.use'
  | 'inventory.manage'
  | 'crm.manage'
  | 'reports.view'
  | 'cashbox.manage'
  | 'settings.manage'
  | 'audit.view'

export type Role = {
  name: string
  permissions: Permission[]
}

export const BUILTIN_ROLES: Role[] = [
  { name: 'Administrator', permissions: ['users.read', 'users.manage', 'roles.manage', 'permissions.manage', 'pos.use', 'inventory.manage', 'crm.manage', 'reports.view', 'cashbox.manage', 'settings.manage', 'audit.view'] },
  { name: 'Manager', permissions: ['users.read', 'pos.use', 'inventory.manage', 'crm.manage', 'reports.view', 'cashbox.manage'] },
  { name: 'Cashier', permissions: ['pos.use', 'reports.view'] },
  { name: 'Inventory Manager', permissions: ['inventory.manage', 'reports.view'] },
  { name: 'Accountant', permissions: ['cashbox.manage', 'reports.view'] },
  { name: 'CRM Employee', permissions: ['crm.manage'] }
]

export type User = {
  _id?: string
  username: string
  passwordHash: string
  role: string
  permissions?: Permission[]
  active: boolean
  createdAt: string
  updatedAt: string
}

export type Session = {
  _id?: string
  token: string
  userId: string
  username: string
  role: string
  permissions: Permission[]
  expiresAt: string
  createdAt: string
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
