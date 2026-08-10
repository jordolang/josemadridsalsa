import { beforeEach, describe, expect, it, vi } from 'vitest'

const userFindMany = vi.fn()
const notificationCreate = vi.fn()
const notificationUpsert = vi.fn()
const notificationUpdateMany = vi.fn()
const notificationCount = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    user: { findMany: userFindMany },
    notification: {
      create: notificationCreate,
      upsert: notificationUpsert,
      updateMany: notificationUpdateMany,
      count: notificationCount,
    },
  }
  return { prisma: client, default: client }
})

const {
  countUnreadNotifications,
  dedupeKeys,
  markAllNotificationsRead,
  markNotificationRead,
  notifyOperators,
  severityFor,
  upsertNotification,
} = await import('@/lib/notifications/dispatch')

const spec = {
  type: 'PAYMENT_FAILED' as const,
  severity: 'CRITICAL' as const,
  title: 'Payment failed',
  message: 'Order JMS-1',
  dedupeKey: 'payment-failed:order_1',
}

describe('notifyOperators', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    userFindMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }])
    notificationUpsert.mockResolvedValue({})
    notificationCreate.mockResolvedValue({})
  })

  it('reaches every operator role', async () => {
    await notifyOperators(spec)

    expect(userFindMany.mock.calls[0][0].where.role).toEqual({
      in: ['ADMIN', 'DEVELOPER', 'STAFF'],
    })
    expect(notificationUpsert).toHaveBeenCalledTimes(2)
  })

  it('reports how many people were told', async () => {
    expect(await notifyOperators(spec)).toBe(2)
  })

  it('warns rather than silently succeeding when nobody is configured', async () => {
    userFindMany.mockResolvedValue([])

    expect(await notifyOperators(spec)).toBe(0)
    expect(notificationUpsert).not.toHaveBeenCalled()
  })

  it('never throws, so failing to notify cannot undo what happened', async () => {
    // Dispatch runs after the fact it describes; a broken notification must not surface as
    // a failure of the payment or order that triggered it.
    userFindMany.mockRejectedValue(new Error('db down'))

    await expect(notifyOperators(spec)).resolves.toBe(0)
  })
})

describe('upsertNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    notificationUpsert.mockResolvedValue({})
    notificationCreate.mockResolvedValue({})
  })

  it('collapses a repeated condition onto one row', async () => {
    await upsertNotification('u1', spec)

    const call = notificationUpsert.mock.calls[0][0]
    expect(call.where).toEqual({
      userId_dedupeKey: { userId: 'u1', dedupeKey: 'payment-failed:order_1' },
    })
  })

  it('resurfaces a condition that had already been read', async () => {
    // Stock going low, being acknowledged, recovering, then going low again is new
    // information — not a duplicate to be swallowed.
    await upsertNotification('u1', spec)

    expect(notificationUpsert.mock.calls[0][0].update).toMatchObject({
      isRead: false,
      readAt: null,
    })
  })

  it('creates an unkeyed notification directly rather than upserting', async () => {
    // A NULL dedupeKey never collides in Postgres, so one-off messages must not go through
    // the unique-constraint path.
    await upsertNotification('u1', { ...spec, dedupeKey: undefined })

    expect(notificationCreate).toHaveBeenCalledTimes(1)
    expect(notificationUpsert).not.toHaveBeenCalled()
    expect(notificationCreate.mock.calls[0][0].data.dedupeKey).toBeNull()
  })

  it('defaults severity when the caller does not set one', async () => {
    await upsertNotification('u1', { type: 'SYSTEM', title: 't', message: 'm' })

    expect(notificationCreate.mock.calls[0][0].data.severity).toBe('INFO')
  })

  it('swallows write failures', async () => {
    notificationUpsert.mockRejectedValue(new Error('constraint'))

    await expect(upsertNotification('u1', spec)).resolves.toBeUndefined()
  })
})

describe('read state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notificationUpdateMany.mockResolvedValue({ count: 3 })
    notificationCount.mockResolvedValue(7)
  })

  it('scopes marking read to the owner, so one operator cannot clear another list', async () => {
    await markNotificationRead('n1', 'u1')

    expect(notificationUpdateMany.mock.calls[0][0].where).toEqual({ id: 'n1', userId: 'u1' })
  })

  it('marks only unread ones when clearing all', async () => {
    expect(await markAllNotificationsRead('u1')).toBe(3)
    expect(notificationUpdateMany.mock.calls[0][0].where).toEqual({ userId: 'u1', isRead: false })
  })

  it('counts unread, and reports zero if the count fails', async () => {
    expect(await countUnreadNotifications('u1')).toBe(7)

    notificationCount.mockRejectedValue(new Error('nope'))
    expect(await countUnreadNotifications('u1')).toBe(0)
  })
})

describe('severity and keys', () => {
  it('treats money and stock-out problems as critical', () => {
    expect(severityFor('PAYMENT_FAILED')).toBe('CRITICAL')
    expect(severityFor('INVENTORY_OUT_OF_STOCK')).toBe('CRITICAL')
    expect(severityFor('INTEGRATION_FAILED')).toBe('CRITICAL')
  })

  it('treats recoverable conditions as warnings and routine ones as info', () => {
    expect(severityFor('INVENTORY_LOW')).toBe('WARNING')
    expect(severityFor('RETURN_REQUESTED')).toBe('WARNING')
    expect(severityFor('ORDER_NEW')).toBe('INFO')
  })

  it('builds stable keys so the same fact always collapses together', () => {
    expect(dedupeKeys.paymentFailed('o1')).toBe('payment-failed:o1')
    expect(dedupeKeys.inventoryLow('p1')).toBe('inventory-low:p1')
    expect(dedupeKeys.paymentFailed('o1')).toBe(dedupeKeys.paymentFailed('o1'))
    expect(dedupeKeys.inventoryLow('p1')).not.toBe(dedupeKeys.inventoryOut('p1'))
  })
})
