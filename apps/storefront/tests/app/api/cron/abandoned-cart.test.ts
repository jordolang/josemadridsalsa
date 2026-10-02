import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * The abandoned-cart cron route — the email sequence that asks shoppers to complete their order.
 *
 * This sends real marketing emails to real people, so the parts that must be correct are:
 * - selecting the right template for the stage, and sending that template's own subject
 * - linking at the page that restores a cart rather than at the API that consumes the token
 * - never sending twice (skipping recovered carts, respecting the final stage)
 * - honouring unsubscribes
 * - updating the stage after sending so the next sweep sends the next template
 * - leaving a per-send record the dashboard and the Resend webhook can both find
 */

const abandonedCartFindMany = vi.fn()
const abandonedCartFindUnique = vi.fn()
const abandonedCartUpdate = vi.fn()
const sendEmail = vi.fn()
const substituteVariables = vi.fn()
const checkUnsubscribed = vi.fn()
const logEmailSend = vi.fn()
const isAuthorizedCronRequest = vi.fn()
const enrollInAutomation = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    abandonedCart: {
      findMany: abandonedCartFindMany,
      findUnique: abandonedCartFindUnique,
      update: abandonedCartUpdate,
    },
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/email/sender', () => ({
  sendEmail,
  substituteVariables,
}))

vi.mock('@/lib/email/logger', () => ({
  checkUnsubscribed,
  logEmailSend,
}))

vi.mock('@/lib/email/automation-engine', () => ({ enrollInAutomation }))

vi.mock('@/lib/cron/auth', () => ({
  isAuthorizedCronRequest,
}))

vi.mock('@/lib/email/templates/abandoned-cart-stage-1', () => ({
  abandonedCartStage1Template: {
    subject: 'Stage 1 Subject',
    html: '<p>Stage 1 HTML</p>',
    text: 'Stage 1 Text',
  },
}))

vi.mock('@/lib/email/templates/abandoned-cart-stage-2', () => ({
  abandonedCartStage2Template: {
    subject: 'Stage 2 Subject',
    html: '<p>Stage 2 HTML</p>',
    text: 'Stage 2 Text',
  },
}))

vi.mock('@/lib/email/templates/abandoned-cart-stage-3', () => ({
  abandonedCartStage3Template: {
    subject: 'Stage 3 Subject',
    html: '<p>Stage 3 HTML</p>',
    text: 'Stage 3 Text',
  },
}))

const { GET } = await import('@/app/api/cron/abandoned-cart/route')

const NOW = new Date('2026-08-10T12:00:00Z')
const HOUR = 60 * 60 * 1000
/** Abandoned three hours ago, which is what the "waiting for N hours" line must report. */
const CART_ABANDONED_AT = new Date(NOW.getTime() - 3 * HOUR)
const CART_CREATED_AT = new Date(NOW.getTime() - 4 * HOUR)

function cronRequest() {
  return new NextRequest('http://localhost:3000/api/cron/abandoned-cart')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  isAuthorizedCronRequest.mockReturnValue(true)
  abandonedCartFindMany.mockResolvedValue([])
  abandonedCartFindUnique.mockResolvedValue({ recoveryToken: 'token_abc123' })
  abandonedCartUpdate.mockResolvedValue({})
  sendEmail.mockResolvedValue({ success: true, messageId: 'msg_1' })
  substituteVariables.mockImplementation((template: string) => template)
  checkUnsubscribed.mockResolvedValue(false)
  logEmailSend.mockResolvedValue({ id: 'log_1' })
  enrollInAutomation.mockResolvedValue(undefined)
})

describe('GET /api/cron/abandoned-cart', () => {
  it('refuses an unauthorised caller before touching any cart', async () => {
    isAuthorizedCronRequest.mockReturnValue(false)

    const response = await GET(cronRequest())

    expect(response.status).toBe(401)
    expect(abandonedCartFindMany).not.toHaveBeenCalled()
  })

  it('finds carts using the where clause from the lib function', async () => {
    await GET(cronRequest())

    // The `abandonedCartWhere` function is tested separately; here we just verify it's used
    const whereClause = abandonedCartFindMany.mock.calls[0][0].where
    expect(whereClause).toHaveProperty('recoveredAt', null)
    expect(whereClause).toHaveProperty('emailStage')
    expect(whereClause).toHaveProperty('OR')
  })

  it('only chases site-checkout carts once retail checks out in BigCommerce', async () => {
    vi.stubEnv('NEXT_PUBLIC_COMMERCE_BACKEND', 'bigcommerce')
    vi.stubEnv('BIGCOMMERCE_STORE_HASH', 'testhash')
    vi.stubEnv('BIGCOMMERCE_ACCESS_TOKEN', 'test-token')
    vi.stubEnv('BIGCOMMERCE_CLIENT_ID', 'test-client')
    vi.stubEnv('BIGCOMMERCE_CLIENT_SECRET', 'test-secret')
    try {
      await GET(cronRequest())
      expect(abandonedCartFindMany.mock.calls[0][0].where.cartData).toEqual({ path: ['checkout'], equals: 'site' })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('enrolls a newly abandoned cart in ABANDONED_CART automations, keyed on the cart', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        recoveryToken: 'token_abc123',
        emailStage: 0,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    expect(enrollInAutomation).toHaveBeenCalledWith(
      'ABANDONED_CART',
      'user@example.com',
      expect.objectContaining({
        cartId: 'cart_1',
        cartTotal: '$42.50',
        cartUrl: expect.stringMatching(/\/checkout\?recover=token_abc123$/),
      }),
      'abandoned_cart:cart_1'
    )
  })

  it('does not re-enroll a cart already past its first reminder', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        recoveryToken: 'token_abc123',
        emailStage: 1,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        emailSentAt: CART_ABANDONED_AT,
        cartData: {},
      },
    ])

    await GET(cronRequest())

    expect(enrollInAutomation).not.toHaveBeenCalled()
  })

  it('still sends the built-in reminder when automation enrollment fails', async () => {
    enrollInAutomation.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        recoveryToken: 'token_abc123',
        emailStage: 0,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: {},
      },
    ])

    const response = await GET(cronRequest())

    expect(response.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledOnce()
  })

  it('selects the correct template for stage 1', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    // Stage 1 template should be used when cart is at emailStage 0
    expect(substituteVariables).toHaveBeenCalledWith(
      expect.stringContaining('Stage 1 HTML'),
      expect.any(Object)
    )
  })

  it('selects the correct template for stage 2', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 1,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    expect(substituteVariables).toHaveBeenCalledWith(
      expect.stringContaining('Stage 2 HTML'),
      expect.any(Object)
    )
  })

  it('selects the correct template for stage 3', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 2,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    expect(substituteVariables).toHaveBeenCalledWith(
      expect.stringContaining('Stage 3 HTML'),
      expect.any(Object)
    )
  })

  it("sends the selected template's own subject rather than a second copy of it", async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Stage 1 Subject',
      })
    )
  })

  it('progresses the cart to the next stage after sending', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    expect(abandonedCartUpdate).toHaveBeenCalledWith({
      where: { id: 'cart_1' },
      data: {
        emailStage: 1,
        emailSent: true,
        emailSentAt: NOW,
      },
    })
  })

  it('uses the user email when available', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        user: { email: 'user@example.com', name: 'Ada' },
        guestEmail: 'guest@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    expect(checkUnsubscribed).toHaveBeenCalledWith({
      email: 'user@example.com',
      category: 'abandoned_cart',
    })
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com' })
    )
  })

  it('falls back to guest email when user email is unavailable', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        guestEmail: 'guest@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'guest@example.com' })
    )
  })

  it('skips carts without any email address', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    const response = await GET(cronRequest())

    expect(sendEmail).not.toHaveBeenCalled()
    expect(abandonedCartUpdate).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ sent: 0, skipped: 1 })
  })

  it('skips unsubscribed users', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        guestEmail: 'unsubbed@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])
    checkUnsubscribed.mockResolvedValue(true)

    const response = await GET(cronRequest())

    expect(sendEmail).not.toHaveBeenCalled()
    expect(abandonedCartUpdate).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ sent: 0, skipped: 1 })
  })

  it('skips carts without a recovery token', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])
    abandonedCartFindUnique.mockResolvedValue(null)

    const response = await GET(cronRequest())

    expect(sendEmail).not.toHaveBeenCalled()
    expect(abandonedCartUpdate).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ sent: 0, skipped: 1 })
  })

  it('does not update the cart when email sending fails', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])
    sendEmail.mockResolvedValue({ success: false })

    const response = await GET(cronRequest())

    expect(abandonedCartUpdate).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ sent: 0, skipped: 1 })
  })

  it('includes the cart total in the email variables', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    expect(substituteVariables).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cartTotal: '$42.50' })
    )
  })

  it('links at the checkout page, which is what restores a cart', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    expect(substituteVariables).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        cartUrl: expect.stringContaining('/checkout?recover=token_abc123'),
      })
    )
  })

  it('includes the customer name in the email variables', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        user: { email: 'ada@example.com', name: 'Ada' },
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    expect(substituteVariables).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: 'Ada' })
    )
  })

  it('processes multiple carts in a single run', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        guestEmail: 'user1@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
      {
        id: 'cart_2',
        emailStage: 1,
        guestEmail: 'user2@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 30.0 },
      },
    ])

    const response = await GET(cronRequest())

    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(abandonedCartUpdate).toHaveBeenCalledTimes(2)
    await expect(response.json()).resolves.toMatchObject({ sent: 2, skipped: 0, total: 2 })
  })

  it('limits the query to 100 carts to avoid overwhelming the email service', async () => {
    await GET(cronRequest())

    expect(abandonedCartFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    )
  })

  it('reports a failure instead of a success it did not achieve', async () => {
    abandonedCartFindMany.mockRejectedValue(new Error('database unavailable'))

    const response = await GET(cronRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: 'Cron failed' })
  })

  it('includes both HTML and text versions of the email', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('Stage 1 HTML'),
        text: expect.any(String),
      })
    )
  })

  it('supplies the countdown variables the later templates read', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 1,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    expect(substituteVariables).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        hoursWaiting: '3',
        expiresIn: '30 days',
      })
    )
  })

  it('leaves a send record tagged with the stage and the cart', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 1,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    await GET(cronRequest())

    expect(logEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'user@example.com',
        subject: 'Stage 2 Subject',
        status: 'SENT',
        metadata: expect.objectContaining({
          type: 'abandoned_cart',
          stage: 2,
          cartId: 'cart_1',
          messageId: 'msg_1',
        }),
      })
    )
  })

  it('does not un-send an email because the send record failed to write', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_1',
        emailStage: 0,
        guestEmail: 'user@example.com',
        createdAt: CART_CREATED_AT,
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])
    logEmailSend.mockRejectedValue(new Error('email_logs unavailable'))

    const response = await GET(cronRequest())

    expect(abandonedCartUpdate).toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ sent: 1, skipped: 0 })
  })

  it('sends nothing once the recovery link the email would advertise has expired', async () => {
    abandonedCartFindMany.mockResolvedValue([
      {
        id: 'cart_expired',
        emailStage: 1,
        guestEmail: 'user@example.com',
        createdAt: new Date(NOW.getTime() - 31 * 24 * HOUR),
        updatedAt: CART_ABANDONED_AT,
        cartData: { total: 42.5 },
      },
    ])

    const response = await GET(cronRequest())

    expect(sendEmail).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ sent: 0, skipped: 1 })
  })
})
