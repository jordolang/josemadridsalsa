import { describe, it, expect } from 'vitest'
import { getOrderPrimaryCta } from '@/lib/admin/order-primary-cta'

describe('getOrderPrimaryCta', () => {
  it('PENDING → Confirm order, sets status to CONFIRMED', () => {
    const cta = getOrderPrimaryCta({
      status: 'PENDING',
      paymentStatus: 'PAID',
      hasTracking: false,
    })
    expect(cta).toEqual({
      label: 'Confirm order',
      action: 'update-status',
      nextStatus: 'CONFIRMED',
    })
  })

  it('CONFIRMED → Start processing', () => {
    expect(
      getOrderPrimaryCta({
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        hasTracking: false,
      }),
    ).toMatchObject({ label: 'Start processing', nextStatus: 'PROCESSING' })
  })

  it('PROCESSING + no tracking → Add tracking', () => {
    expect(
      getOrderPrimaryCta({
        status: 'PROCESSING',
        paymentStatus: 'PAID',
        hasTracking: false,
      }),
    ).toMatchObject({ label: 'Add tracking', action: 'add-tracking' })
  })

  it('PROCESSING + has tracking → Mark shipped', () => {
    expect(
      getOrderPrimaryCta({
        status: 'PROCESSING',
        paymentStatus: 'PAID',
        hasTracking: true,
      }),
    ).toMatchObject({ label: 'Mark shipped', nextStatus: 'SHIPPED' })
  })

  it('SHIPPED → View tracking', () => {
    expect(
      getOrderPrimaryCta({
        status: 'SHIPPED',
        paymentStatus: 'PAID',
        hasTracking: true,
      }),
    ).toMatchObject({ label: 'View tracking', action: 'view-tracking' })
  })

  it('DELIVERED → Send thank-you', () => {
    expect(
      getOrderPrimaryCta({
        status: 'DELIVERED',
        paymentStatus: 'PAID',
        hasTracking: true,
      }),
    ).toMatchObject({ label: 'Send thank-you', action: 'send-email' })
  })

  it('CANCELLED → Send email', () => {
    expect(
      getOrderPrimaryCta({
        status: 'CANCELLED',
        paymentStatus: 'REFUNDED',
        hasTracking: false,
      }),
    ).toMatchObject({ label: 'Send email', action: 'send-email' })
  })

  it('REFUNDED → Send email', () => {
    expect(
      getOrderPrimaryCta({
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
        hasTracking: false,
      }),
    ).toMatchObject({ label: 'Send email', action: 'send-email' })
  })
})
