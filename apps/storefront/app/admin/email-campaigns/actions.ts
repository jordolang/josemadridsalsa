'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { parseCSV, parseTextList } from '@/lib/email/sender'
import { triggerCampaignContinuation } from '@/lib/email/queue'
import {
  parseVariableMappings,
  resolveVariablesForRecipient,
  type DiscountCodeMap,
  type SubscriberLike,
  type VariableMappings,
} from '@/lib/email/variable-mapping'

/**
 * Load every DiscountCode referenced by a `discountCode` mapping into a
 * { id → code } map so the resolver can run synchronously per-recipient.
 *
 * Only active codes are loaded. Throws if any referenced id is missing or
 * inactive — the campaign cannot be created if it would silently embed a
 * disabled (or forged) discount code.
 */
async function loadDiscountCodeMap(
  mappings: VariableMappings,
): Promise<DiscountCodeMap> {
  const ids = Array.from(
    new Set(
      Object.values(mappings)
        .filter((m) => m.source === 'discountCode' && typeof m.key === 'string')
        .map((m) => m.key as string),
    ),
  )
  if (ids.length === 0) return {}
  const codes = await prisma.discountCode.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true, code: true },
  })
  if (codes.length !== ids.length) {
    const found = new Set(codes.map((c) => c.id))
    const missing = ids.filter((id) => !found.has(id))
    throw new Error(
      `Discount code(s) not found or inactive: ${missing.join(', ')}`,
    )
  }
  return Object.fromEntries(codes.map((c) => [c.id, c.code]))
}

/** Safely parse the client-supplied mappings JSON. Returns {} on malformed input. */
function parseMappingsFromFormData(raw: FormDataEntryValue | null): VariableMappings {
  if (typeof raw !== 'string' || raw.length === 0) return {}
  try {
    return parseVariableMappings(JSON.parse(raw))
  } catch {
    return {}
  }
}

/**
 * Rows moved per round trip when a campaign is built from a mailing list.
 *
 * A list built from the customer database runs to tens of thousands of
 * contacts. Loading them all into this action's memory — and then into a single
 * nested `create` — is the shape that overran the serverless function on the
 * list page, so both the read and the write are paged.
 */
const RECIPIENT_BATCH_SIZE = 1000

type NewRecipient = {
  email: string
  name?: string
  variables?: Record<string, string>
}

/** Insert an already-materialised recipient list in bounded batches. */
async function insertRecipients(
  campaignId: string,
  recipients: NewRecipient[],
): Promise<number> {
  for (let i = 0; i < recipients.length; i += RECIPIENT_BATCH_SIZE) {
    await prisma.emailRecipient.createMany({
      data: recipients.slice(i, i + RECIPIENT_BATCH_SIZE).map((r) => ({
        campaignId,
        email: r.email,
        name: r.name,
        variables: r.variables,
        status: 'PENDING' as const,
      })),
    })
  }
  return recipients.length
}

/**
 * Page through a mailing list's subscribers, writing each batch out as
 * recipients before reading the next. Returns the number actually inserted,
 * which can differ from a count taken beforehand if someone unsubscribes
 * mid-run.
 */
async function insertRecipientsFromList(
  campaignId: string,
  listId: string,
  mappings: VariableMappings,
  discountCodes: DiscountCodeMap,
): Promise<number> {
  const hasMappings = Object.keys(mappings).length > 0
  // `customFields` is the importer's dumping ground for every unmapped column
  // of the source CSV, so it is only worth fetching when a mapping reads it.
  const needsCustomFields = Object.values(mappings).some(
    (m) => m.source === 'customField',
  )

  let inserted = 0
  let cursorEmail: string | undefined

  for (;;) {
    const batch = await prisma.mailingListSubscriber.findMany({
      where: {
        listId,
        status: 'SUBSCRIBED',
        // Keyset, not a Prisma `cursor`: a cursor has to locate the boundary
        // row, so an admin removing that subscriber between pages would end the
        // read early and silently drop everyone after it. `(listId, email)` is
        // unique, so email totally orders a single list and this predicate
        // rides the index the filter already uses. `createdAt` cannot page: a
        // CSV import stamps thousands of rows with the same value.
        ...(cursorEmail === undefined ? {} : { email: { gt: cursorEmail } }),
      },
      orderBy: { email: 'asc' },
      take: RECIPIENT_BATCH_SIZE,
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        customFields: needsCustomFields,
      },
    })

    if (batch.length === 0) break

    await prisma.emailRecipient.createMany({
      data: batch.map((s) => {
        const subscriber: SubscriberLike = {
          email: s.email,
          firstName: s.firstName,
          lastName: s.lastName,
          phone: s.phone,
          customFields: (s.customFields as Record<string, unknown> | null) ?? null,
        }
        return {
          campaignId,
          email: s.email,
          name: [s.firstName, s.lastName].filter(Boolean).join(' ') || undefined,
          variables: hasMappings
            ? resolveVariablesForRecipient(mappings, subscriber, { discountCodes })
            : {},
          status: 'PENDING' as const,
        }
      }),
    })
    inserted += batch.length

    if (batch.length < RECIPIENT_BATCH_SIZE) break
    cursorEmail = batch[batch.length - 1].email
  }

  return inserted
}

export async function createCampaign(formData: FormData) {
  const user = await getCurrentUser()
  
  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }
  
  try {
    const name = formData.get('name') as string
    const templateId = formData.get('templateId') as string
    const subject = formData.get('subject') as string
    const recipientsSource = formData.get('recipientsSource') as string // 'csv' | 'text' | 'paste' | 'list'
    const recipientsData = formData.get('recipientsData') as string
    const listId = formData.get('listId') as string | null
    const variableMappings = parseMappingsFromFormData(formData.get('variableMappings'))
    const hasMappings = Object.keys(variableMappings).length > 0
    const discountCodes = hasMappings ? await loadDiscountCodeMap(variableMappings) : {}

    if (!name || !templateId || !subject) {
      return { error: 'Missing required fields' }
    }

    // Verify template exists
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return { error: 'Template not found' }
    }

    let recipientsList: NewRecipient[] = []
    let parseErrors: string[] = []
    let listRecipientCount = 0

    if (recipientsSource === 'list') {
      if (!listId) {
        return { error: 'Mailing list required' }
      }
      const list = await prisma.mailingList.findUnique({
        where: { id: listId },
        select: { id: true },
      })
      if (!list) {
        return { error: 'Mailing list not found' }
      }
      // Only the size is needed here; the subscribers themselves are streamed
      // into recipients after the campaign row exists.
      listRecipientCount = await prisma.mailingListSubscriber.count({
        where: { listId, status: 'SUBSCRIBED' },
      })
    } else if (recipientsSource === 'csv') {
      const parsed = parseCSV(recipientsData)
      parseErrors = parsed.errors
      recipientsList = parsed.recipients.map((r) => {
        const csvRow = (r.variables ?? {}) as Record<string, string>
        const [first, ...rest] = (r.name ?? '').split(' ')
        const subscriber: SubscriberLike = {
          email: r.email,
          firstName: first || null,
          lastName: rest.join(' ') || null,
          phone: csvRow.phone ?? null,
          customFields: csvRow,
        }
        return {
          email: r.email,
          name: r.name,
          variables: hasMappings
            ? resolveVariablesForRecipient(variableMappings, subscriber, { csvRow, discountCodes })
            : csvRow,
        }
      })
    } else if (recipientsSource === 'text' || recipientsSource === 'paste') {
      const parsed = parseTextList(recipientsData)
      parseErrors = parsed.errors
      recipientsList = parsed.recipients.map((r) => {
        const subscriber: SubscriberLike = { email: r.email }
        return {
          email: r.email,
          variables: hasMappings
            ? resolveVariablesForRecipient(variableMappings, subscriber, { discountCodes })
            : {},
        }
      })
    }

    const totalRecipients =
      recipientsSource === 'list' ? listRecipientCount : recipientsList.length

    if (totalRecipients === 0) {
      return { error: 'No valid recipients found', parseErrors }
    }

    // Create campaign
    const campaign = await prisma.emailCampaign.create({
      data: {
        name,
        templateId,
        subject,
        status: 'DRAFT',
        listId: recipientsSource === 'list' && listId ? listId : null,
        totalRecipients,
        createdById: user.id,
        variableMappings: hasMappings
          ? (variableMappings as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    })

    // Recipients are written separately and in batches. As a nested `create`
    // they were one statement carrying every row of the list.
    let insertedCount: number
    try {
      insertedCount =
        recipientsSource === 'list' && listId
          ? await insertRecipientsFromList(
              campaign.id,
              listId,
              variableMappings,
              discountCodes,
            )
          : await insertRecipients(campaign.id, recipientsList)
    } catch (error) {
      // A campaign with no recipients is unusable and would sit in the list
      // looking like a successful draft, so undo what the nested write used to
      // make atomic.
      await prisma.emailCampaign.delete({ where: { id: campaign.id } }).catch(() => {})
      throw error
    }

    if (insertedCount === 0) {
      // Everyone matched by the count left before the read reached them.
      await prisma.emailCampaign.delete({ where: { id: campaign.id } }).catch(() => {})
      return { error: 'No valid recipients found', parseErrors }
    }

    if (insertedCount !== totalRecipients) {
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { totalRecipients: insertedCount },
      })
    }
    
    revalidatePath('/admin/email-campaigns')
    
    return {
      success: true,
      campaignId: campaign.id,
      recipientsCount: insertedCount,
      parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
    }
  } catch (error) {
    console.error('Error creating campaign:', error)
    return { error: 'Failed to create campaign' }
  }
}

export async function launchCampaign(campaignId: string) {
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }

  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign) {
      return { error: 'Campaign not found' }
    }

    if (campaign.status !== 'DRAFT') {
      return { error: 'Campaign must be in DRAFT status to launch' }
    }

    // Recipients are materialised in batches, so a create that was killed
    // part-way — a timeout, a deployment, a crash — can leave a draft holding
    // only the batches that landed while `totalRecipients` still advertises the
    // whole list. Nothing else in the app adds or removes recipient rows, so a
    // short count is proof of that, and launching anyway would quietly send to
    // a partial audience and report it as a complete run.
    const materialised = await prisma.emailRecipient.count({ where: { campaignId } })
    if (materialised !== campaign.totalRecipients) {
      return {
        error:
          `Campaign is incomplete: ${materialised} of ${campaign.totalRecipients} recipients were saved. ` +
          'Delete it and create it again before launching.',
      }
    }

    // Recover any recipients left mid-flight by a previously interrupted run.
    await prisma.emailRecipient.updateMany({
      where: { campaignId, status: 'SENDING' },
      data: { status: 'PENDING' },
    })

    // Mark SENDING up front so the UI reflects it immediately…
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'SENDING', startedAt: campaign.startedAt ?? new Date() },
    })

    // …then start the self-continuing send chain (drains the whole list).
    await triggerCampaignContinuation(campaignId)

    revalidatePath('/admin/email-campaigns')
    revalidatePath(`/admin/email-campaigns/${campaignId}`)

    return { success: true }
  } catch (error) {
    console.error('Error launching campaign:', error)
    return { error: 'Failed to launch campaign' }
  }
}

export async function resumeCampaign(campaignId: string) {
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }

  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign) {
      return { error: 'Campaign not found' }
    }

    if (campaign.status !== 'PAUSED') {
      return { error: 'Campaign must be PAUSED to resume' }
    }

    // Recover any recipients left mid-flight before pausing.
    await prisma.emailRecipient.updateMany({
      where: { campaignId, status: 'SENDING' },
      data: { status: 'PENDING' },
    })

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'SENDING' },
    })

    // Restart the self-continuing send chain.
    await triggerCampaignContinuation(campaignId)

    revalidatePath('/admin/email-campaigns')
    revalidatePath(`/admin/email-campaigns/${campaignId}`)

    return { success: true }
  } catch (error) {
    console.error('Error resuming campaign:', error)
    return { error: 'Failed to resume campaign' }
  }
}

export async function cancelCampaign(campaignId: string) {
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }

  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
    })

    if (!campaign) {
      return { error: 'Campaign not found' }
    }

    if (!['SENDING', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
      return { error: 'Campaign must be SENDING, PAUSED, or SCHEDULED to cancel' }
    }

    // Mark unsent recipients as failed
    await prisma.emailRecipient.updateMany({
      where: {
        campaignId,
        status: { in: ['PENDING', 'SENDING'] },
      },
      data: {
        status: 'FAILED',
        errorMessage: 'Campaign cancelled',
        failedAt: new Date(),
      },
    })

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    })

    revalidatePath('/admin/email-campaigns')
    revalidatePath(`/admin/email-campaigns/${campaignId}`)

    return { success: true }
  } catch (error) {
    console.error('Error cancelling campaign:', error)
    return { error: 'Failed to cancel campaign' }
  }
}

export async function deleteCampaign(campaignId: string) {
  const user = await getCurrentUser()
  
  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }
  
  try {
    await prisma.emailCampaign.delete({
      where: { id: campaignId },
    })
    
    revalidatePath('/admin/email-campaigns')
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return { error: 'Failed to delete campaign' }
  }
}

export async function pauseCampaign(campaignId: string) {
  const user = await getCurrentUser()
  
  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }
  
  try {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    })
    
    revalidatePath('/admin/email-campaigns')
    revalidatePath(`/admin/email-campaigns/${campaignId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Error pausing campaign:', error)
    return { error: 'Failed to pause campaign' }
  }
}

export async function getCampaignStats(campaignId: string) {
  const user = await getCurrentUser()
  
  if (!user || !(await hasAnyPermission(user, ['content:read']))) {
    return { error: 'Unauthorized' }
  }
  
  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      include: {
        template: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            recipients: true,
          },
        },
      },
    })
    
    if (!campaign) {
      return { error: 'Campaign not found' }
    }
    
    const statusCounts = await prisma.emailRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    })
    
    return {
      success: true,
      campaign,
      statusCounts: statusCounts.reduce((acc, curr) => {
        acc[curr.status] = curr._count
        return acc
      }, {} as Record<string, number>),
    }
  } catch (error) {
    console.error('Error getting campaign stats:', error)
    return { error: 'Failed to get campaign stats' }
  }
}

export interface PreviewSubscriber {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  customFields: Record<string, unknown> | null
}

export interface PreviewActiveDiscount {
  id: string
  code: string
  description: string | null
}

const MAX_PREVIEW_SUBSCRIBERS = 25

/**
 * Sample subscribers from a mailing list (or recent subscribers if no list is
 * given) plus all active discount codes — used by the campaign live-preview
 * panel to render the template against real data.
 */
export async function getPreviewSampleData(listId: string | null): Promise<{
  subscribers: PreviewSubscriber[]
  discountCodes: PreviewActiveDiscount[]
}> {
  const user = await getCurrentUser()
  if (!user || !(await hasAnyPermission(user, ['content:read', 'content:write']))) {
    return { subscribers: [], discountCodes: [] }
  }

  const where = {
    status: 'SUBSCRIBED' as const,
    ...(listId ? { listId } : {}),
  }

  const [subscribers, discountCodes] = await Promise.all([
    prisma.mailingListSubscriber.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: MAX_PREVIEW_SUBSCRIBERS,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        customFields: true,
      },
    }),
    prisma.discountCode.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, description: true },
    }),
  ])

  return {
    subscribers: subscribers.map((s) => ({
      id: s.id,
      email: s.email,
      firstName: s.firstName,
      lastName: s.lastName,
      phone: s.phone,
      customFields: (s.customFields as Record<string, unknown> | null) ?? null,
    })),
    discountCodes,
  }
}
