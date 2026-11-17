import { MongoClient } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Customers (CRM) against a real MongoDB (CI: service container; local: the dev service).
const URI = process.env['MONGODB_TEST_URI'] ?? 'mongodb://127.0.0.1:27017/?directConnection=true'
const DB_NAME = `pharmacy_pos_customers_${process.pid}_${Date.now()}`
process.env['MONGODB_URI'] = URI
process.env['MONGODB_DB'] = DB_NAME

let customers: typeof import('../../src/main/customers')
let db: typeof import('../../src/main/db')

beforeAll(async () => {
  db = await import('../../src/main/db')
  customers = await import('../../src/main/customers')
  await db.connectDb()
})

afterAll(async () => {
  const raw = new MongoClient(URI)
  await raw.connect()
  await raw.db(DB_NAME).dropDatabase()
  await raw.close()
  await db.closeDb()
})

describe('customers', () => {
  it('four optional fields, at least one; discount 0–100%', async () => {
    const c = await customers.createCustomer({ phone: '+20 100 123 4567', discountBasisPoints: 1250 }, 'tester')
    expect(c).toMatchObject({ name: '', nationalId: '', phone: '+20 100 123 4567', discountBasisPoints: 1250 })
    await expect(customers.createCustomer({}, 'tester')).rejects.toThrow('CUSTOMER_EMPTY')
    await expect(customers.createCustomer({ name: 'A', discountBasisPoints: 10001 }, 'tester')).rejects.toThrow('CUSTOMER_DISCOUNT_INVALID')
    await expect(customers.createCustomer({ name: 'A', discountBasisPoints: 12.5 }, 'tester')).rejects.toThrow('CUSTOMER_DISCOUNT_INVALID')
    await expect(customers.createCustomer({ phone: 'call me' }, 'tester')).rejects.toThrow('CUSTOMER_PHONE_INVALID')
    const named = await customers.updateCustomer(c._id, { name: 'Mona', nationalId: '2990101', phone: c.phone }, 'tester')
    expect(named).toMatchObject({ name: 'Mona', discountBasisPoints: 0 })
    expect((await customers.listCustomers()).map((x) => x.name)).toEqual(['Mona'])
    await expect(customers.updateCustomer('nope', { name: 'x' }, 'tester')).rejects.toThrow('Customer not found')
  })
})
