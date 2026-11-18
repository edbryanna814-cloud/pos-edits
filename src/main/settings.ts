import type { Db, Document } from 'mongodb'
import { getDb } from './db'
import {
  validateSettings,
  type CompanySettings,
  type StoredCompanySettings
} from '../shared/settings'

const COLLECTION = 'settings'
const DOC_ID = 'company'

const settingsValidator: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      '_id',
      'companyName',
      'currencyCode',
      'currencyPrecision',
      'taxRateBasisPoints',
      'defaultLanguage',
      'backupDirectory',
      'updatedAt'
    ],
    properties: {
      _id: { bsonType: 'string' },
      companyName: { bsonType: 'string', minLength: 1, maxLength: 120 },
      companyPhone: { bsonType: 'string', maxLength: 30 },
      companyAddress: { bsonType: 'string', maxLength: 200 },
      invoiceFooterNote: { bsonType: 'string', maxLength: 300 },
      currencyCode: { bsonType: 'string', pattern: '^[A-Z]{3}$' },
      currencyPrecision: {
        bsonType: ['int', 'long', 'double'],
        minimum: 0,
        maximum: 4,
        multipleOf: 1
      },
      taxRateBasisPoints: {
        bsonType: ['int', 'long', 'double'],
        minimum: 0,
        maximum: 10000,
        multipleOf: 1
      },
      defaultLanguage: { enum: ['en', 'ar'] },
      backupDirectory: { bsonType: 'string' },
      updatedAt: { bsonType: 'string' }
    }
  }
}

interface SettingsDocument {
  _id: string
  companyName: string
  companyPhone?: string
  companyAddress?: string
  invoiceFooterNote?: string
  currencyCode: string
  currencyPrecision: number
  taxRateBasisPoints: number
  defaultLanguage: string
  backupDirectory: string
  updatedAt: string
}

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

function settingsCollection() {
  return requireDb().collection<SettingsDocument>(COLLECTION)
}

export async function ensureSettingsSchema(): Promise<void> {
  const db = requireDb()
  const collections = await db.listCollections({ name: COLLECTION }).toArray()

  if (collections.length > 0) {
    await db.command({
      collMod: COLLECTION,
      validator: settingsValidator,
      validationLevel: 'strict',
      validationAction: 'error'
    })
    return
  }

  await db.createCollection(COLLECTION, {
    validator: settingsValidator,
    validationLevel: 'strict',
    validationAction: 'error'
  })
}

export async function getSettings(): Promise<StoredCompanySettings | null> {
  const doc = await settingsCollection().findOne({ _id: DOC_ID })
  if (!doc) return null

  const settings = validateSettings(doc)
  const updatedAt = typeof doc.updatedAt === 'string' ? doc.updatedAt : new Date(0).toISOString()

  return { ...settings, updatedAt }
}

export async function saveSettings(input: unknown): Promise<StoredCompanySettings> {
  const settings: CompanySettings = validateSettings(input)
  const updatedAt = new Date().toISOString()

  await settingsCollection().updateOne(
    { _id: DOC_ID },
    { $set: { ...settings, updatedAt } },
    { upsert: true }
  )

  return { ...settings, updatedAt }
}
