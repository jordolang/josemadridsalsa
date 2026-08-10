/**
 * Domain events → "you have hit N sales" for fundraiser participants.
 *
 * `sendParticipantMilestoneEmail` existed, rendered, and had no callers — the one piece of the
 * fundraising loop that tells a seller their effort registered anywhere.
 *
 * It hangs off `payment.completed` rather than off the commission crediting that updates the
 * counter, because `lib/fundraising/credit-commission.ts` runs inside a transaction and sending
 * email from there would hold it open across a network call. By the time the outbox drain runs,
 * the counter is already updated, so reading it here is both safe and current.
 */
import { prisma } from '@/lib/prisma'
import { sendParticipantMilestoneEmail } from '@/lib/email/automation'
import { pendingMilestone } from '@/lib/fundraising/milestones'

import { registerDomainEventHandler } from '../subscribe'
import type { DomainEventRecord } from '../subscribe'

/**
 * Congratulate a participant when a paid order takes them past a milestone.
 *
 * Replay-safe through `lastMilestoneNotified`: the marker is written after the send, and a
 * milestone already recorded there is silent. That ordering means a crash between sending and
 * recording repeats one email, which is the right way round — a duplicate congratulation is
 * harmless, a missing one is the whole point of the feature.
 */
export async function handleParticipantMilestone(event: DomainEventRecord): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: event.entityId },
    select: { participantId: true },
  })

  // Most orders are not fundraiser sales; leaving early keeps this off the general checkout path.
  if (!order?.participantId) return

  const participant = await prisma.fundraiserParticipant.findUnique({
    where: { id: order.participantId },
    select: {
      id: true,
      name: true,
      email: true,
      totalOrders: true,
      totalRevenue: true,
      lastMilestoneNotified: true,
      fundraiser: { select: { id: true, name: true } },
    },
  })

  if (!participant) return

  const milestone = pendingMilestone(participant.totalOrders, participant.lastMilestoneNotified)
  if (milestone === null) return

  await sendParticipantMilestoneEmail({
    email: participant.email,
    participantName: participant.name,
    fundraiserName: participant.fundraiser.name,
    milestone,
    totalSales: participant.totalOrders,
    // Gross sales, not commission. A goal on this site is measured in sales, so reporting the
    // group's share here would name the other figure entirely.
    totalRaised: Number(participant.totalRevenue),
    fundraiserId: participant.fundraiser.id,
  })

  await prisma.fundraiserParticipant.update({
    where: { id: participant.id },
    data: { lastMilestoneNotified: milestone },
  })
}

/** Subscribe to paid orders, whichever payment path produced them. */
export function registerParticipantMilestoneHandlers(): void {
  registerDomainEventHandler('payment.completed', 'participant-milestone', handleParticipantMilestone)
}
