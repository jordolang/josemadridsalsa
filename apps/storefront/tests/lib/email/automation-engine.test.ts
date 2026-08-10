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
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/email/sender', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/sender')>()
  return { ...actual, sendEmail }
})

vi.mock('@/lib/email/suppression', () => ({ checkSuppression }))

const { enrollInAutomation, processDueAutomationSteps } = await import(
  '@/lib/email/automation-engine'
)

const NOW = new Date('2026-08-10T12:00:00Z')

function automation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'auto_1',
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
    expect(sent.html).toBe('<p>Hello Sam</p>')
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

  it('does not check suppression when the automation has no stop condition', async () => {
    enrollmentFindMany.mockResolvedValue([enrollment()])

    await processDueAutomationSteps()

    expect(checkSuppression).not.toHaveBeenCalled()
    expect(sendEmail).toHaveBeenCalled()
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
