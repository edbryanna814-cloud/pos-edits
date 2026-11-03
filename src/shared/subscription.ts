export type SoftwarePlan = {
  _id?: string
  name: string
  priceCents: number
  currency: string
  billingPeriod: 'monthly' | 'yearly'
  active: boolean
  createdAt: string
  updatedAt: string
}

export type SoftwareSubscription = {
  _id?: string
  planId: string
  status: 'pending' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'suspended'
  startDate: string
  currentPeriodStart: string
  currentPeriodEnd: string
  nextRenewalDate: string
  createdAt: string
  updatedAt: string
}

export type SubscriptionPayment = {
  _id?: string
  subscriptionId: string
  amountCents: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  paidAt?: string
  createdAt: string
}
