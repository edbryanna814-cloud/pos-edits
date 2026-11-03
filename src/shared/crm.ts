export type Customer = {
  _id?: string
  name: string
  email?: string
  phone?: string
  company?: string
  category?: string
  tags?: string[]
  notes?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type Contact = {
  _id?: string
  customerId: string
  name: string
  email?: string
  phone?: string
  role?: string
  primary: boolean
  createdAt: string
  updatedAt: string
}

export type Lead = {
  _id?: string
  name: string
  email?: string
  phone?: string
  source?: string
  status: 'new' | 'contacted' | 'qualified' | 'lost' | 'converted'
  notes?: string
  createdAt: string
  updatedAt: string
}

export type Deal = {
  _id?: string
  customerId?: string
  leadId?: string
  title: string
  value?: number
  currency?: string
  stage: 'prospect' | 'proposal' | 'negotiation' | 'won' | 'lost'
  notes?: string
  createdAt: string
  updatedAt: string
}

export type Activity = {
  _id?: string
  customerId?: string
  type: 'call' | 'email' | 'meeting' | 'task'
  subject: string
  dueDate?: string
  done: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export type Note = {
  _id?: string
  customerId: string
  content: string
  createdAt: string
  createdBy?: string
}
