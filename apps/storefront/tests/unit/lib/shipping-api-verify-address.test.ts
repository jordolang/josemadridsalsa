/**
 * Tests for verifyShippingAddress (Pirate Ship / EasyPost address cross-reference)
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ShippingAddress } from '@/lib/shipping-api'

const addressCreateSpy = vi.fn()

vi.mock('@easypost/api', () => ({
  default: class MockEasyPostClient {
    Address: { create: typeof addressCreateSpy }
    constructor() {
      this.Address = { create: addressCreateSpy }
    }
  },
}))

const originalEnv = { ...process.env }

const input: ShippingAddress = {
  name: 'Jane Doe',
  street1: '123 salsa st',
  city: 'zanesville',
  state: 'oh',
  zip: '43701',
  country: 'US',
}

async function importVerify() {
  const mod = await import('@/lib/shipping-api')
  return mod.verifyShippingAddress
}

describe('verifyShippingAddress', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.SHIPPING_API_KEY = 'EZAK_test_verify'
    process.env.SHIPPING_PROVIDER = 'easypost'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns "skipped" when no API key is configured', async () => {
    delete process.env.SHIPPING_API_KEY
    const verify = await importVerify()

    const result = await verify(input)

    expect(result.status).toBe('skipped')
    expect(addressCreateSpy).not.toHaveBeenCalled()
  })

  it('returns "skipped" for a non-EasyPost provider', async () => {
    process.env.SHIPPING_PROVIDER = 'shippo'
    const verify = await importVerify()

    const result = await verify(input)

    expect(result.status).toBe('skipped')
    expect(addressCreateSpy).not.toHaveBeenCalled()
  })

  it('returns "verified" with the normalized address on a clean delivery', async () => {
    addressCreateSpy.mockResolvedValue({
      name: 'Jane Doe',
      street1: '123 SALSA ST',
      city: 'ZANESVILLE',
      state: 'OH',
      zip: '43701-1234',
      country: 'US',
      verifications: { delivery: { success: true, errors: [] } },
    })
    const verify = await importVerify()

    const result = await verify(input)

    expect(result.status).toBe('verified')
    expect(result.messages).toEqual([])
    expect(result.normalized?.street1).toBe('123 SALSA ST')
    expect(result.normalized?.zip).toBe('43701-1234')
    // The verify request is sent to EasyPost with delivery verification requested.
    expect(addressCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ verify: ['delivery'] })
    )
  })

  it('returns "warning" when delivery succeeds but the carrier flags fields', async () => {
    addressCreateSpy.mockResolvedValue({
      street1: '123 Salsa St',
      city: 'Zanesville',
      state: 'OH',
      zip: '43701',
      country: 'US',
      verifications: {
        delivery: {
          success: true,
          errors: [{ field: 'street1', message: 'Address was standardized' }],
        },
      },
    })
    const verify = await importVerify()

    const result = await verify(input)

    expect(result.status).toBe('warning')
    expect(result.messages).toEqual(['Address was standardized'])
    expect(result.normalized).toBeDefined()
  })

  it('returns "failed" when the address is not deliverable', async () => {
    addressCreateSpy.mockResolvedValue({
      verifications: {
        delivery: {
          success: false,
          errors: [{ field: 'zip' }],
        },
      },
    })
    const verify = await importVerify()

    const result = await verify(input)

    expect(result.status).toBe('failed')
    // An error without a message falls back to naming the invalid field.
    expect(result.messages).toEqual(['Invalid zip'])
    expect(result.normalized).toBeUndefined()
  })

  it('returns a default message when a failed delivery reports no errors', async () => {
    addressCreateSpy.mockResolvedValue({
      verifications: { delivery: { success: false, errors: [] } },
    })
    const verify = await importVerify()

    const result = await verify(input)

    expect(result.status).toBe('failed')
    expect(result.messages).toEqual(['Address could not be verified as deliverable'])
  })

  it('degrades to "skipped" (never throws) when the provider errors', async () => {
    addressCreateSpy.mockRejectedValue(new Error('EasyPost 500'))
    const verify = await importVerify()

    const result = await verify(input)

    expect(result.status).toBe('skipped')
    expect(result.messages).toEqual(['EasyPost 500'])
  })
})
