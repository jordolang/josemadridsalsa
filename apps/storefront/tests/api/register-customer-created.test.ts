import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Registration is the entry point for the `USER_REGISTERED` automation trigger.
 *
 * The welcome email is sent inline here, but the `customer.created` fact is what any future
 * onboarding series keys off. Losing it would leave registration looking fine — the customer
 * still gets their welcome — while every automation built on the trigger quietly enrolled nobody.
 */

const userFindUnique = vi.fn()
const userCreate = vi.fn()
const emitDomainEvent = vi.fn()
const sendWelcomeEmail = vi.fn()
const logEngagementRequest = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { user: { findUnique: userFindUnique, create: userCreate } }
  return { prisma: client, default: client }
})

vi.mock('@/lib/domain-events/emit', () => ({ emitDomainEvent }))
vi.mock('@/lib/email/automation', () => ({ sendWelcomeEmail }))
vi.mock('@/lib/engagements', () => ({ logEngagementRequest }))

// Hashing a password with 12 rounds is slow and is not what these tests are about.
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async () => 'hashed') } }))

const { POST } = await import('@/app/api/auth/register/route')

function registration(body: Record<string, unknown> = {}) {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'New.Customer@Example.com',
      password: 'correct horse battery staple',
      name: 'Sam Rivera',
      ...body,
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  userFindUnique.mockResolvedValue(null)
  userCreate.mockResolvedValue({ id: 'user_1', email: 'new.customer@example.com' })
  sendWelcomeEmail.mockResolvedValue({ success: true })
  logEngagementRequest.mockResolvedValue(undefined)
})

describe('POST /api/auth/register', () => {
  it('records customer.created against the new account', async () => {
    const response = await POST(registration())

    expect(response.status).toBe(201)
    expect(emitDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'customer.created',
        entityType: 'customer',
        entityId: 'user_1',
      })
    )
  })

  it('carries the email in the payload, because a CRM row may not exist yet', async () => {
    await POST(registration())

    expect(emitDomainEvent.mock.calls[0][0].payload).toMatchObject({
      email: 'new.customer@example.com',
      via: 'password-registration',
    })
  })

  it('normalises the address once, so the fact and the welcome agree', async () => {
    await POST(registration())

    // A consumer resolving a customer by email would miss the account entirely if the event
    // carried the address as typed and the record held it lowercased.
    expect(emitDomainEvent.mock.calls[0][0].payload.email).toBe('new.customer@example.com')
    expect(sendWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new.customer@example.com' })
    )
  })

  it('records nothing when the address is already registered', async () => {
    userFindUnique.mockResolvedValue({ id: 'existing' })

    const response = await POST(registration())

    expect(response.status).toBe(409)
    expect(emitDomainEvent).not.toHaveBeenCalled()
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  it('records nothing when the submission is invalid', async () => {
    const response = await POST(registration({ email: 'not-an-address' }))

    expect(response.status).toBe(400)
    expect(userCreate).not.toHaveBeenCalled()
    expect(emitDomainEvent).not.toHaveBeenCalled()
  })

  it('still completes the registration when the welcome email fails', async () => {
    sendWelcomeEmail.mockRejectedValue(new Error('Resend is down'))

    const response = await POST(registration())

    // The account exists and the fact is recorded; a mail outage must not cost the customer
    // their sign-up.
    expect(response.status).toBe(201)
    expect(emitDomainEvent).toHaveBeenCalled()
  })
})
