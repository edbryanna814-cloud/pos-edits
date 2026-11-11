import { dialog, type BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Document } from 'mongodb'
import { getDb } from './db'
import { getSettings } from './settings'
import { getCurrentSession, logAudit } from './auth'
import type { BackupResult } from '../shared/ipc'

const BACKUP_VERSION = 1

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

  await writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf8')
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
  const payload = JSON.parse(await readFile(filePath, 'utf8')) as Partial<BackupFile>

  if (
    payload.version !== BACKUP_VERSION ||
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
    const collection = db.collection(name)
    await collection.deleteMany({})
    if (docs.length > 0) {
      await collection.insertMany(docs as Document[])
      imported += docs.length
    }
  }

  const backupNames = new Set(collections.map(([name]) => name))
  for (const info of await db.listCollections().toArray()) {
    if (info.name.startsWith('system.')) continue
    if (!backupNames.has(info.name)) await db.collection(info.name).drop()
  }

  // Written into the restored log, so the chain records that a restore happened.
  await logAudit({ actorUsername: getCurrentSession()?.username, action: 'backup.import', resource: 'backup', details: { imported, collections: collections.length } })
  return { canceled: false, filePath, imported }
}
