import { app, safeStorage } from 'electron'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describeUri, validateSharedUri } from './dbConnection'

// Where this PC's data lives: 'local' (the bundled MongoDB) or 'shared' (one server for several PCs).
// The shared connection string holds the server login, so it is stored only encrypted with the
// Windows user's key (DPAPI) and never returned to the screen.

export type DbMode = { mode: 'local' } | { mode: 'shared'; uri: string }

const file = () => join(app.getPath('userData'), 'db-connection.bin')

export async function loadDbMode(): Promise<DbMode> {
  const stored = await readFile(file()).catch(() => null)
  if (!stored) return { mode: 'local' }
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption (DPAPI) unavailable')
  const parsed = JSON.parse(safeStorage.decryptString(stored)) as { mode?: string; uri?: string }
  return parsed.mode === 'shared' && parsed.uri ? { mode: 'shared', uri: validateSharedUri(parsed.uri) } : { mode: 'local' }
}

export async function saveDbMode(next: DbMode): Promise<void> {
  if (next.mode === 'local') {
    await rm(file(), { force: true })
    return
  }
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption (DPAPI) unavailable')
  const uri = validateSharedUri(next.uri)
  await writeFile(`${file()}.tmp`, safeStorage.encryptString(JSON.stringify({ mode: 'shared', uri })))
  await rename(`${file()}.tmp`, file())
}

/** Safe to show: the mode and the server host names only. */
export async function describeDbMode(): Promise<{ mode: 'local' | 'shared'; hosts?: string }> {
  const current = await loadDbMode()
  return current.mode === 'shared' ? { mode: 'shared', hosts: describeUri(current.uri) } : { mode: 'local' }
}
