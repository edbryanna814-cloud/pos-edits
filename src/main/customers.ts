import { ObjectId, type Db } from 'mongodb'
import { getDb } from './db'
import { logAudit } from './auth'
import type { Customer } from '../shared/customers'

// Customers (CRM): four optional fields, at least one filled. The discount is a percentage the POS
// fills in when the customer is chosen (the seller can still change it for that sale).

const COL = 'customers'

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

const text = (value: unknown, max: number) => (value === undefined || value === null ? '' : String(value).trim().slice(0, max))

function fields(input: any): Omit<Customer, '_id' | 'createdAt' | 'updatedAt'> {
  const name = text(input?.name, 120)
  const nationalId = text(input?.nationalId, 40)
  const phone = text(input?.phone, 30)
  if (phone && !/^[+\d][\d\s-]{2,29}$/.test(phone)) throw new Error('CUSTOMER_PHONE_INVALID')
  const raw = input?.discountBasisPoints
  const discountBasisPoints = raw === undefined || raw === null || raw === '' ? 0 : Number(raw)
  if (!(Number.isInteger(discountBasisPoints) && discountBasisPoints >= 0 && discountBasisPoints <= 10000)) throw new Error('CUSTOMER_DISCOUNT_INVALID')
  if (!name && !nationalId && !phone) throw new Error('CUSTOMER_EMPTY')
  return { name, nationalId, phone, discountBasisPoints }
}

const withId = (doc: any): Customer => ({ ...doc, _id: String(doc._id) })

export async function listCustomers(): Promise<Customer[]> {
  return (await requireDb().collection(COL).find({}).sort({ name: 1, phone: 1 }).limit(5000).toArray()).map(withId)
}

export async function createCustomer(input: unknown, actor: string): Promise<Customer> {
  const now = new Date().toISOString()
  const doc = { ...fields(input), createdAt: now, updatedAt: now }
  const r = await requireDb().collection(COL).insertOne({ ...doc })
  await logAudit({ actorUsername: actor, action: 'customer.create', resource: COL, resourceId: r.insertedId.toString() })
  return { ...doc, _id: r.insertedId.toString() }
}

export async function updateCustomer(id: unknown, input: unknown, actor: string): Promise<Customer> {
  if (typeof id !== 'string' || !ObjectId.isValid(id)) throw new Error('Customer not found')
  const updated = await requireDb().collection(COL).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...fields(input), updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  )
  if (!updated) throw new Error('Customer not found')
  await logAudit({ actorUsername: actor, action: 'customer.update', resource: COL, resourceId: id })
  return withId(updated)
}

/** For a sale: the customer's display name (name, else phone, else ID), or null when not found. */
export async function customerForSale(db: Db, id: unknown, session?: any): Promise<{ customerId: string; customerName: string } | null> {
  if (id === undefined || id === null || id === '') return null
  if (typeof id !== 'string' || !ObjectId.isValid(id)) throw new Error('Customer not found')
  const c = await db.collection(COL).findOne({ _id: new ObjectId(id) }, { session })
  if (!c) throw new Error('Customer not found')
  return { customerId: id, customerName: String(c.name || c.phone || c.nationalId || '') }
}
