import { ObjectId, type Db } from 'mongodb'
import { getDb } from './db'
import { logAudit } from './auth'
import type { Customer } from '../shared/customers'

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
  const email = text(input?.email, 120)
  const address = text(input?.address, 240)
  const notes = text(input?.notes, 500)
  if (phone && !/^[+\d][\d\s-]{2,29}$/.test(phone)) throw new Error('CUSTOMER_PHONE_INVALID')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('CUSTOMER_EMAIL_INVALID')
  const raw = input?.discountBasisPoints
  const discountBasisPoints = raw === undefined || raw === null || raw === '' ? 0 : Number(raw)
  if (!(Number.isInteger(discountBasisPoints) && discountBasisPoints >= 0 && discountBasisPoints <= 10000)) throw new Error('CUSTOMER_DISCOUNT_INVALID')
  if (!name && !nationalId && !phone && !email) throw new Error('CUSTOMER_EMPTY')
  const active = input?.active === undefined ? true : Boolean(input.active)
  return { name, nationalId, phone, ...(email ? { email } : {}), ...(address ? { address } : {}), ...(notes ? { notes } : {}), discountBasisPoints, active }
}

const withId = (doc: any): Customer => ({ active: true, ...doc, _id: String(doc._id) })

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
  const now = new Date().toISOString()
  const updated = await requireDb().collection(COL).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...fields(input), updatedAt: now } },
    { returnDocument: 'after' }
  )
  if (!updated) throw new Error('Customer not found')
  await logAudit({ actorUsername: actor, action: 'customer.update', resource: COL, resourceId: id })
  return withId(updated)
}

/** For a sale: the customer's display name (name, else phone, else ID), or null when not found. */
export async function customerForSale(db: Db, id: unknown, session?: any): Promise<{ customerId: string; customerName: string; customerPhone?: string } | null> {
  if (id === undefined || id === null || id === '') return null
  if (typeof id !== 'string' || !ObjectId.isValid(id)) throw new Error('Customer not found')
  const c = await db.collection(COL).findOne({ _id: new ObjectId(id) }, { session })
  if (!c) throw new Error('Customer not found')
  return { customerId: id, customerName: String(c.name || c.phone || c.nationalId || ''), ...(c.phone ? { customerPhone: String(c.phone) } : {}) }
}

/** Records referenced by sales/transactions must not be hard-deleted; archive/deactivate instead. */
export async function deleteCustomer(id: unknown, actor: string): Promise<{ ok: true }> {
  if (typeof id !== 'string' || !ObjectId.isValid(id)) throw new Error('Customer not found')
  const db = requireDb()
  const _id = new ObjectId(id)
  const c = await db.collection(COL).findOne({ _id })
  if (!c) throw new Error('Customer not found')
  const referenced = await db.collection('pos_sales').findOne({ customerId: id }, { projection: { _id: 1 } })
  if (referenced) {
    await db.collection(COL).updateOne({ _id }, { $set: { active: false, updatedAt: new Date().toISOString() } })
    await logAudit({ actorUsername: actor, action: 'customer.archive', resource: COL, resourceId: id, details: { name: c.name, phone: c.phone, referenced: true } })
    return { ok: true }
  }
  await db.collection(COL).deleteOne({ _id })
  await logAudit({ actorUsername: actor, action: 'customer.delete', resource: COL, resourceId: id, details: { name: c.name, phone: c.phone } })
  return { ok: true }
}
