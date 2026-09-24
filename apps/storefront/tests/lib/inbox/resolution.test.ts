import { beforeEach, describe, expect, it, vi } from 'vitest'

const inboundEmailFindUnique = vi.fn()
const inboundEmailUpdate = vi.fn()
const stepFindUnique = vi.fn()
const stepUpdate = vi.fn()
const notificationUpdateMany = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    inboundEmail: { findUnique: inboundEmailFindUnique, update: inboundEmailUpdate },
    inboundEmailStep: { findUnique: stepFindUnique, update: stepUpdate },
    notification: { updateMany: notificationUpdateMany },
  }
  return { prisma: client, default: client }
})

const { canClearNotification, completeStep, isResolvable, outstandingSteps, reopenStep } =
  await import('@/lib/inbox/resolution')

function step(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    emailId: 'e1',
    position: 0,
    instruction: 'Refund the broken jar',
    isOptional: false,
    completedAt: null,
    completedById: null,
    note: null,
    createdAt: new Date(),
    ...overrides,
  } as never
}

describe('outstandingSteps', () => {
  it('counts only required, incomplete steps', () => {
    const steps = [
      step({ id: 's1' }),
      step({ id: 's2', isOptional: true }),
      step({ id: 's3', completedAt: new Date() }),
    ]

    expect(outstandingSteps(steps).map((s) => s.id)).toEqual(['s1'])
    expect(isResolvable(steps)).toBe(false)
  })

  it('is resolvable when only optional steps remain', () => {
    expect(isResolvable([step({ completedAt: new Date() }), step({ isOptional: true })])).toBe(true)
  })

  it('is resolvable with no steps at all', () => {
    expect(isResolvable([])).toBe(true)
  })
})

describe('canClearNotification', () => {
  beforeEach(() => vi.clearAllMocks())

  it('leaves notifications that are not about an email alone', async () => {
    const verdict = await canClearNotification({ entityType: 'Order', entityId: 'o1' })

    expect(verdict.allowed).toBe(true)
    expect(inboundEmailFindUnique).not.toHaveBeenCalled()
  })

  it('blocks while a required step is open, and names what is outstanding', async () => {
    inboundEmailFindUnique.mockResolvedValue({ status: 'NEEDS_ACTION', steps: [step()] })

    const verdict = await canClearNotification({ entityType: 'InboundEmail', entityId: 'e1' })

    expect(verdict.allowed).toBe(false)
    if (!verdict.allowed) {
      expect(verdict.outstanding).toEqual(['Refund the broken jar'])
    }
  })

  it('allows an auto-answered email, which owes nothing', async () => {
    inboundEmailFindUnique.mockResolvedValue({ status: 'AUTO_ANSWERED', steps: [] })

    expect((await canClearNotification({ entityType: 'InboundEmail', entityId: 'e1' })).allowed).toBe(
      true,
    )
  })

  it('does not strand an alert whose email has been deleted', async () => {
    inboundEmailFindUnique.mockResolvedValue(null)

    expect((await canClearNotification({ entityType: 'InboundEmail', entityId: 'e1' })).allowed).toBe(
      true,
    )
  })
})

describe('completeStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stepFindUnique.mockResolvedValue({ id: 's1', emailId: 'e1', completedAt: null })
    stepUpdate.mockResolvedValue({})
    notificationUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('resolves the email and releases the alert when the last required step is done', async () => {
    inboundEmailFindUnique.mockResolvedValue({
      id: 'e1',
      status: 'NEEDS_ACTION',
      resolvedAt: null,
      resolvedById: null,
      steps: [step({ completedAt: new Date() })],
    })
    inboundEmailUpdate.mockResolvedValue({ id: 'e1', status: 'RESOLVED', steps: [] })

    await completeStep({ stepId: 's1', userId: 'u1' })

    expect(inboundEmailUpdate.mock.calls[0][0].data.status).toBe('RESOLVED')
    expect(notificationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entityType: 'InboundEmail', entityId: 'e1' }),
      }),
    )
  })

  it('moves to IN_PROGRESS and leaves the alert blocking while work remains', async () => {
    inboundEmailFindUnique.mockResolvedValue({
      id: 'e1',
      status: 'NEEDS_ACTION',
      resolvedAt: null,
      resolvedById: null,
      steps: [step({ id: 's1', completedAt: new Date() }), step({ id: 's2' })],
    })
    inboundEmailUpdate.mockResolvedValue({ id: 'e1', status: 'IN_PROGRESS', steps: [] })

    await completeStep({ stepId: 's1', userId: 'u1' })

    expect(inboundEmailUpdate.mock.calls[0][0].data.status).toBe('IN_PROGRESS')
    expect(notificationUpdateMany).not.toHaveBeenCalled()
  })

  it('records who did it and what they did', async () => {
    inboundEmailFindUnique.mockResolvedValue({
      id: 'e1',
      status: 'NEEDS_ACTION',
      resolvedAt: null,
      resolvedById: null,
      steps: [step()],
    })
    inboundEmailUpdate.mockResolvedValue({ id: 'e1', status: 'NEEDS_ACTION', steps: [] })

    await completeStep({ stepId: 's1', userId: 'u1', note: '  refunded $24  ' })

    expect(stepUpdate.mock.calls[0][0].data).toMatchObject({
      completedById: 'u1',
      note: 'refunded $24',
    })
  })

  it('does not re-stamp a step that was already complete', async () => {
    stepFindUnique.mockResolvedValue({ id: 's1', emailId: 'e1', completedAt: new Date() })
    inboundEmailFindUnique.mockResolvedValue({
      id: 'e1',
      status: 'IN_PROGRESS',
      resolvedAt: null,
      resolvedById: null,
      steps: [step({ completedAt: new Date() })],
    })
    inboundEmailUpdate.mockResolvedValue({ id: 'e1', status: 'RESOLVED', steps: [] })

    await completeStep({ stepId: 's1', userId: 'u2' })

    expect(stepUpdate).not.toHaveBeenCalled()
  })

  it('does not disturb an auto-answered email', async () => {
    const email = { id: 'e1', status: 'AUTO_ANSWERED', resolvedAt: null, resolvedById: null, steps: [] }
    inboundEmailFindUnique.mockResolvedValue(email)

    await completeStep({ stepId: 's1', userId: 'u1' })

    expect(inboundEmailUpdate).not.toHaveBeenCalled()
  })

  it('refuses a step that no longer exists', async () => {
    stepFindUnique.mockResolvedValue(null)

    await expect(completeStep({ stepId: 'gone', userId: 'u1' })).rejects.toThrow(/no longer exists/)
  })
})

describe('reopenStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stepFindUnique.mockResolvedValue({ id: 's1', emailId: 'e1' })
    stepUpdate.mockResolvedValue({})
  })

  it('clears the completion and drops the email out of RESOLVED', async () => {
    inboundEmailFindUnique.mockResolvedValue({
      id: 'e1',
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedById: 'u1',
      steps: [step()],
    })
    inboundEmailUpdate.mockResolvedValue({ id: 'e1', status: 'NEEDS_ACTION', steps: [] })

    await reopenStep({ stepId: 's1', userId: 'u2' })

    expect(stepUpdate.mock.calls[0][0].data).toEqual({
      completedAt: null,
      completedById: null,
      note: null,
    })
    expect(inboundEmailUpdate.mock.calls[0][0].data).toMatchObject({
      status: 'NEEDS_ACTION',
      resolvedAt: null,
      resolvedById: null,
    })
  })
})
