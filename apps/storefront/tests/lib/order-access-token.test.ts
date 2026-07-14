import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createOrderAccessToken, verifyOrderAccessToken } from '@/lib/orders/access-token'

const ORDER_A = 'clorderaaaaaaaaaaaaaaaaaa'
const ORDER_B = 'clorderbbbbbbbbbbbbbbbbbb'

describe('order access tokens', () => {
  const originalSecret = process.env.NEXTAUTH_SECRET

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = 'test-secret-for-order-access-tokens'
  })

  afterEach(() => {
    process.env.NEXTAUTH_SECRET = originalSecret
  })

  it('accepts the token issued for that order', () => {
    const token = createOrderAccessToken(ORDER_A)
    expect(verifyOrderAccessToken(ORDER_A, token)).toBe(true)
  })

  it('is deterministic, so the same order can be reissued a matching token', () => {
    expect(createOrderAccessToken(ORDER_A)).toBe(createOrderAccessToken(ORDER_A))
  })

  it("rejects another order's token, so one buyer cannot read another's order", () => {
    const tokenForB = createOrderAccessToken(ORDER_B)
    expect(verifyOrderAccessToken(ORDER_A, tokenForB)).toBe(false)
  })

  it('rejects a forged or truncated token', () => {
    expect(verifyOrderAccessToken(ORDER_A, 'not-a-real-token')).toBe(false)
    expect(verifyOrderAccessToken(ORDER_A, createOrderAccessToken(ORDER_A).slice(0, -1))).toBe(false)
  })

  it('rejects a missing token', () => {
    expect(verifyOrderAccessToken(ORDER_A, null)).toBe(false)
    expect(verifyOrderAccessToken(ORDER_A, '')).toBe(false)
  })

  it('cannot be forged without the secret', () => {
    const token = createOrderAccessToken(ORDER_A)
    process.env.NEXTAUTH_SECRET = 'a-different-secret'
    expect(verifyOrderAccessToken(ORDER_A, token)).toBe(false)
  })
})
