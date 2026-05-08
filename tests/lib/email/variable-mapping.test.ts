import { describe, expect, it } from 'vitest'
import {
  resolveMapping,
  resolveVariablesForRecipient,
  type SubscriberLike,
  type VariableMappings,
} from '@/lib/email/variable-mapping'

const subscriber: SubscriberLike = {
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '555-0100',
  customFields: { loyaltyTier: 'gold' },
}

describe('resolveMapping (discountCode)', () => {
  it('returns the code string when the id is in the discount-code map', () => {
    const got = resolveMapping(
      { source: 'discountCode', key: 'dc_1' },
      subscriber,
      { discountCodes: { dc_1: 'SAVE20' } },
    )
    expect(got).toBe('SAVE20')
  })

  it('falls back when the id is missing from the map', () => {
    const got = resolveMapping(
      { source: 'discountCode', key: 'dc_missing', fallback: 'NONE' },
      subscriber,
      { discountCodes: { dc_1: 'SAVE20' } },
    )
    expect(got).toBe('NONE')
  })

  it('falls back when context.discountCodes is omitted entirely', () => {
    const got = resolveMapping(
      { source: 'discountCode', key: 'dc_1', fallback: 'NONE' },
      subscriber,
    )
    expect(got).toBe('NONE')
  })

  it('falls back when key is missing on the mapping', () => {
    const got = resolveMapping(
      { source: 'discountCode', fallback: 'NONE' },
      subscriber,
      { discountCodes: { dc_1: 'SAVE20' } },
    )
    expect(got).toBe('NONE')
  })
})

describe('resolveVariablesForRecipient', () => {
  it('resolves a mix of subscriber, customField, and discountCode tokens', () => {
    const mappings: VariableMappings = {
      firstName: { source: 'subscriberFirstName' },
      tier: { source: 'customField', key: 'loyaltyTier' },
      offerCode: { source: 'discountCode', key: 'dc_1' },
    }
    const out = resolveVariablesForRecipient(mappings, subscriber, {
      discountCodes: { dc_1: 'SAVE20' },
    })
    expect(out).toEqual({
      firstName: 'Jane',
      tier: 'gold',
      offerCode: 'SAVE20',
    })
  })

  it('uses fallback for an unmatched discountCode id', () => {
    const out = resolveVariablesForRecipient(
      { offer: { source: 'discountCode', key: 'dc_x', fallback: '' } },
      subscriber,
      { discountCodes: {} },
    )
    expect(out.offer).toBe('')
  })
})
