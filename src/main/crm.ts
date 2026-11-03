import type { Db } from 'mongodb'
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

export async function listCustomers(): Promise<Customer[]> {
  const db = requireDb()
  return db.collection<Customer>(CUSTOMERS).find({}).sort({ createdAt: -1 }).toArray()
}

export async function createCustomer(input: Partial<Customer>): Promise<Customer> {
  const db = requireDb()
  const now = new Date().toISOString()
  const customer: any = { name: input.name || '', email: input.email, phone: input.phone, company: input.company, category: input.category, tags: input.tags || [], notes: input.notes, active: input.active !== false, createdAt: now, updatedAt: now }
  const result = await db.collection(CUSTOMERS).insertOne(customer)
  await logAudit({ action: 'crm.customer.create', resource: 'crm_customers', resourceId: result.insertedId.toString() })
  return { _id: result.insertedId.toString(), ...customer } as Customer
}

export async function updateCustomer(id: string, input: Partial<Customer>): Promise<Customer> {
  const db = requireDb()
  const { ObjectId } = await import('mongodb')
  const update: any = { $set: { ...input, updatedAt: new Date().toISOString() } }
  delete update.$set._id
  const result = await db.collection(CUSTOMERS).findOneAndUpdate({ _id: new ObjectId(id) } as any, update, { returnDocument: 'after' } as any)
  if (!result) throw new Error('Customer not found')
  await logAudit({ action: 'crm.customer.update', resource: 'crm_customers', resourceId: id })
  return result as any
}

export async function listContacts(customerId?: string): Promise<Contact[]> {
  const db = requireDb()
  const filter = customerId ? { customerId } : {}
  return db.collection<Contact>(CONTACTS).find(filter).toArray()
}

export async function createContact(input: Partial<Contact>): Promise<Contact> {
  const db = requireDb()
  const now = new Date().toISOString()
  const contact: any = { customerId: input.customerId || '', name: input.name || '', email: input.email, phone: input.phone, role: input.role, primary: !!input.primary, createdAt: now, updatedAt: now }
  const result = await db.collection(CONTACTS).insertOne(contact)
  return { _id: result.insertedId.toString(), ...contact } as Contact
}

export async function listLeads(): Promise<Lead[]> {
  const db = requireDb()
  return db.collection<Lead>(LEADS).find({}).sort({ createdAt: -1 }).toArray()
}

export async function createLead(input: Partial<Lead>): Promise<Lead> {
  const db = requireDb()
  const now = new Date().toISOString()
  const lead: any = { name: input.name || '', email: input.email, phone: input.phone, source: input.source, status: input.status || 'new', notes: input.notes, createdAt: now, updatedAt: now }
  const result = await db.collection(LEADS).insertOne(lead)
  await logAudit({ action: 'crm.lead.create', resource: 'crm_leads', resourceId: result.insertedId.toString() })
  return { _id: result.insertedId.toString(), ...lead } as Lead
}

export async function listDeals(): Promise<Deal[]> {
  const db = requireDb()
  return db.collection<Deal>(DEALS).find({}).sort({ createdAt: -1 }).toArray()
}

export async function createDeal(input: Partial<Deal>): Promise<Deal> {
  const db = requireDb()
  const now = new Date().toISOString()
  const deal: any = { customerId: input.customerId, leadId: input.leadId, title: input.title || '', value: input.value, currency: input.currency, stage: input.stage || 'prospect', notes: input.notes, createdAt: now, updatedAt: now }
  const result = await db.collection(DEALS).insertOne(deal)
  return { _id: result.insertedId.toString(), ...deal } as Deal
}

export async function listActivities(customerId?: string): Promise<Activity[]> {
  const db = requireDb()
  const filter = customerId ? { customerId } : {}
  return db.collection<Activity>(ACTIVITIES).find(filter).sort({ createdAt: -1 }).toArray()
}

export async function createActivity(input: Partial<Activity>): Promise<Activity> {
  const db = requireDb()
  const now = new Date().toISOString()
  const activity: any = { customerId: input.customerId, type: input.type || 'task', subject: input.subject || '', dueDate: input.dueDate, done: !!input.done, notes: input.notes, createdAt: now, updatedAt: now }
  const result = await db.collection(ACTIVITIES).insertOne(activity)
  return { _id: result.insertedId.toString(), ...activity } as Activity
}

export async function listNotes(customerId: string): Promise<Note[]> {
  const db = requireDb()
  return db.collection<Note>(NOTES).find({ customerId }).sort({ createdAt: -1 }).toArray()
}

export async function createNote(input: Partial<Note>): Promise<Note> {
  const db = requireDb()
  const now = new Date().toISOString()
  const note: any = { customerId: input.customerId || '', content: input.content || '', createdAt: now, createdBy: input.createdBy }
  const result = await db.collection(NOTES).insertOne(note)
  await logAudit({ action: 'crm.note.create', resource: 'crm_notes', resourceId: result.insertedId.toString() })
  return { _id: result.insertedId.toString(), ...note } as Note
}
