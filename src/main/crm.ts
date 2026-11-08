import { ObjectId, type Db } from 'mongodb'
import { getDb } from './db'
import type { Activity, Contact, Customer, Deal, Lead, Note } from '../shared/crm'
import { logAudit } from './auth'

const CUSTOMERS = 'crm_customers'
const CONTACTS = 'crm_contacts'
const LEADS = 'crm_leads'
const DEALS = 'crm_deals'
const ACTIVITIES = 'crm_activities'
const NOTES = 'crm_notes'

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

export async function ensureCrmSchema(): Promise<void> {
  const db = requireDb()
  const cols = await db.listCollections({ name: { $in: [CUSTOMERS, CONTACTS, LEADS, DEALS, ACTIVITIES, NOTES] } }).toArray()
  const names = new Set(cols.map((c) => c.name))
  if (!names.has(CUSTOMERS)) { await db.createCollection(CUSTOMERS); await db.collection(CUSTOMERS).createIndex({ name: 1 }) }
  if (!names.has(CONTACTS)) { await db.createCollection(CONTACTS); await db.collection(CONTACTS).createIndex({ customerId: 1 }) }
  if (!names.has(LEADS)) { await db.createCollection(LEADS); await db.collection(LEADS).createIndex({ status: 1 }) }
  if (!names.has(DEALS)) { await db.createCollection(DEALS); await db.collection(DEALS).createIndex({ customerId: 1 }) }
  if (!names.has(ACTIVITIES)) { await db.createCollection(ACTIVITIES); await db.collection(ACTIVITIES).createIndex({ customerId: 1 }) }
  if (!names.has(NOTES)) { await db.createCollection(NOTES); await db.collection(NOTES).createIndex({ customerId: 1 }) }
}

function withStringId<T>(doc: T): T {
  return { ...doc, _id: String((doc as { _id?: unknown })._id) }
}

function requireText(value: unknown, field: string): string {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${field} is required`)
  return text
}

function requireObjectId(value: unknown, field: string): string {
  const text = String(value ?? '')
  if (!ObjectId.isValid(text)) throw new Error(`${field} is invalid`)
  return text
}

export async function listCustomers(): Promise<Customer[]> {
  const db = requireDb()
  return (await db.collection<Customer>(CUSTOMERS).find({}).sort({ createdAt: -1 }).toArray()).map(withStringId)
}

export async function createCustomer(input: Partial<Customer>): Promise<Customer> {
  const db = requireDb()
  const now = new Date().toISOString()
  const customer: any = {
    name: requireText(input.name, 'Customer name'),
    email: input.email ? String(input.email).trim() : undefined,
    phone: input.phone ? String(input.phone).trim() : undefined,
    company: input.company ? String(input.company).trim() : undefined,
    category: input.category ? String(input.category).trim() : undefined,
    tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
    notes: input.notes ? String(input.notes).trim() : undefined,
    active: input.active !== false,
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection(CUSTOMERS).insertOne(customer)
  await logAudit({ action: 'crm.customer.create', resource: 'crm_customers', resourceId: result.insertedId.toString() })
  return { ...customer, _id: result.insertedId.toString() }
}

export async function updateCustomer(id: string, input: Partial<Customer>): Promise<Customer> {
  const db = requireDb()
  if (!ObjectId.isValid(id)) throw new Error('Invalid customer')
  const update: Partial<Customer> = {}
  if (input.name !== undefined) update.name = requireText(input.name, 'Customer name')
  if (input.email !== undefined) update.email = String(input.email ?? '').trim()
  if (input.phone !== undefined) update.phone = String(input.phone ?? '').trim()
  if (input.company !== undefined) update.company = String(input.company ?? '').trim()
  if (input.category !== undefined) update.category = String(input.category ?? '').trim()
  if (input.tags !== undefined) update.tags = Array.isArray(input.tags) ? input.tags.map(String) : []
  if (input.notes !== undefined) update.notes = String(input.notes ?? '').trim()
  if (input.active !== undefined) update.active = Boolean(input.active)
  if (Object.keys(update).length === 0) throw new Error('No customer changes supplied')
  const result = await db.collection<Customer>(CUSTOMERS).findOneAndUpdate(
    { _id: new ObjectId(id) } as any,
    { $set: { ...update, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  )
  if (!result) throw new Error('Customer not found')
  await logAudit({ action: 'crm.customer.update', resource: 'crm_customers', resourceId: id })
  return withStringId(result)
}

export async function listContacts(customerId?: string): Promise<Contact[]> {
  const db = requireDb()
  const filter = customerId ? { customerId } : {}
  return (await db.collection<Contact>(CONTACTS).find(filter).sort({ createdAt: -1 }).toArray()).map(withStringId)
}

export async function createContact(input: Partial<Contact>): Promise<Contact> {
  const db = requireDb()
  const now = new Date().toISOString()
  const contact: any = {
    customerId: requireObjectId(input.customerId, 'Customer'),
    name: requireText(input.name, 'Contact name'),
    email: input.email ? String(input.email).trim() : undefined,
    phone: input.phone ? String(input.phone).trim() : undefined,
    role: input.role ? String(input.role).trim() : undefined,
    primary: Boolean(input.primary),
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection(CONTACTS).insertOne(contact)
  return { ...contact, _id: result.insertedId.toString() }
}

export async function listLeads(): Promise<Lead[]> {
  const db = requireDb()
  return (await db.collection<Lead>(LEADS).find({}).sort({ createdAt: -1 }).toArray()).map(withStringId)
}

const LEAD_STATUSES: Lead['status'][] = ['new', 'contacted', 'qualified', 'lost', 'converted']

export async function createLead(input: Partial<Lead>): Promise<Lead> {
  const db = requireDb()
  const now = new Date().toISOString()
  const lead: any = {
    name: requireText(input.name, 'Lead name'),
    email: input.email ? String(input.email).trim() : undefined,
    phone: input.phone ? String(input.phone).trim() : undefined,
    source: input.source ? String(input.source).trim() : undefined,
    status: LEAD_STATUSES.includes(input.status as Lead['status']) ? input.status : 'new',
    notes: input.notes ? String(input.notes).trim() : undefined,
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection(LEADS).insertOne(lead)
  await logAudit({ action: 'crm.lead.create', resource: 'crm_leads', resourceId: result.insertedId.toString() })
  return { ...lead, _id: result.insertedId.toString() }
}

export async function listDeals(): Promise<Deal[]> {
  const db = requireDb()
  return (await db.collection<Deal>(DEALS).find({}).sort({ createdAt: -1 }).toArray()).map(withStringId)
}

const DEAL_STAGES: Deal['stage'][] = ['prospect', 'proposal', 'negotiation', 'won', 'lost']

export async function createDeal(input: Partial<Deal>): Promise<Deal> {
  const db = requireDb()
  const now = new Date().toISOString()
  const deal: any = {
    customerId: input.customerId ? requireObjectId(input.customerId, 'Customer') : undefined,
    title: requireText(input.title, 'Deal title'),
    value: input.value === undefined || input.value === null || input.value === ('' as any) ? undefined : Number(input.value),
    currency: input.currency ? String(input.currency).trim().toUpperCase() : undefined,
    stage: DEAL_STAGES.includes(input.stage as Deal['stage']) ? input.stage : 'prospect',
    notes: input.notes ? String(input.notes).trim() : undefined,
    createdAt: now,
    updatedAt: now
  }
  if (deal.value !== undefined && (!Number.isFinite(deal.value) || deal.value < 0)) throw new Error('Deal value must be zero or more')
  const result = await db.collection(DEALS).insertOne(deal)
  return { ...deal, _id: result.insertedId.toString() }
}

export async function listActivities(customerId?: string): Promise<Activity[]> {
  const db = requireDb()
  const filter = customerId ? { customerId } : {}
  return (await db.collection<Activity>(ACTIVITIES).find(filter).sort({ createdAt: -1 }).toArray()).map(withStringId)
}

const ACTIVITY_TYPES: Activity['type'][] = ['call', 'email', 'meeting', 'task']

export async function createActivity(input: Partial<Activity>): Promise<Activity> {
  const db = requireDb()
  const now = new Date().toISOString()
  const activity: any = {
    customerId: input.customerId ? requireObjectId(input.customerId, 'Customer') : undefined,
    type: ACTIVITY_TYPES.includes(input.type as Activity['type']) ? input.type : 'task',
    subject: requireText(input.subject, 'Activity subject'),
    dueDate: input.dueDate ? String(input.dueDate) : undefined,
    done: Boolean(input.done),
    notes: input.notes ? String(input.notes).trim() : undefined,
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection(ACTIVITIES).insertOne(activity)
  return { ...activity, _id: result.insertedId.toString() }
}

export async function listNotes(customerId: string): Promise<Note[]> {
  const db = requireDb()
  if (!ObjectId.isValid(customerId)) throw new Error('Invalid customer')
  return (await db.collection<Note>(NOTES).find({ customerId }).sort({ createdAt: -1 }).toArray()).map(withStringId)
}

export async function createNote(input: Partial<Note>): Promise<Note> {
  const db = requireDb()
  const now = new Date().toISOString()
  const note: any = {
    customerId: requireObjectId(input.customerId, 'Customer'),
    content: requireText(input.content, 'Note'),
    createdAt: now,
    createdBy: input.createdBy ? String(input.createdBy) : undefined
  }
  const result = await db.collection(NOTES).insertOne(note)
  await logAudit({ action: 'crm.note.create', resource: 'crm_notes', resourceId: result.insertedId.toString() })
  return { ...note, _id: result.insertedId.toString() }
}