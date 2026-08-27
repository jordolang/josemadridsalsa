import { describe, expect, it } from 'vitest'

import { SALES_CHANNEL_LABELS, deriveSalesChannel } from '@/lib/orders/sales-channel'

describe('deriveSalesChannel', () => {
  it('defaults to the website when nothing else applies', () => {
    expect(deriveSalesChannel({})).toBe('WEBSITE')
    expect(deriveSalesChannel({ paymentChannel: 'ONLINE' })).toBe('WEBSITE')
  })

  it('honours an explicitly supplied channel above every signal', () => {
    expect(
      deriveSalesChannel({ explicitChannel: 'PHONE', fundraiserId: 'f1', paymentChannel: 'POS' })
    ).toBe('PHONE')
  })

  it('attributes fundraiser sales to the campaign even when rung up on the terminal', () => {
    // Precedence is deliberate: campaign attribution outranks the terminal used.
    expect(deriveSalesChannel({ fundraiserId: 'f1', paymentChannel: 'POS' })).toBe('FUNDRAISER')
    expect(deriveSalesChannel({ participantId: 'p1', paymentChannel: 'POS' })).toBe('FUNDRAISER')
  })

  it('identifies in-person sales', () => {
    expect(deriveSalesChannel({ paymentChannel: 'POS' })).toBe('POS')
  })

  it('honours an explicit marketplace channel', () => {
    // Marketplace sales are entered by hand now that there is no storefront sync to derive
    // them from, so they arrive as an explicit channel rather than being inferred.
    expect(deriveSalesChannel({ explicitChannel: 'MARKETPLACE' })).toBe('MARKETPLACE')
  })

  it('identifies migrated rows', () => {
    expect(deriveSalesChannel({ importSource: 'bigcommerce' })).toBe('IMPORT')
  })

  it('ignores empty-string signals rather than treating them as present', () => {
    expect(deriveSalesChannel({ fundraiserId: '', importSource: '' })).toBe(
      'WEBSITE'
    )
  })

  it('honours an explicit event sale channel', () => {
    // Event sales are entered by hand, so they arrive as an explicit channel rather than being
    // derived from a signal.
    expect(deriveSalesChannel({ explicitChannel: 'EVENT' })).toBe('EVENT')
  })
})

describe('SALES_CHANNEL_LABELS', () => {
  it('labels the event channel so it shows in filters and reports', () => {
    expect(SALES_CHANNEL_LABELS.EVENT).toBe('Event')
  })
})
