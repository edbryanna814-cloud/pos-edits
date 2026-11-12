import { describe, expect, it } from 'vitest'
import { IPC } from '../../src/shared/ipc'
import { licenseRequired } from '../../src/main/licenseGate'

describe('licence gate', () => {
  it('stays open only for activation, session and shell channels', () => {
    for (const channel of [
      IPC.Ping,
      IPC.GetVersion,
      IPC.DbHealth,
      IPC.LicenseStatus,
      IPC.LicenseApply,
      IPC.AuthState,
      IPC.AuthLogout,
      IPC.AuthChangePassword,
      IPC.AuthSetupRequired
    ]) {
      expect(licenseRequired(channel)).toBe(false)
    }
  })

  it('refuses every business channel once the licence is not valid', () => {
    for (const channel of [
      IPC.AuthLogin,
      IPC.AuthSetup,
      IPC.SettingsGet,
      IPC.SettingsSave,
      IPC.BackupExport,
      IPC.BackupImport,
      IPC.UsersCreate,
      IPC.PosCheckout,
      IPC.PosReturn,
      IPC.PosCashIn,
      IPC.ReportsSales,
      IPC.InvStockAdjust
    ]) {
      expect(licenseRequired(channel)).toBe(true)
    }
  })
})
