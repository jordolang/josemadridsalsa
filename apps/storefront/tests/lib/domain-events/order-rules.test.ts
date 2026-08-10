import { beforeEach, describe, expect, it, vi } from 'vitest'

const ruleFindMany = vi.fn()
const orderFindUnique = vi.fn()
const sendEmail = vi.fn()
const fetchMock = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    orderNotificationRule: { findMany: ruleFindMany },
    order: { findUnique: orderFindUnique },
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/email', () => ({ sendEmail }))

const { handleOrderRules } = await import('@/lib/domain-events/handlers/order-rules')

function event(type = 'payment.completed') {
  return {
    id: 'evt_1',
    type,
    entityType: 'order',
    entityId: 'order_1',
    payload: null,
    actorUserId: null,
    createdAt: new Date('2026-08-10T12:00:00Z'),
  } as never
}

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r_1',
    name: 'Warehouse',
    triggerEvent: 'ORDER_PAID',
    statusFilter: null,
    minAmount: null,
    emailEnabled: true,
    emailTo: ['warehouse@example.com'],
    slackEnabled: false,
    slackWebhook: null,
    isActive: true,
    ...overrides,
  }
}

describe('order rules handler', () => {
  beforeEach(() => {
    ruleFindMany.mockReset()
    ruleFindMany.mockResolvedValue([])
    orderFindUnique.mockReset()
    orderFindUnique.mockResolvedValue({ orderNumber: 'JMS-1042', status: 'CONFIRMED', total: 150 })
    sendEmail.mockReset()
    sendEmail.mockResolvedValue({ success: true })
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('ignores a fact no rule can be configured against', async () => {
    await handleOrderRules(event('inventory.adjusted'))

    expect(ruleFindMany).not.toHaveBeenCalled()
  })

  it('does not read the order when no rules exist', async () => {
    // The common case: almost every shop has no rules, and this runs on every paid order.
    await handleOrderRules(event())

    expect(orderFindUnique).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('emails every recipient a matching rule names', async () => {
    ruleFindMany.mockResolvedValue([rule({ emailTo: ['a@example.com', 'b@example.com'] })])

    await handleOrderRules(event())

    expect(sendEmail.mock.calls.map((c) => c[0].to)).toEqual(['a@example.com', 'b@example.com'])
  })

  it('skips a rule whose amount filter the order misses', async () => {
    ruleFindMany.mockResolvedValue([rule({ minAmount: 500 })])

    await handleOrderRules(event())

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('posts to Slack when the rule asks for it', async () => {
    ruleFindMany.mockResolvedValue([
      rule({ emailEnabled: false, slackEnabled: true, slackWebhook: 'https://hooks.example/x' }),
    ])

    await handleOrderRules(event())

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.example/x',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('keeps delivering to other recipients when one address fails', async () => {
    ruleFindMany.mockResolvedValue([rule({ emailTo: ['bad@example.com', 'good@example.com'] })])
    sendEmail.mockRejectedValueOnce(new Error('bounce')).mockResolvedValueOnce({ success: true })

    await handleOrderRules(event())

    expect(sendEmail).toHaveBeenCalledTimes(2)
  })

  it('still emails when the Slack webhook is dead', async () => {
    ruleFindMany.mockResolvedValue([
      rule({ slackEnabled: true, slackWebhook: 'https://hooks.example/x' }),
    ])
    fetchMock.mockRejectedValue(new Error('revoked'))

    await expect(handleOrderRules(event())).resolves.toBeUndefined()
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('evaluates each rule independently', async () => {
    ruleFindMany.mockResolvedValue([
      rule({ id: 'r_low', minAmount: 500 }),
      rule({ id: 'r_any', emailTo: ['ops@example.com'] }),
    ])

    await handleOrderRules(event())

    expect(sendEmail.mock.calls.map((c) => c[0].to)).toEqual(['ops@example.com'])
  })

  it('does nothing when the order has gone', async () => {
    ruleFindMany.mockResolvedValue([rule()])
    orderFindUnique.mockResolvedValue(null)

    await expect(handleOrderRules(event())).resolves.toBeUndefined()
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
