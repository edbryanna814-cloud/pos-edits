import { IPC, type IpcChannel } from '../shared/ipc'

// Channels that must stay reachable while the licence is missing or expired: activation itself,
// session state, sign-out, password change, and the health/version probes the shell needs to render.
// Everything else is refused, so an expired licence cannot keep selling.
const LICENSE_EXEMPT = new Set<IpcChannel>([
  IPC.Ping,
  IPC.GetVersion,
  IPC.DbHealth,
  IPC.LicenseStatus,
  IPC.LicenseApply,
  IPC.AuthState,
  IPC.AuthLogout,
  IPC.AuthChangePassword,
  IPC.AuthSetupRequired
])

export function licenseRequired(channel: IpcChannel): boolean {
  return !LICENSE_EXEMPT.has(channel)
}
