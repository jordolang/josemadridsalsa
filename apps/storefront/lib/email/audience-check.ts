/**
 * The audience check a campaign must pass before it sends.
 *
 * Whoever presses send first sees how many people the campaign will reach, a
 * sample of their names, and how many of them have an open order. For an order
 * or shipping update they can drop everyone without one. The confirmation is
 * recorded in the audit log against the exact recipient count it approved, and
 * every path that starts a campaign (the Launch button, the send API, the
 * scheduled-send cron) refuses one without a current confirmation.
 */

import { prisma } from '@/lib/prisma'
import { isOpenOrdersListId, loadOpenOrderEmails, normalizeEmail } from '@/lib/email/open-orders'

export const AUDIENCE_CONFIRMED_ACTION = 'email_campaign.audience_confirmed'
export const AUDIENCE_ENTITY_TYPE = 'email_campaign'
export const AUDIENCE_SAMPLE_SIZE = 10

const PAGE_SIZE = 1000
const DELETE_BATCH = 500

/**
 * Words that mark a campaign as an order or shipping status update. A bare
 * "order" is left out: "order now" is how half the marketing emails read.
 */
const ORDER_STATUS_PATTERN = /\b(ship\w*|deliver\w*|tracking|delay\w*)\b|\byour orders?\b/i

export function looksLikeOrderStatusUpdate(...texts: Array<string | null | undefined>): boolean {
  return texts.some((t) => !!t && ORDER_STATUS_PATTERN.test(t))
}

export interface AudienceRecipient {
  id: string
  email: string
  name: string | null
}

export function splitByOpenOrder<T extends { email: string }>(
  recipients: T[],
  openOrderEmails: Set<string>,
): { withOpenOrder: T[]; withoutOpenOrder: T[] } {
  const withOpenOrder: T[] = []
  const withoutOpenOrder: T[] = []
  for (const r of recipients) {
    const email = normalizeEmail(r.email)
    if (email && openOrderEmails.has(email)) withOpenOrder.push(r)
    else withoutOpenOrder.push(r)
  }
  return { withOpenOrder, withoutOpenOrder }
}

/** True when a recorded confirmation approved the campaign's current recipient count. */
export function isConfirmationCurrent(changes: unknown, totalRecipients: number): boolean {
  if (!changes || typeof changes !== 'object') return false
  const count = (changes as { recipientCount?: unknown }).recipientCount
  return typeof count === 'number' && count === totalRecipients && totalRecipients > 0
}

async function loadPendingRecipients(campaignId: string): Promise<AudienceRecipient[]> {
  const all: AudienceRecipient[] = []
  let cursorId: string | undefined
  for (;;) {
    const batch = await prisma.emailRecipient.findMany({
      where: {
        campaignId,
        status: 'PENDING',
        ...(cursorId === undefined ? {} : { id: { gt: cursorId } }),
      },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      select: { id: true, email: true, name: true },
    })
    all.push(...batch)
    if (batch.length < PAGE_SIZE) break
    cursorId = batch[batch.length - 1].id
  }
  return all
}

export interface AudienceCheck {
  campaignId: string
  recipientCount: number
  sample: Array<{ email: string; name: string | null }>
  withOpenOrder: number
  withoutOpenOrder: number
  listName: string | null
  isOpenOrdersList: boolean
  /** Order/shipping updates default to sending only to people with an open order. */
  suggestOnlyOpenOrders: boolean
  confirmed: boolean
}

function sampleOf(recipients: AudienceRecipient[]) {
  // Named people first: a sample of bare addresses tells you little about who this is.
  const named = recipients.filter((r) => r.name)
  const unnamed = recipients.filter((r) => !r.name)
  return [...named, ...unnamed]
    .slice(0, AUDIENCE_SAMPLE_SIZE)
    .map((r) => ({ email: r.email, name: r.name }))
}

export async function hasConfirmedAudience(campaign: {
  id: string
  totalRecipients: number
}): Promise<boolean> {
  const latest = await prisma.auditLog.findFirst({
    where: {
      action: AUDIENCE_CONFIRMED_ACTION,
      entityType: AUDIENCE_ENTITY_TYPE,
      entityId: campaign.id,
    },
    orderBy: { createdAt: 'desc' },
    select: { changes: true },
  })
  return !!latest && isConfirmationCurrent(latest.changes, campaign.totalRecipients)
}

export async function getAudienceCheck(campaignId: string): Promise<AudienceCheck | null> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      subject: true,
      listId: true,
      totalRecipients: true,
      list: { select: { name: true } },
    },
  })
  if (!campaign) return null

  const [recipients, openOrderEmails, confirmed] = await Promise.all([
    loadPendingRecipients(campaignId),
    loadOpenOrderEmails(),
    hasConfirmedAudience(campaign),
  ])
  const { withOpenOrder, withoutOpenOrder } = splitByOpenOrder(recipients, openOrderEmails)
  const isOpenOrdersList = isOpenOrdersListId(campaign.listId)

  return {
    campaignId,
    recipientCount: recipients.length,
    sample: sampleOf(recipients),
    withOpenOrder: withOpenOrder.length,
    withoutOpenOrder: withoutOpenOrder.length,
    listName: campaign.list?.name ?? null,
    isOpenOrdersList,
    suggestOnlyOpenOrders:
      isOpenOrdersList || looksLikeOrderStatusUpdate(campaign.subject, campaign.name),
    confirmed,
  }
}

export class AudienceCheckError extends Error {}

/**
 * Record that `userId` reviewed this campaign's audience. `expectedRecipients`
 * is the count the reviewer was shown; if the audience changed since, the
 * confirmation is refused so nobody approves a list they did not see. With
 * `onlyOpenOrders`, recipients without an open order are removed first.
 */
export async function confirmAudience(params: {
  campaignId: string
  userId: string
  expectedRecipients: number
  onlyOpenOrders: boolean
}): Promise<{ recipientCount: number; removed: number }> {
  const { campaignId, userId, expectedRecipients, onlyOpenOrders } = params

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, status: true, startedAt: true, totalRecipients: true },
  })
  if (!campaign) throw new AudienceCheckError('Campaign not found')
  if (!['DRAFT', 'SCHEDULED'].includes(campaign.status) || campaign.startedAt) {
    throw new AudienceCheckError('Only a campaign that has not started sending can be reviewed')
  }

  // A create that died part-way leaves fewer rows than `totalRecipients`. The
  // launch guard refuses that draft, and rewriting the total below would hide it.
  const materialised = await prisma.emailRecipient.count({ where: { campaignId } })
  if (materialised !== campaign.totalRecipients) {
    throw new AudienceCheckError(
      `Campaign is incomplete: ${materialised} of ${campaign.totalRecipients} recipients were saved. ` +
        'Delete it and create it again.',
    )
  }

  const recipients = await loadPendingRecipients(campaignId)
  if (recipients.length !== expectedRecipients) {
    throw new AudienceCheckError(
      `The audience changed while you were reviewing it (${expectedRecipients} → ${recipients.length}). Check it again.`,
    )
  }

  let removed = 0
  let sample = sampleOf(recipients)
  if (onlyOpenOrders) {
    const openOrderEmails = await loadOpenOrderEmails()
    const { withOpenOrder, withoutOpenOrder } = splitByOpenOrder(recipients, openOrderEmails)
    if (withOpenOrder.length === 0) {
      throw new AudienceCheckError('Nobody on this campaign has an open order, so there is no one to send it to.')
    }
    const ids = withoutOpenOrder.map((r) => r.id)
    for (let i = 0; i < ids.length; i += DELETE_BATCH) {
      const res = await prisma.emailRecipient.deleteMany({
        where: { campaignId, status: 'PENDING', id: { in: ids.slice(i, i + DELETE_BATCH) } },
      })
      removed += res.count
    }
    sample = sampleOf(withOpenOrder)
  }

  const recipientCount = await prisma.emailRecipient.count({ where: { campaignId } })
  if (recipientCount !== campaign.totalRecipients) {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { totalRecipients: recipientCount },
    })
  }

  // Written directly rather than through `logAudit`, which swallows failures:
  // a confirmation that silently failed to save would block the send anyway.
  await prisma.auditLog.create({
    data: {
      userId,
      action: AUDIENCE_CONFIRMED_ACTION,
      entityType: AUDIENCE_ENTITY_TYPE,
      entityId: campaignId,
      changes: {
        recipientCount,
        onlyOpenOrders,
        removedWithoutOpenOrder: removed,
        sample: sample.map((s) => s.name || s.email),
      },
    },
  })

  return { recipientCount, removed }
}

export const AUDIENCE_NOT_CONFIRMED_MESSAGE =
  'Review the audience before sending: check the recipient count and sample, then confirm.'
