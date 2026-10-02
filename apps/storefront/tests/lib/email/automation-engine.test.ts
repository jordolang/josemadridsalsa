import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The marketing automation engine — enrollment, and the drain that walks each enrollment through
 * its steps.
 *
 * This is the product Phase 1 revived. Until then nothing called `enrollInAutomation`, so the
 * engine had never run against real enrollments and none of it was tested. What matters here is
 * not that an email goes out; it is the bookkeeping around it. An enrollment that advances on a
 * failed send skips a step no one will ever notice was skipped, and one that fails to advance
 * re-sends the same email every five minutes forever.
 */

const automationFindMany = vi.fn()
const enrollmentFindUnique = vi.fn()
const enrollmentUpsert = vi.fn()
const enrollmentFindMany = vi.fn()
const enrollmentUpdate = vi.fn()
const logCreate = vi.fn()
const templateFindUnique = vi.fn()
const sendEmail = vi.fn()
const checkSuppression = vi.fn()
const checkUnsubscribed = vi.fn()
const orderFindFirst = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    emailAutomation: { findMany: automationFindMany },
    automationEnrollment: {
      findUnique: enrollmentFindUnique,
      upsert: enrollmentUpsert,
      findMany: enrollmentFindMany,
      update: enrollmentUpdate,
    },
    automationLog: { create: logCreate },
    emailTemplate: { findUnique: templateFindUnique },
    order: { findFirst: orderFindFirst },
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/email/sender', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/sender')>()
  return { ...actual, sendEmail }
})

vi.mock('@/lib/email/suppression', () => ({ checkSuppression }))
vi.mock('@/lib/email/logger', () => ({ checkUnsubscribed }))

const { enrollInAutomation, processDueAutomationSteps, withUnsubscribeFooter } = await import(
  '@/lib/email/automation-engine'
)

const NOW = new Date('2026-08-10T12:00:00Z')

function automation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'auto_1',
    trigger: 'ORDER_PLACED',
    stopConditions: null,
    steps: [
      { order: 0, delayHours: 0, templateId: 'tmpl_1', subject: null },
      { order: 1, delayHours: 24, templateId: 'tmpl_2', subject: null },
    ],
    ...overrides,
  }
}

function enrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enr_1',
    email: 'buyer@example.com',
    currentStep: 0,
    triggerData: null,
    enrolledAt: new Date('2026-08-09T12:00:00Z'),
    automation: automation(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  enrollmentUpsert.mockResolvedValue({})
  enrollmentUpdate.mockResolvedValue({})
  logCreate.mockResolvedValue({})
  sendEmail.mockResolvedValue({ success: true })
  checkSuppression.mockResolvedValue(false)
  checkUnsubscribed.mockResolvedValue(false)
  orderFindFirst.mockResolvedValue(null)
  templateFindUnique.mockResolvedValue({
    id: 'tmpl_1',
    subject: 'Thanks for your order, {{firstName}}',
    html: '<p>Hello {{firstName}}</p>',
  })
})

describe('enrollInAutomation', () => {
  it('enrolls the address in every active automation for the trigger', async () => {
    automationFindMany.mockResolvedValue([automation(), automation({ id: 'auto_2' })])
    enrollmentFindUnique.mockResolvedValue(null)

    await enrollInAutomation('ORDER_PLACED', 'buyer@example.com')

    expect(automationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { trigger: 'ORDER_PLACED', isActive: true } })
    )
    expect(enrollmentUpsert).toHaveBeenCalledTimes(2)
  })

  it('ignores an automation that has no steps to run', async () => {
    automationFindMany.mockResolvedValue([automation({ steps: [] })])

    await enrollInAutomation('ORDER_PLACED', 'buyer@example.com')

    expect(enrollmentUpsert).not.toHaveBeenCalled()
  })

  it('does not restart someone already moving through the series', async () => {
    automationFindMany.mockResolvedValue([automation()])
    enrollmentFindUnique.mockResolvedValue({ status: 'ACTIVE' })

    // A second order must not rewind an active enrollment to step one, or a repeat customer
    // receives the welcome sequence again from the top.
    await enrollInAutomation('ORDER_PLACED', 'buyer@example.com')

    expect(enrollmentUpsert).not.toHaveBeenCalled()
  })

  it('re-enrolls someone whose previous run finished', async () => {
    automationFindMany.mockResolvedValue([automation()])
    enrollmentFindUnique.mockResolvedValue({ status: 'COMPLETED' })

    await enrollInAutomation('ORDER_PLACED', 'buyer@example.com')

    expect(enrollmentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: 'ACTIVE', currentStep: 0, completedAt: null }),
      })
    )
  })

  it('skips a fact it has already enrolled, whatever that enrollment became', async () => {
    // The checkout route and the Stripe webhook both record the same payment; the second must
    // not restart a series the first already finished.
    automationFindMany.mockResolvedValue([automation()])
    enrollmentFindUnique.mockResolvedValue({
      status: 'COMPLETED',
      triggerData: { dedupeKey: 'payment.completed:order_1' },
    })

    await enrollInAutomation('ORDER_PLACED', 'buyer@example.com', {}, 'payment.completed:order_1')

    expect(enrollmentUpsert).not.toHaveBeenCalled()
  })

  it('re-enrolls for a new fact and records its key', async () => {
    automationFindMany.mockResolvedValue([automation()])
    enrollmentFindUnique.mockResolvedValue({
      status: 'COMPLETED',
      triggerData: { dedupeKey: 'payment.completed:order_1' },
    })

    await enrollInAutomation('ORDER_PLACED', 'buyer@example.com', {}, 'payment.completed:order_2')

    const { update } = enrollmentUpsert.mock.calls[0][0]
    expect(update.triggerData).toEqual({ dedupeKey: 'payment.completed:order_2' })
    expect(update.enrolledAt).toEqual(NOW)
  })

  it('normalises the address so case variants share one enrollment', async () => {
    automationFindMany.mockResolvedValue([automation()])
    enrollmentFindUnique.mockResolvedValue(null)

    await enrollInAutomation('ORDER_PLACED', ' Buyer@Example.COM ')

    expect(enrollmentUpsert.mock.calls[0][0].create.email).toBe('buyer@example.com')
  })

  it("schedules the first step by that step's own delay", async () => {
    automationFindMany.mockResolvedValue([
      automation({ steps: [{ order: 0, delayHours: 48, templateId: 'tmpl_1' }] }),
    ])
    enrollmentFindUnique.mockResolvedValue(null)

    await enrollInAutomation('ORDER_PLACED', 'buyer@example.com')

    const created = enrollmentUpsert.mock.calls[0][0].create
    expect(created.nextStepAt).toEqual(new Date('2026-08-12T12:00:00Z'))
  })

  it('carries the trigger data through for the templates to use', async () => {
    automationFindMany.mockResolvedValue([automation()])
    enrollmentFindUnique.mockResolvedValue(null)

    await enrollInAutomation('ORDER_PLACED', 'buyer@example.com', { orderNumber: 'JMS-5001' })

    expect(enrollmentUpsert.mock.calls[0][0].create.triggerData).toEqual({
      orderNumber: 'JMS-5001',
    })
  })
})

describe('processDueAutomationSteps', () => {
  it('asks only for enrollments whose next step is due', async () => {
    enrollmentFindMany.mockResolvedValue([])

    await processDueAutomationSteps()

    expect(enrollmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE', nextStepAt: { lte: NOW } },
      })
    )
  })

  it('sends the step email and advances the enrollment', async () => {
    enrollmentFindMany.mockResolvedValue([enrollment()])

    const result = await processDueAutomationSteps()

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'buyer@example.com' })
    )
    expect(enrollmentUpdate).toHaveBeenCalledWith({
      where: { id: 'enr_1' },
      data: { currentStep: 1, nextStepAt: new Date('2026-08-11T12:00:00Z') },
    })
    expect(result).toEqual({ processed: 1, errors: 0 })
  })

  it('substitutes trigger data into the template rather than shipping the raw token', async () => {
    enrollmentFindMany.mockResolvedValue([
      enrollment({ triggerData: { firstName: 'Sam' } }),
    ])

    await processDueAutomationSteps()

    const sent = sendEmail.mock.calls[0][0]
    expect(sent.subject).toBe('Thanks for your order, Sam')
    expect(sent.html).toMatch(/^<p>Hello Sam<\/p>/)
    expect(sent.html).not.toMatch(/\{\{/)
  })

  it("prefers the step's own subject line over the template's", async () => {
    enrollmentFindMany.mockResolvedValue([
      enrollment({
        automation: automation({
          steps: [{ order: 0, delayHours: 0, templateId: 'tmpl_1', subject: 'Still thinking?' }],
        }),
      }),
    ])

    await processDueAutomationSteps()

    expect(sendEmail.mock.calls[0][0].subject).toBe('Still thinking?')
  })

  it('completes the enrollment after its last step', async () => {
    enrollmentFindMany.mockResolvedValue([
      enrollment({
        currentStep: 1,
        automation: automation({
          steps: [
            { order: 0, delayHours: 0, templateId: 'tmpl_1' },
            { order: 1, delayHours: 24, templateId: 'tmpl_2' },
          ],
        }),
      }),
    ])

    await processDueAutomationSteps()

    expect(enrollmentUpdate).toHaveBeenCalledWith({
      where: { id: 'enr_1' },
      data: { status: 'COMPLETED', completedAt: NOW },
    })
  })

  it('completes an enrollment whose step index has run off the end', async () => {
    enrollmentFindMany.mockResolvedValue([enrollment({ currentStep: 5 })])

    await processDueAutomationSteps()

    expect(sendEmail).not.toHaveBeenCalled()
    expect(enrollmentUpdate).toHaveBeenCalledWith({
      where: { id: 'enr_1' },
      data: { status: 'COMPLETED', completedAt: NOW },
    })
  })

  it('stops mailing someone who unsubscribed, when the automation says to', async () => {
    enrollmentFindMany.mockResolvedValue([
      enrollment({ automation: automation({ stopConditions: { onUnsubscribe: true } }) }),
    ])
    checkSuppression.mockResolvedValue(true)

    const result = await processDueAutomationSteps()

    expect(sendEmail).not.toHaveBeenCalled()
    expect(enrollmentUpdate).toHaveBeenCalledWith({
      where: { id: 'enr_1' },
      data: { status: 'UNSUBSCRIBED' },
    })
    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED' }) })
    )
    expect(result.processed).toBe(0)
  })

  it('skips a suppressed address even when the automation has no stop condition', async () => {
    // Hard bounces and complaints are never an admin's choice to mail.
    enrollmentFindMany.mockResolvedValue([enrollment()])
    checkSuppression.mockResolvedValue(true)

    await processDueAutomationSteps()

    expect(sendEmail).not.toHaveBeenCalled()
    expect(enrollmentUpdate).toHaveBeenCalledWith({
      where: { id: 'enr_1' },
      data: { status: 'UNSUBSCRIBED' },
    })
  })

  it('skips someone who opted out of marketing email on the unsubscribe page', async () => {
    enrollmentFindMany.mockResolvedValue([enrollment({ email: 'Buyer@Example.com' })])
    checkUnsubscribed.mockResolvedValue(true)

    await processDueAutomationSteps()

    expect(checkUnsubscribed).toHaveBeenCalledWith({
      email: 'buyer@example.com',
      category: ['marketing'],
    })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("honours the form's own re-engagement category for the re-engagement series", async () => {
    enrollmentFindMany.mockResolvedValue([
      enrollment({ automation: automation({ trigger: 'REENGAGEMENT' }) }),
    ])

    await processDueAutomationSteps()

    expect(checkUnsubscribed).toHaveBeenCalledWith({
      email: 'buyer@example.com',
      category: ['marketing', 'reengagement'],
    })
  })

  it('stops the series once the recipient buys, when the automation says to', async () => {
    enrollmentFindMany.mockResolvedValue([
      enrollment({ automation: automation({ stopConditions: { onPurchase: true } }) }),
    ])
    orderFindFirst.mockResolvedValue({ id: 'order_9' })

    await processDueAutomationSteps()

    expect(orderFindFirst.mock.calls[0][0].where.createdAt).toEqual({
      gt: new Date('2026-08-09T12:00:00Z'),
    })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(enrollmentUpdate).toHaveBeenCalledWith({
      where: { id: 'enr_1' },
      data: { status: 'CANCELLED', completedAt: NOW },
    })
  })

  it('does not look for purchases when the automation does not stop on them', async () => {
    enrollmentFindMany.mockResolvedValue([enrollment()])

    await processDueAutomationSteps()

    expect(orderFindFirst).not.toHaveBeenCalled()
    expect(sendEmail).toHaveBeenCalled()
  })

  it('fills {{UNSUBSCRIBE_URL}} with the signed unsubscribe link', async () => {
    enrollmentFindMany.mockResolvedValue([enrollment()])
    templateFindUnique.mockResolvedValue({
      id: 'tmpl_1',
      subject: 'Hi',
      html: '<p>Hi</p><a href="{{UNSUBSCRIBE_URL}}">Unsubscribe</a>',
    })

    await processDueAutomationSteps()

    const { html } = sendEmail.mock.calls[0][0]
    expect(html).toMatch(/href="https?:\/\/[^"]+\/unsubscribe\?email=buyer%40example\.com&token=[0-9a-f]{32}"/)
    // Filled in place, not appended a second time.
    expect(html.match(/Unsubscribe/g)).toHaveLength(1)
  })

  it('appends an unsubscribe footer to a template that has none', async () => {
    enrollmentFindMany.mockResolvedValue([enrollment()])

    await processDueAutomationSteps()

    const { html } = sendEmail.mock.calls[0][0]
    expect(html).toContain('/unsubscribe?email=buyer%40example.com&token=')
    expect(html).toContain('>Unsubscribe</a>')
  })

  it('does not let trigger data replace the unsubscribe link', async () => {
    enrollmentFindMany.mockResolvedValue([
      enrollment({ triggerData: { UNSUBSCRIBE_URL: 'https://evil.example' } }),
    ])
    templateFindUnique.mockResolvedValue({ id: 'tmpl_1', subject: 'Hi', html: '{{UNSUBSCRIBE_URL}}' })

    await processDueAutomationSteps()

    expect(sendEmail.mock.calls[0][0].html).not.toContain('evil.example')
  })

  it('sends RFC 8058 one-click unsubscribe headers pointing at the API route', async () => {
    enrollmentFindMany.mockResolvedValue([enrollment()])

    await processDueAutomationSteps()

    const { headers } = sendEmail.mock.calls[0][0]
    expect(headers['List-Unsubscribe']).toMatch(
      /^<https?:\/\/[^>]+\/api\/unsubscribe\?email=buyer%40example\.com&token=[0-9a-f]{32}>$/
    )
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('counts a failed send as an error and records why', async () => {
    enrollmentFindMany.mockResolvedValue([enrollment()])
    sendEmail.mockResolvedValue({ success: false, error: 'Resend rejected the message' })

    const result = await processDueAutomationSteps()

    expect(logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'Resend rejected the message',
        }),
      })
    )
    expect(result).toEqual({ processed: 0, errors: 1 })
  })

  it('still advances past a step whose email failed', async () => {
    enrollmentFindMany.mockResolvedValue([enrollment()])
    sendEmail.mockResolvedValue({ success: false, error: 'temporary failure' })

    await processDueAutomationSteps()

    // Deliberate: the enrollment moves on rather than retrying. Holding position would re-send
    // the same failing step every five minutes indefinitely, and the failure is recorded in
    // `automationLog` either way.
    expect(enrollmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStep: 1 }) })
    )
  })

  it('keeps going after one enrollment blows up', async () => {
    enrollmentFindMany.mockResolvedValue([
      enrollment({ id: 'enr_broken' }),
      enrollment({ id: 'enr_ok', email: 'other@example.com' }),
    ])
    enrollmentUpdate.mockRejectedValueOnce(new Error('row vanished'))

    const result = await processDueAutomationSteps()

    // One bad enrollment must not strand every other customer in the queue.
    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(result.errors).toBe(1)
  })

  it('sends nothing when the step points at a template that no longer exists', async () => {
    enrollmentFindMany.mockResolvedValue([enrollment()])
    templateFindUnique.mockResolvedValue(null)

    const result = await processDueAutomationSteps()

    expect(sendEmail).not.toHaveBeenCalled()
    expect(result.processed).toBe(0)
    // It still advances, so a deleted template does not wedge the enrollment forever.
    expect(enrollmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStep: 1 }) })
    )
  })
})

describe('withUnsubscribeFooter', () => {
  it('puts the footer inside the body when there is one', () => {
    expect(withUnsubscribeFooter('<html><body><p>x</p></body></html>', 'https://u')).toMatch(
      /<a href="https:\/\/u"[^>]*>Unsubscribe<\/a><\/p><\/body><\/html>$/
    )
  })

  it('leaves html that already links the URL alone', () => {
    expect(withUnsubscribeFooter('<a href="https://u">bye</a>', 'https://u')).toBe(
      '<a href="https://u">bye</a>'
    )
  })
})
