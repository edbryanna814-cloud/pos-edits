import { ObjectId, type Db } from 'mongodb'
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

function withStringId<T>(doc: T): T {
  return { ...doc, _id: String((doc as { _id?: unknown })._id) }
}

function requireText(value: unknown, field: string): string {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${field} is required`)
  return text
}

function toPrice(value: unknown): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) throw new Error('Price must be an integer number of cents')
  return n
}

function addPeriod(date: Date, period: SoftwarePlan['billingPeriod']): Date {
  const next = new Date(date)
  if (period === 'yearly') next.setFullYear(next.getFullYear() + 1)
  else next.setMonth(next.getMonth() + 1)
  return next
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
  return (await db.collection<SoftwarePlan>(PLANS).find({}).sort({ priceCents: 1 }).toArray()).map(withStringId)
}

export async function createPlan(input: Partial<SoftwarePlan>): Promise<SoftwarePlan> {
  const db = requireDb()
  const now = new Date().toISOString()
  const currency = String(input.currency ?? 'USD').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be a 3-letter code')
  const plan: any = {
    name: requireText(input.name, 'Plan name'),
    priceCents: toPrice(input.priceCents ?? 0),
    currency,
    billingPeriod: input.billingPeriod === 'yearly' ? 'yearly' : 'monthly',
    active: input.active !== false,
    createdAt: now,
    updatedAt: now
  }
  const r = await db.collection(PLANS).insertOne(plan)
  await logAudit({ action: 'subscription.plan.create', resource: 'sub_plans', resourceId: r.insertedId.toString() })
  return { ...plan, _id: r.insertedId.toString() }
}

export async function getSubscription(): Promise<SoftwareSubscription | null> {
  const db = requireDb()
  const sub = await db.collection<SoftwareSubscription>(SUBS).findOne({})
  return sub ? withStringId(sub) : null
}

export async function createSubscription(input: Partial<SoftwareSubscription>): Promise<SoftwareSubscription> {
  const db = requireDb()
  if (!ObjectId.isValid(String(input.planId || ''))) throw new Error('Plan is required')
  const plan = await db.collection<SoftwarePlan>(PLANS).findOne({ _id: new ObjectId(String(input.planId)) } as any)
  if (!plan) throw new Error('Plan not found')
  if (plan.active === false) throw new Error('Plan is inactive')
  const now = new Date().toISOString()
  const start = new Date()
  const end = addPeriod(start, plan.billingPeriod)
  const statuses: SoftwareSubscription['status'][] = ['pending', 'trialing', 'active', 'past_due', 'canceled', 'expired', 'suspended']
  const sub: any = {
    planId: String(input.planId),
    status: statuses.includes(input.status as SoftwareSubscription['status']) ? input.status : 'active',
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
  return { ...sub, _id: r.insertedId.toString() }
}

export async function renewSubscription(): Promise<SoftwareSubscription> {
  const db = requireDb()
  const sub = await db.collection<SoftwareSubscription>(SUBS).findOne({})
  if (!sub) throw new Error('No subscription')
  if (!ObjectId.isValid(String(sub.planId || ''))) throw new Error('Subscription plan is invalid')
  const plan = await db.collection<SoftwarePlan>(PLANS).findOne({ _id: new ObjectId(String(sub.planId)) } as any)
  if (!plan) throw new Error('Subscription plan not found')
  const now = new Date()
  const base = new Date(sub.currentPeriodEnd) > now ? new Date(sub.currentPeriodEnd) : now
  const end = addPeriod(base, plan.billingPeriod)
  const iso = now.toISOString()
  const result = await db.collection<SoftwareSubscription>(SUBS).findOneAndUpdate(
    { _id: sub._id } as any,
    {
      $set: {
        status: 'active',
        currentPeriodStart: base.toISOString(),
        currentPeriodEnd: end.toISOString(),
        nextRenewalDate: end.toISOString(),
        updatedAt: iso
      }
    },
    { returnDocument: 'after' }
  )
  if (!result) throw new Error('Could not renew subscription')
  await db.collection(PAYMENTS).insertOne({
    subscriptionId: String(result._id),
    amountCents: plan.priceCents,
    currency: plan.currency,
    status: 'paid',
    paidAt: iso,
    createdAt: iso
  } as any)
  await logAudit({ action: 'subscription.renew', resource: 'sub_subscriptions', resourceId: String(result._id) })
  return withStringId(result)
}

export async function setSubscriptionStatus(
  status: SoftwareSubscription['status']
): Promise<SoftwareSubscription> {
  const db = requireDb()
  const statuses: SoftwareSubscription['status'][] = [
    'pending',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'expired',
    'suspended'
  ]
  if (!statuses.includes(status)) throw new Error('Invalid subscription status')
  const sub = await db.collection<SoftwareSubscription>(SUBS).findOne({})
  if (!sub) throw new Error('No subscription')
  const result = await db.collection<SoftwareSubscription>(SUBS).findOneAndUpdate(
    { _id: sub._id } as any,
    { $set: { status, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  )
  if (!result) throw new Error('Could not update subscription')
  await logAudit({ action: 'subscription.status', resource: 'sub_subscriptions', resourceId: String(result._id) })
  return withStringId(result)
}

export async function listPayments(): Promise<SubscriptionPayment[]> {
  const db = requireDb()
  return (await db.collection<SubscriptionPayment>(PAYMENTS).find({}).sort({ createdAt: -1 }).toArray()).map(withStringId)
}
