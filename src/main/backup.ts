import { dialog, type BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BSON, type Document } from 'mongodb'
import { getDb } from './db'
import { getSettings } from './settings'
import { getCurrentSession, logAudit } from './auth'
import type { BackupResult } from '../shared/ipc'

// v2 (Gate 1 S4): canonical EJSON keeps ObjectId/Date/Decimal types through a restore.
// v1 files (plain JSON, ids as strings) can still be imported.
const BACKUP_VERSION = 2
const READABLE_VERSIONS = new Set([1, 2])
const PRESERVED = new Set(['audit'])

interface BackupFile {
  version: number
  exportedAt: string
  database: string
  collections: Record<string, Document[]>
}

export async function exportBackup(win: BrowserWindow): Promise<BackupResult> {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')

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

  await writeFile(result.filePath, BSON.EJSON.stringify(payload, undefined, 2, { relaxed: false }), 'utf8')
  await logAudit({ actorUsername: getCurrentSession()?.username, action: 'backup.export', resource: 'backup', details: { collections: Object.keys(collections).length } })
  return { canceled: false, filePath: result.filePath }
}

export async function importBackup(win: BrowserWindow): Promise<BackupResult> {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')

  const result = await dialog.showOpenDialog(win, {
    title: 'Import database backup',
    properties: ['openFile'],
    filters: [{ name: 'JSON backup', extensions: ['json'] }]
  })

  if (result.canceled || result.filePaths.length === 0) return { canceled: true }

  const filePath = result.filePaths[0]
  let payload: Partial<BackupFile>
  try {
    payload = BSON.EJSON.parse(await readFile(filePath, 'utf8'), { relaxed: true }) as Partial<BackupFile>
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
  await logAudit({ actorUsername: getCurrentSession()?.username, action: 'backup.import', resource: 'backup', details: { imported, collections: collections.length } })
  return { canceled: false, filePath, imported }
}
