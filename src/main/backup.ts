import { dialog, type BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BSON, type Document } from 'mongodb'
import { getDb } from './db'
import { getSettings } from './settings'
import { getCurrentSession, logAudit } from './auth'
import type { BackupResult } from '../shared/ipc'
import { BACKUP_ERRORS, MIN_BACKUP_PASSPHRASE, decryptBackup, encryptBackup, isEncryptedBackup } from './backupCrypto'

// v2 (Gate 1 S4): canonical EJSON keeps ObjectId/Date/Decimal types through a restore.
// v1 files (plain JSON, ids as strings) can still be imported.
// Every new export is wrapped in an encrypted envelope (backupCrypto.ts, file version 3); legacy
// plaintext v1/v2 files still import so existing backups are not stranded.
const BACKUP_VERSION = 2
const READABLE_VERSIONS = new Set([1, 2])
const PRESERVED = new Set(['audit'])

interface BackupFile {
  version: number
  exportedAt: string
  database: string
  collections: Record<string, Document[]>
}

export async function exportBackup(win: BrowserWindow, input?: { passphrase?: unknown }): Promise<BackupResult> {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  const passphrase = input?.passphrase
  if (typeof passphrase !== 'string' || passphrase.length < MIN_BACKUP_PASSPHRASE) throw new Error(BACKUP_ERRORS.passphrase)

  const fileName = `pharmacy-pos-backup-${new Date().toISOString().slice(0, 10)}.json`
  let defaultPath = fileName
  try {
    const settings = await getSettings()
    if (settings?.backupDirectory) defaultPath = join(settings.backupDirectory, fileName)
  } catch {
    defaultPath = fileName
  }

  const result = await dialog.showSaveDialog(win, {
    title: 'Export database backup',
    defaultPath,
    filters: [{ name: 'JSON backup', extensions: ['json'] }]
  })

  if (result.canceled || !result.filePath) return { canceled: true }

  const collections: Record<string, Document[]> = {}
  for (const info of await db.listCollections().toArray()) {
    if (info.name.startsWith('system.')) continue
    collections[info.name] = await db.collection(info.name).find({}).toArray()
  }

  const payload: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    database: db.databaseName,
    collections
  }

  const encrypted = await encryptBackup(BSON.EJSON.stringify(payload, undefined, 0, { relaxed: false }), passphrase)
  await writeFile(result.filePath, encrypted, 'utf8')
  await logAudit({ actorUsername: getCurrentSession()?.username, action: 'backup.export', resource: 'backup', details: { collections: Object.keys(collections).length, encrypted: true } })
  return { canceled: false, filePath: result.filePath }
}

export async function importBackup(win: BrowserWindow, input?: { passphrase?: unknown }): Promise<BackupResult> {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')

  const result = await dialog.showOpenDialog(win, {
    title: 'Import database backup',
    properties: ['openFile'],
    filters: [{ name: 'JSON backup', extensions: ['json'] }]
  })

  if (result.canceled || result.filePaths.length === 0) return { canceled: true }

  const filePath = result.filePaths[0]
  let text = await readFile(filePath, 'utf8')
  let encrypted = false
  try {
    const outer = JSON.parse(text)
    if (isEncryptedBackup(outer)) {
      text = await decryptBackup(outer, input?.passphrase)
      encrypted = true
    }
  } catch (error) {
    if ((error as Error).message === BACKUP_ERRORS.decrypt || (error as Error).message === BACKUP_ERRORS.passphrase) {
      await logAudit({ actorUsername: getCurrentSession()?.username, action: 'backup.import_refused', resource: 'backup', details: { reason: (error as Error).message } })
      throw error
    }
    throw new Error('Invalid backup file')
  }
  let payload: Partial<BackupFile>
  try {
    payload = BSON.EJSON.parse(text, { relaxed: true }) as Partial<BackupFile>
  } catch {
    throw new Error('Invalid backup file')
  }

  if (
    !READABLE_VERSIONS.has(payload.version as number) ||
    !payload.collections ||
    typeof payload.collections !== 'object'
  ) {
    throw new Error('Invalid backup file')
  }

  const collections = Object.entries(payload.collections)
  if (collections.some(([, docs]) => !Array.isArray(docs))) {
    throw new Error('Invalid backup file')
  }

  const confirmation = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Cancel', 'Replace database'],
    defaultId: 0,
    cancelId: 0,
    title: 'Replace database?',
    message: 'Importing this backup replaces the current database contents.',
    detail: `File: ${filePath}`
  })

  if (confirmation.response !== 1) return { canceled: true }

  let imported = 0
  for (const [name, docs] of collections) {
    // The audit log is append-only: a restore never replaces or rewinds it (Gate 1 S4/S5).
    if (PRESERVED.has(name)) continue
    const collection = db.collection(name)
    await collection.deleteMany({})
    if (docs.length > 0) {
      await collection.insertMany(docs as Document[])
      imported += docs.length
    }
  }

  const backupNames = new Set(collections.map(([name]) => name))
  for (const info of await db.listCollections().toArray()) {
    if (info.name.startsWith('system.') || PRESERVED.has(info.name)) continue
    if (!backupNames.has(info.name)) await db.collection(info.name).drop()
  }

  // Appended to the live (preserved) log, so the chain records that a restore happened.
  await logAudit({ actorUsername: getCurrentSession()?.username, action: 'backup.import', resource: 'backup', details: { imported, collections: collections.length, encrypted } })
  return { canceled: false, filePath, imported }
}
