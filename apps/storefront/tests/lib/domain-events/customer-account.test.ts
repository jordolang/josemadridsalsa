import { beforeEach, describe, expect, it, vi } from 'vitest'

const orderFindUnique = vi.fn()
const ensureCustomerAccount = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { order: { findUnique: orderFindUnique } }
  return { prisma: client, default: client }
})

vi.mock('@/lib/customers/ensure-account', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/customers/ensure-account')>()
  return { ...actual, ensureCustomerAccount }
})

vi.mock('@/lib/email/automation', () => ({ sendOrderConfirmationEmail: vi.fn() }))

const { handleCustomerAccount } = await import('@/lib/domain-events/handlers/customer-account')

function event(type: string) {
  return {
    id: 'evt_1',
    type,
    entityType: 'order',
    entityId: 'order_1',
    payload: null,
    actorUserId: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
  } as never
}

describe('customer account handler', () => {
  beforeEach(() => {
    orderFindUnique.mockReset()
    ensureCustomerAccount.mockReset()
  })

  it('opens an account for a guest who paid', async () => {
    orderFindUnique.mockResolvedValue({
      userId: null,
      guestEmail: 'Guest@Example.com',
      guestPhone: '555',
      salesChannel: 'WEBSITE',
      user: null,
    })

    await handleCustomerAccount(event('payment.completed'))

    expect(ensureCustomerAccount).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'Guest@Example.com', phone: '555', source: 'GUEST_ORDER', userId: null }),
    )
  })

  it('uses the signed-in buyer and their name', async () => {
    orderFindUnique.mockResolvedValue({
      userId: 'u1',
      guestEmail: null,
      guestPhone: null,
      salesChannel: 'WEBSITE',
      user: { email: 'pat@example.com', name: 'Pat Lee', phone: null },
    })

    await handleCustomerAccount(event('payment.completed'))

    expect(ensureCustomerAccount).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'pat@example.com', firstName: 'Pat', lastName: 'Lee', userId: 'u1', source: 'REGISTERED' }),
    )
  })

  it('ignores a website order that was only opened, so abandoned checkouts make no account', async () => {
    orderFindUnique.mockResolvedValue({
      userId: null,
      guestEmail: 'a@b.com',
      guestPhone: null,
      salesChannel: 'WEBSITE',
      user: null,
    })

    await handleCustomerAccount(event('order.created'))

    expect(ensureCustomerAccount).not.toHaveBeenCalled()
  })

  it('opens an account at creation for a phone order, which is final when written', async () => {
    orderFindUnique.mockResolvedValue({
      userId: null,
      guestEmail: 'a@b.com',
      guestPhone: null,
      salesChannel: 'PHONE',
      user: null,
    })

    await handleCustomerAccount(event('order.created'))

    expect(ensureCustomerAccount).toHaveBeenCalledTimes(1)
  })

  it('does nothing for an order with no email', async () => {
    orderFindUnique.mockResolvedValue({ userId: null, guestEmail: null, guestPhone: null, salesChannel: 'POS', user: null })

    await handleCustomerAccount(event('payment.completed'))

    expect(ensureCustomerAccount).not.toHaveBeenCalled()
  })
})
