import { describe, expect, it } from 'vitest'

import {
  agingDedupeKeys,
  agingReturnsSpec,
  hoursBefore,
  minutesBefore,
  STALE_RETURN_HOURS,
  STALE_UNFULFILLED_HOURS,
  staleUnfulfilledSpec,
  STUCK_WEBHOOK_MINUTES,
  stuckWebhooksSpec,
  summariseReferences,
} from '@/lib/operations/aging'

describe('hoursBefore', () => {
  it('subtracts whole hours', () => {
    const now = new Date('2026-08-08T12:00:00.000Z')
    expect(hoursBefore(now, 48).toISOString()).toBe('2026-08-06T12:00:00.000Z')
  })

  it('does not mutate the date it is given', () => {
    const now = new Date('2026-08-08T12:00:00.000Z')
    hoursBefore(now, 48)
    expect(now.toISOString()).toBe('2026-08-08T12:00:00.000Z')
  })
})

describe('summariseReferences', () => {
  it('names a single reference', () => {
    expect(summariseReferences(['#1001'])).toBe('#1001')
  })

  it('joins two with "and"', () => {
    expect(summariseReferences(['#1001', '#1002'])).toBe('#1001 and #1002')
  })

  it('joins three with a comma and "and"', () => {
    expect(summariseReferences(['#1001', '#1002', '#1003'])).toBe('#1001, #1002 and #1003')
  })

  it('switches to a count past three so the message stays readable', () => {
    expect(summariseReferences(['#1', '#2', '#3', '#4', '#5'])).toBe('#1, #2, #3 and 2 others')
  })

  it('uses the singular for exactly one extra', () => {
    expect(summariseReferences(['#1', '#2', '#3', '#4'])).toBe('#1, #2, #3 and 1 other')
  })

  it('returns an empty string for nothing', () => {
    expect(summariseReferences([])).toBe('')
  })
})

describe('staleUnfulfilledSpec', () => {
  it('says nothing when no orders are stale', () => {
    // A quiet sweep must write nothing — an "all clear" notification would mark itself
    // unread on every tick and train operators to ignore the list.
    expect(staleUnfulfilledSpec([])).toBeNull()
  })

  it('reports a single order in the singular', () => {
    const spec = staleUnfulfilledSpec(['#1001'])
    expect(spec?.title).toBe('1 order unshipped after 48h')
    expect(spec?.message).toContain('#1001 was paid more than 48 hours ago')
    expect(spec?.message).toContain('has not shipped')
  })

  it('reports several orders in the plural', () => {
    const spec = staleUnfulfilledSpec(['#1001', '#1002'])
    expect(spec?.title).toBe('2 orders unshipped after 48h')
    expect(spec?.message).toContain('#1001 and #1002 were paid')
    expect(spec?.message).toContain('have not shipped')
  })

  it('carries the severity, type and destination an operator needs', () => {
    const spec = staleUnfulfilledSpec(['#1001'])
    expect(spec?.type).toBe('ORDER_UNFULFILLED_STALE')
    expect(spec?.severity).toBe('WARNING')
    // Deep-links to the same saved view the query is built from.
    expect(spec?.link).toBe('/admin/orders?view=needs-shipping')
  })

  it('collapses onto one rolling row rather than one per order', () => {
    const one = staleUnfulfilledSpec(['#1001'])
    const many = staleUnfulfilledSpec(['#1001', '#1002', '#1003'])
    expect(one?.dedupeKey).toBe(agingDedupeKeys.ordersUnfulfilled)
    expect(many?.dedupeKey).toBe(one?.dedupeKey)
  })

  it('honours a custom threshold in the wording', () => {
    expect(staleUnfulfilledSpec(['#1001'], 12)?.title).toBe('1 order unshipped after 12h')
  })

  it('defaults to the documented threshold', () => {
    expect(STALE_UNFULFILLED_HOURS).toBe(48)
    expect(staleUnfulfilledSpec(['#1001'])?.title).toContain('48h')
  })
})

describe('agingReturnsSpec', () => {
  it('says nothing when no returns are aging', () => {
    expect(agingReturnsSpec([])).toBeNull()
  })

  it('reports a single return in the singular', () => {
    const spec = agingReturnsSpec(['RMA-1001'])
    expect(spec?.title).toBe('1 return awaiting a decision')
    expect(spec?.message).toContain('RMA-1001 has been open')
  })

  it('reports several returns in the plural', () => {
    const spec = agingReturnsSpec(['RMA-1', 'RMA-2'])
    expect(spec?.title).toBe('2 returns awaiting a decision')
    expect(spec?.message).toContain('have been open')
  })

  it('carries the severity, type and destination an operator needs', () => {
    const spec = agingReturnsSpec(['RMA-1001'])
    expect(spec?.type).toBe('RETURN_AGING')
    expect(spec?.severity).toBe('WARNING')
    expect(spec?.link).toBe('/admin/returns?status=REQUESTED')
    expect(spec?.dedupeKey).toBe(agingDedupeKeys.returnsAging)
  })

  it('defaults to the documented threshold', () => {
    expect(STALE_RETURN_HOURS).toBe(72)
    expect(agingReturnsSpec(['RMA-1'])?.message).toContain('72 hours')
  })
})

describe('minutesBefore', () => {
  it('subtracts whole minutes', () => {
    const now = new Date('2026-08-08T12:00:00.000Z')
    expect(minutesBefore(now, 30).toISOString()).toBe('2026-08-08T11:30:00.000Z')
  })

  it('does not mutate the date it is given', () => {
    const now = new Date('2026-08-08T12:00:00.000Z')
    minutesBefore(now, 30)
    expect(now.toISOString()).toBe('2026-08-08T12:00:00.000Z')
  })
})

describe('stuckWebhooksSpec', () => {
  it('says nothing when everything processed', () => {
    expect(stuckWebhooksSpec([])).toBeNull()
  })

  it('treats a stuck webhook as critical, not a warning', () => {
    // The provider took the money and called us; our handler died partway. That is the
    // worst of the sweep's conditions, not a nag.
    const spec = stuckWebhooksSpec([{ provider: 'STRIPE', type: 'payment_intent.succeeded' }])
    expect(spec?.type).toBe('INTEGRATION_FAILED')
    expect(spec?.severity).toBe('CRITICAL')
  })

  it('counts per provider so a broken integration is distinguishable from one bad event', () => {
    const spec = stuckWebhooksSpec([
      { provider: 'STRIPE', type: 'a' },
      { provider: 'STRIPE', type: 'b' },
      { provider: 'PAYPAL', type: 'c' },
    ])
    expect(spec?.title).toBe('3 webhooks stuck unprocessed')
    expect(spec?.message).toContain('STRIPE 2, PAYPAL 1')
  })

  it('labels a null provider rather than dropping it', () => {
    // EasyPost writes webhook rows with no provider — that column is for payment providers.
    const spec = stuckWebhooksSpec([{ provider: null, type: 'tracker.updated' }])
    expect(spec?.message).toContain('unknown 1')
  })

  it('orders the breakdown by count, then name for a stable tie', () => {
    const spec = stuckWebhooksSpec([
      { provider: 'SQUARE', type: 'a' },
      { provider: 'PAYPAL', type: 'b' },
      { provider: 'STRIPE', type: 'c' },
      { provider: 'STRIPE', type: 'd' },
    ])
    expect(spec?.message).toContain('STRIPE 2, PAYPAL 1, SQUARE 1')
  })

  it('uses the singular for one', () => {
    const spec = stuckWebhooksSpec([{ provider: 'STRIPE', type: 'a' }])
    expect(spec?.title).toBe('1 webhook stuck unprocessed')
    expect(spec?.message).toContain('It was')
  })

  it('defaults to the documented threshold', () => {
    expect(STUCK_WEBHOOK_MINUTES).toBe(30)
    expect(stuckWebhooksSpec([{ provider: 'STRIPE', type: 'a' }])?.message).toContain('30 minutes')
  })

  it('reuses the integration-failure dedupe identity', () => {
    expect(agingDedupeKeys.webhooksStuck).toBe('integration-failed:webhooks')
  })
})

describe('the three sweeps stay independent', () => {
  it('uses distinct dedupe keys so one cannot overwrite another', () => {
    const keys = [
      agingDedupeKeys.ordersUnfulfilled,
      agingDedupeKeys.returnsAging,
      agingDedupeKeys.webhooksStuck,
    ]
    expect(new Set(keys).size).toBe(keys.length)
  })
})
