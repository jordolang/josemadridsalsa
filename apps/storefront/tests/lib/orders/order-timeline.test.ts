import { describe, expect, it } from 'vitest'

import { buildOrderTimeline, timelineLabel } from '@/lib/orders/order-timeline'

const at = (iso: string) => new Date(iso)
const baseOrder = { id: 'order_1', createdAt: at('2026-01-01T10:00:00Z') }

const typesOf = (entries: ReturnType<typeof buildOrderTimeline>) => entries.map((e) => e.type)

describe('buildOrderTimeline', () => {
  it('always produces at least the creation entry, so no order shows a blank timeline', () => {
    // Every order predating the domain event log has zero recorded events.
    const timeline = buildOrderTimeline({ order: baseOrder })

    expect(timeline).toHaveLength(1)
    expect(timeline[0]).toMatchObject({ type: 'order.placed', source: 'reconstructed' })
  })

  it('reconstructs legacy timestamps for an order that predates the event log', () => {
    const timeline = buildOrderTimeline({
      order: {
        ...baseOrder,
        shippedAt: at('2026-01-03T10:00:00Z'),
        deliveredAt: at('2026-01-05T10:00:00Z'),
        confirmationEmailSentAt: at('2026-01-01T10:05:00Z'),
      },
      payments: [{ paidAt: at('2026-01-01T10:01:00Z'), amount: 4999, provider: 'STRIPE' }],
    })

    expect(typesOf(timeline)).toEqual([
      'order.placed',
      'payment.completed',
      'order.confirmation_emailed',
      'order.fulfilled',
      'order.delivered',
    ])
    expect(timeline.every((e) => e.source === 'reconstructed')).toBe(true)
  })

  it('marks recorded events as recorded', () => {
    const timeline = buildOrderTimeline({
      order: baseOrder,
      events: [{ type: 'order.fulfilled', createdAt: at('2026-01-03T10:00:00Z') }],
    })

    expect(timeline.find((e) => e.type === 'order.fulfilled')?.source).toBe('recorded')
  })

  it('does not double-count a fact that is both recorded and present as a timestamp', () => {
    // An order straddling the cutover: shippedAt is set AND order.fulfilled was emitted.
    const timeline = buildOrderTimeline({
      order: { ...baseOrder, shippedAt: at('2026-01-03T10:00:00Z') },
      events: [{ type: 'order.fulfilled', createdAt: at('2026-01-03T10:00:00Z') }],
    })

    expect(typesOf(timeline).filter((t) => t === 'order.fulfilled')).toHaveLength(1)
    expect(timeline.find((e) => e.type === 'order.fulfilled')?.source).toBe('recorded')
  })

  it('still reconstructs the facts that were not recorded on a straddling order', () => {
    const timeline = buildOrderTimeline({
      order: {
        ...baseOrder,
        shippedAt: at('2026-01-03T10:00:00Z'),
        deliveredAt: at('2026-01-05T10:00:00Z'),
      },
      events: [{ type: 'order.fulfilled', createdAt: at('2026-01-03T10:00:00Z') }],
    })

    expect(timeline.find((e) => e.type === 'order.fulfilled')?.source).toBe('recorded')
    expect(timeline.find((e) => e.type === 'order.delivered')?.source).toBe('reconstructed')
  })

  it('orders everything chronologically regardless of input order', () => {
    const timeline = buildOrderTimeline({
      order: { ...baseOrder, deliveredAt: at('2026-01-09T10:00:00Z') },
      events: [
        { type: 'order.delivered', createdAt: at('2026-01-09T10:00:00Z') },
        { type: 'payment.completed', createdAt: at('2026-01-01T10:01:00Z') },
        { type: 'shipment.created', createdAt: at('2026-01-02T10:00:00Z') },
      ],
    })

    const times = timeline.map((e) => e.at.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(typesOf(timeline)[0]).toBe('order.placed')
  })

  it('falls back to a refund createdAt when it was never marked processed', () => {
    const timeline = buildOrderTimeline({
      order: baseOrder,
      refunds: [{ createdAt: at('2026-01-04T10:00:00Z'), amount: 1000, provider: 'PAYPAL' }],
    })

    const refund = timeline.find((e) => e.type === 'payment.refunded')
    expect(refund?.at).toEqual(at('2026-01-04T10:00:00Z'))
    expect(refund?.detail).toBe('$10.00 via PAYPAL')
  })

  it('formats payment detail from cents', () => {
    const timeline = buildOrderTimeline({
      order: baseOrder,
      payments: [{ paidAt: at('2026-01-01T10:01:00Z'), amount: 4999, provider: 'STRIPE' }],
    })

    expect(timeline.find((e) => e.type === 'payment.completed')?.detail).toBe('$49.99 via STRIPE')
  })

  it('skips payments and refunds that never completed', () => {
    const timeline = buildOrderTimeline({
      order: baseOrder,
      payments: [{ paidAt: null, amount: 4999 }],
    })

    expect(typesOf(timeline)).toEqual(['order.placed'])
  })

  it('summarises a recorded event payload without choking on odd shapes', () => {
    const timeline = buildOrderTimeline({
      order: baseOrder,
      events: [
        {
          type: 'shipment.created',
          createdAt: at('2026-01-02T10:00:00Z'),
          payload: { trackingNumber: '1Z999', carrier: 'UPS' },
        },
        { type: 'order.fulfilled', createdAt: at('2026-01-03T10:00:00Z'), payload: 'not-an-object' },
      ],
    })

    expect(timeline.find((e) => e.type === 'shipment.created')?.detail).toBe('1Z999 · UPS')
    expect(timeline.find((e) => e.type === 'order.fulfilled')?.detail).toBeNull()
  })

  it('carries the acting admin through for recorded events', () => {
    const timeline = buildOrderTimeline({
      order: baseOrder,
      events: [
        { type: 'order.fulfilled', createdAt: at('2026-01-03T10:00:00Z'), actorUserId: 'user_1' },
      ],
    })

    expect(timeline.find((e) => e.type === 'order.fulfilled')?.actorUserId).toBe('user_1')
  })
})

describe('timelineLabel', () => {
  it('gives human labels to known types and passes unknown ones through', () => {
    expect(timelineLabel('payment.completed')).toBe('Payment completed')
    expect(timelineLabel('order.placed')).toBe('Order placed')
    expect(timelineLabel('something.new')).toBe('something.new')
  })
})
