import { describe, it, expect } from 'vitest'
import { getOrderPrimaryCta } from '@/lib/admin/order-primary-cta'

describe('getOrderPrimaryCta', () => {
  it('PENDING → Confirm order, sets status to CONFIRMED', () => {
    const cta = getOrderPrimaryCta({ status: 'PENDING', hasTracking: false })
    expect(cta).toEqual({
      label: 'Confirm order',
      action: 'update-status',
      nextStatus: 'CONFIRMED',
    })
  })

  it('CONFIRMED → Start processing', () => {
    expect(
      getOrderPrimaryCta({ status: 'CONFIRMED', hasTracking: false }),
    ).toMatchObject({ label: 'Start processing', nextStatus: 'PROCESSING' })
  })

  it('PROCESSING + no tracking → Add tracking', () => {
    expect(
      getOrderPrimaryCta({ status: 'PROCESSING', hasTracking: false }),
    ).toMatchObject({ label: 'Add tracking', action: 'add-tracking' })
  })

  it('PROCESSING + has tracking → Mark shipped', () => {
    expect(
      getOrderPrimaryCta({ status: 'PROCESSING', hasTracking: true }),
    ).toMatchObject({ label: 'Mark shipped', nextStatus: 'SHIPPED' })
  })

  it('SHIPPED → View tracking', () => {
    expect(
      getOrderPrimaryCta({ status: 'SHIPPED', hasTracking: true }),
    ).toMatchObject({ label: 'View tracking', action: 'view-tracking' })
  })

  it('DELIVERED → Send thank-you', () => {
    expect(
      getOrderPrimaryCta({ status: 'DELIVERED', hasTracking: true }),
    ).toMatchObject({ label: 'Send thank-you', action: 'send-email' })
  })

  it('CANCELLED → Send email', () => {
    expect(
      getOrderPrimaryCta({ status: 'CANCELLED', hasTracking: false }),
    ).toMatchObject({ label: 'Send email', action: 'send-email' })
  })

  it('REFUNDED → Send email', () => {
    expect(
      getOrderPrimaryCta({ status: 'REFUNDED', hasTracking: false }),
    ).toMatchObject({ label: 'Send email', action: 'send-email' })
  })
})
