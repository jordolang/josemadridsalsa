import { beforeEach, describe, expect, it, vi } from 'vitest'

const orderFindUnique = vi.fn()
const participantFindUnique = vi.fn()
const participantUpdate = vi.fn()
const sendParticipantMilestoneEmail = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    order: { findUnique: orderFindUnique },
    fundraiserParticipant: { findUnique: participantFindUnique, update: participantUpdate },
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/email/automation', () => ({ sendParticipantMilestoneEmail }))

const { handleParticipantMilestone } = await import(
  '@/lib/domain-events/handlers/participant-milestone'
)

const event = {
  id: 'evt_1',
  type: 'payment.completed',
  entityType: 'order',
  entityId: 'order_1',
  payload: null,
  actorUserId: null,
  createdAt: new Date('2026-08-09T12:00:00Z'),
} as never

function participant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p_1',
    name: 'Sam',
    email: 'sam@example.com',
    totalOrders: 5,
    totalRevenue: 50,
    lastMilestoneNotified: 0,
    fundraiser: { id: 'f_1', name: 'Zanesville Band' },
    ...overrides,
  }
}

describe('participant milestone handler', () => {
  beforeEach(() => {
    orderFindUnique.mockReset()
    participantFindUnique.mockReset()
    participantUpdate.mockReset()
    participantUpdate.mockResolvedValue({})
    sendParticipantMilestoneEmail.mockReset()
    sendParticipantMilestoneEmail.mockResolvedValue({ success: true })
  })

  it('congratulates a participant who has just passed a milestone', async () => {
    orderFindUnique.mockResolvedValue({ participantId: 'p_1' })
    participantFindUnique.mockResolvedValue(participant())

    await handleParticipantMilestone(event)

    expect(sendParticipantMilestoneEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'sam@example.com',
        milestone: 5,
        fundraiserName: 'Zanesville Band',
      })
    )
  })

  it('skips a seller who joined through the mobile app without an email', async () => {
    orderFindUnique.mockResolvedValue({ participantId: 'p_1' })
    participantFindUnique.mockResolvedValue(participant({ email: null }))

    await handleParticipantMilestone(event)

    expect(sendParticipantMilestoneEmail).not.toHaveBeenCalled()
  })

  it('records the milestone so a replayed event sends nothing', async () => {
    orderFindUnique.mockResolvedValue({ participantId: 'p_1' })
    participantFindUnique.mockResolvedValue(participant())

    await handleParticipantMilestone(event)

    expect(participantUpdate).toHaveBeenCalledWith({
      where: { id: 'p_1' },
      data: { lastMilestoneNotified: 5 },
    })
  })

  it('records the milestone only after the email is sent', async () => {
    const order: string[] = []
    orderFindUnique.mockResolvedValue({ participantId: 'p_1' })
    participantFindUnique.mockResolvedValue(participant())
    sendParticipantMilestoneEmail.mockImplementation(async () => {
      order.push('send')
      return { success: true }
    })
    participantUpdate.mockImplementation(async () => {
      order.push('mark')
      return {}
    })

    await handleParticipantMilestone(event)

    // A crash between the two repeats one email rather than silently swallowing it.
    expect(order).toEqual(['send', 'mark'])
  })

  it('says nothing when the milestone was already announced', async () => {
    orderFindUnique.mockResolvedValue({ participantId: 'p_1' })
    participantFindUnique.mockResolvedValue(participant({ lastMilestoneNotified: 5 }))

    await handleParticipantMilestone(event)

    expect(sendParticipantMilestoneEmail).not.toHaveBeenCalled()
    expect(participantUpdate).not.toHaveBeenCalled()
  })

  it('reports gross sales as raised, not the group commission', async () => {
    orderFindUnique.mockResolvedValue({ participantId: 'p_1' })
    participantFindUnique.mockResolvedValue(participant({ totalRevenue: 250 }))

    await handleParticipantMilestone(event)

    expect(sendParticipantMilestoneEmail.mock.calls[0][0].totalRaised).toBe(250)
  })

  it('leaves an ordinary storefront order alone without touching the fundraiser tables', async () => {
    orderFindUnique.mockResolvedValue({ participantId: null })

    await handleParticipantMilestone(event)

    expect(participantFindUnique).not.toHaveBeenCalled()
    expect(sendParticipantMilestoneEmail).not.toHaveBeenCalled()
  })

  it('does nothing when the order has gone', async () => {
    orderFindUnique.mockResolvedValue(null)

    await expect(handleParticipantMilestone(event)).resolves.toBeUndefined()
    expect(sendParticipantMilestoneEmail).not.toHaveBeenCalled()
  })

  it('does nothing when the participant has been removed', async () => {
    orderFindUnique.mockResolvedValue({ participantId: 'p_1' })
    participantFindUnique.mockResolvedValue(null)

    await expect(handleParticipantMilestone(event)).resolves.toBeUndefined()
    expect(sendParticipantMilestoneEmail).not.toHaveBeenCalled()
  })
})
