import type { Db } from 'mongodb'
import { getDb } from './db'
import type { SoftwarePlan, SoftwareSubscription, SubscriptionPayment } from '../shared/subscription'
import { logAudit } from './auth'

const PLANS = 'sub_plans'
const SUBS = 'sub_subscriptions'
const PAYMENTS = 'sub_payments'

function requireDb(): Db {
  const db = getDb()
  if (!db) throw new Error('Database unavailable')
  return db
}

export async function ensureSubscriptionSchema(): Promise<void> {
  const db = requireDb()
  const cols = await db.listCollections({ name: { $in: [PLANS, SUBS, PAYMENTS] } }).toArray()
  const names = new Set(cols.map((c) => c.name))
  if (!names.has(PLANS)) { await db.createCollection(PLANS) }
  if (!names.has(SUBS)) { await db.createCollection(SUBS) }
  if (!names.has(PAYMENTS)) { await db.createCollection(PAYMENTS) }
}

export async function listPlans(): Promise<SoftwarePlan[]> {
  const db = requireDb()
  return db.collection<SoftwarePlan>(PLANS).find({}).toArray()
}

export async function createPlan(input: Partial<SoftwarePlan>): Promise<SoftwarePlan> {
  const db = requireDb()
  const now = new Date().toISOString()
  const plan: any = {
    name: input.name || '',
    priceCents: Number(input.priceCents) || 0,
    currency: input.currency || 'USD',
    billingPeriod: input.billingPeriod || 'monthly',
    active: input.active !== false,
    createdAt: now,
    updatedAt: now
  }
  const r = await db.collection(PLANS).insertOne(plan)
  await logAudit({ action: 'subscription.plan.create', resource: 'sub_plans', resourceId: r.insertedId.toString() })
  return { _id: r.insertedId.toString(), ...plan }
}

export async function getSubscription(): Promise<SoftwareSubscription | null> {
  const db = requireDb()
  return db.collection<SoftwareSubscription>(SUBS).findOne({})
}

export async function createSubscription(input: Partial<SoftwareSubscription>): Promise<SoftwareSubscription> {
  const db = requireDb()
  const now = new Date().toISOString()
  const start = new Date()
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  const sub: any = {
    planId: input.planId || '',
    status: input.status || 'active',
    startDate: start.toISOString(),
    currentPeriodStart: start.toISOString(),
    currentPeriodEnd: end.toISOString(),
    nextRenewalDate: end.toISOString(),
    createdAt: now,
    updatedAt: now
  }
  await db.collection(SUBS).deleteMany({})
  const r = await db.collection(SUBS).insertOne(sub)
  await logAudit({ action: 'subscription.create', resource: 'sub_subscriptions', resourceId: r.insertedId.toString() })
  return { _id: r.insertedId.toString(), ...sub }
}

export async function renewSubscription(): Promise<SoftwareSubscription> {
  const db = requireDb()
  const now = new Date().toISOString()
  const end = new Date()
  end.setMonth(end.getMonth() + 1)
  const sub = await db.collection<SoftwareSubscription>(SUBS).findOne({})
  if (!sub) throw new Error('No subscription')
  const { ObjectId } = await import('mongodb')
  const result = await db.collection(SUBS).findOneAndUpdate({ _id: sub._id } as any, { $set: { status: 'active', currentPeriodStart: now, currentPeriodEnd: end.toISOString(), nextRenewalDate: end.toISOString(), updatedAt: now } }, { returnDocument: 'after' } as any)
  await logAudit({ action: 'subscription.renew', resource: 'sub_subscriptions' })
  // record payment
  await db.collection(PAYMENTS).insertOne({ subscriptionId: (result as any)._id?.toString(), amountCents: 0, currency: 'USD', status: 'paid', paidAt: now, createdAt: now })
  return result as any
}

export async function listPayments(): Promise<SubscriptionPayment[]> {
  const db = requireDb()
  return db.collection<SubscriptionPayment>(PAYMENTS).find({}).sort({ createdAt: -1 }).toArray()
}
