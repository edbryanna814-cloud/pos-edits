import { describe, expect, it } from 'vitest'
import { IPC } from '../../src/shared/ipc'
import { IPC_ARGS, LIMITS, assertSafeValue, publicError, validateIpcArgs } from '../../src/main/ipcSchema'

const ok = (fn: () => void) => expect(fn).not.toThrow()
const bad = (fn: () => void) => expect(fn).toThrow('VALIDATION_FAILED')

describe('IPC schema (Gate 1 S3)', () => {
  it('has a schema for every IPC channel', () => {
    for (const channel of Object.values(IPC)) expect(IPC_ARGS[channel], channel).toBeDefined()
    expect(Object.keys(IPC_ARGS).sort()).toEqual(Object.values(IPC).sort())
  })

  it('accepts well-formed arguments', () => {
    ok(() => validateIpcArgs(IPC.AuthLogin, [{ username: 'owner', password: 'x' }]))
    ok(() => validateIpcArgs(IPC.UsersUpdate, ['65a1b2c3d4e5f60718293a4b', { role: 'Cashier' }]))
    ok(() => validateIpcArgs(IPC.AuditList, []))
    ok(() => validateIpcArgs(IPC.AuditList, [undefined]))
    ok(() => validateIpcArgs(IPC.PosCashIn, [500, 'float']))
    ok(() => validateIpcArgs(IPC.InvPOReceive, ['65a1b2c3d4e5f60718293a4b']))
  })

  it('rejects wrong types, bad ids, extra arguments', () => {
    bad(() => validateIpcArgs(IPC.AuthLogin, ['owner']))
    bad(() => validateIpcArgs(IPC.AuthLogin, [[{ username: 'a' }]]))
    bad(() => validateIpcArgs(IPC.UsersUpdate, ['not-an-id', {}]))
    bad(() => validateIpcArgs(IPC.UsersUpdate, [{ $ne: null }, {}]))
    bad(() => validateIpcArgs(IPC.PosCashIn, [1.5, 'x']))
    bad(() => validateIpcArgs(IPC.PosCashIn, ['500', 'x']))
    bad(() => validateIpcArgs(IPC.PosShiftOpen, [Number.NaN]))
    bad(() => validateIpcArgs(IPC.Ping, ['unexpected']))
    bad(() => validateIpcArgs(IPC.InvStockMovementsList, [{ $ne: null }]))
  })

  it('rejects MongoDB operators and dotted keys anywhere in the payload (NoSQL injection)', () => {
    bad(() => validateIpcArgs(IPC.AuthLogin, [{ username: { $ne: null }, password: { $gt: '' } }]))
    bad(() => validateIpcArgs(IPC.PosCheckout, [{ items: [{ productId: { $where: '1' } }] }]))
    bad(() => validateIpcArgs(IPC.InvProductsCreate, [{ 'stock.quantity': 5 }]))
    bad(() => validateIpcArgs(IPC.SettingsSave, [JSON.parse('{"__proto__": {"polluted": 1}}')]))
  })

  it('bounds size and depth', () => {
    bad(() => assertSafeValue('x'.repeat(LIMITS.maxString + 1)))
    bad(() => assertSafeValue(new Array(LIMITS.maxArray + 1).fill(0)))
    let deep: unknown = 1
    for (let i = 0; i < LIMITS.maxDepth + 2; i++) deep = { a: deep }
    bad(() => assertSafeValue(deep))
    bad(() => assertSafeValue(new Date()))
    bad(() => assertSafeValue(() => 1))
    bad(() => assertSafeValue(Infinity))
  })

  it('never leaks database or runtime errors to the renderer', () => {
    const dup = Object.assign(new Error('E11000 duplicate key error collection: pharmacy_pos.users index: username_1'), { name: 'MongoServerError', code: 11000 })
    expect(publicError(dup).message).toBe('DUPLICATE')
    const net = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:27017'), { name: 'MongoNetworkError' })
    expect(publicError(net).message).toBe('INTERNAL_ERROR')
    expect(publicError(new TypeError("Cannot read properties of undefined (reading 'x')")).message).toBe('INTERNAL_ERROR')
    expect(publicError('boom').message).toBe('INTERNAL_ERROR')
    expect(publicError(new Error('LOGIN_FAILED')).message).toBe('LOGIN_FAILED')
    expect(publicError(new Error('Product name is required')).message).toBe('Product name is required')
  })
})
