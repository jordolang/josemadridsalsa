import { beforeEach, describe, expect, it, vi } from 'vitest'

const orderFindUnique = vi.fn()
const sendOrderConfirmationEmail = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { order: { findUnique: orderFindUnique } }
  return { prisma: client, default: client }
})

vi.mock('@/lib/email/automation', () => ({ sendOrderConfirmationEmail }))

const { handleOrderConfirmation } = await import(
  '@/lib/domain-events/handlers/order-confirmation'
)

function event(type: string) {
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

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order_1',
    confirmationEmailSentAt: null,
    salesChannel: 'WEBSITE',
    ...overrides,
  }
}

describe('order confirmation handler', () => {
  beforeEach(() => {
    orderFindUnique.mockReset()
    sendOrderConfirmationEmail.mockReset()
    sendOrderConfirmationEmail.mockResolvedValue({ success: true })
  })

  describe('on payment.completed', () => {
    it('confirms a POS counter sale, which no route ever confirmed', async () => {
      orderFindUnique.mockResolvedValue(order({ salesChannel: 'POS' }))

      await handleOrderConfirmation(event('payment.completed'))

      expect(sendOrderConfirmationEmail).toHaveBeenCalledWith('order_1')
    })

    it('does not resend for a web order the checkout route already confirmed', async () => {
      orderFindUnique.mockResolvedValue(
        order({ confirmationEmailSentAt: new Date('2026-08-10T11:00:00Z') })
      )

      await handleOrderConfirmation(event('payment.completed'))

      expect(sendOrderConfirmationEmail).not.toHaveBeenCalled()
    })

    it('is safe to replay, because the sender stamps the order', async () => {
      orderFindUnique.mockResolvedValue(order({ confirmationEmailSentAt: new Date() }))

      await handleOrderConfirmation(event('payment.completed'))

      expect(sendOrderConfirmationEmail).not.toHaveBeenCalled()
    })
  })

  describe('on order.created', () => {
    it.each(['MANUAL', 'PHONE', 'WHOLESALE', 'EVENT'])(
      'confirms a %s order, where creating it is the sale',
      async (salesChannel) => {
        orderFindUnique.mockResolvedValue(order({ salesChannel }))

        await handleOrderConfirmation(event('order.created'))

        expect(sendOrderConfirmationEmail).toHaveBeenCalledWith('order_1')
      }
    )

    it.each(['WEBSITE', 'POS', 'FUNDRAISER'])(
      'stays silent for a %s order, which has not been paid for yet',
      async (salesChannel) => {
        // These routes open the order before taking payment. Confirming here would email
        // everyone who abandoned at the payment step.
        orderFindUnique.mockResolvedValue(order({ salesChannel }))

        await handleOrderConfirmation(event('order.created'))

        expect(sendOrderConfirmationEmail).not.toHaveBeenCalled()
      }
    )

    it('stays silent for a marketplace order, whose settlement is not modelled', async () => {
      orderFindUnique.mockResolvedValue(order({ salesChannel: 'MARKETPLACE' }))

      await handleOrderConfirmation(event('order.created'))

      expect(sendOrderConfirmationEmail).not.toHaveBeenCalled()
    })

    it('does not confirm a manual order twice', async () => {
      orderFindUnique.mockResolvedValue(
        order({ salesChannel: 'PHONE', confirmationEmailSentAt: new Date() })
      )

      await handleOrderConfirmation(event('order.created'))

      expect(sendOrderConfirmationEmail).not.toHaveBeenCalled()
    })
  })

  it('does nothing when the order has gone', async () => {
    orderFindUnique.mockResolvedValue(null)

    await expect(handleOrderConfirmation(event('payment.completed'))).resolves.toBeUndefined()
    expect(sendOrderConfirmationEmail).not.toHaveBeenCalled()
  })
})
