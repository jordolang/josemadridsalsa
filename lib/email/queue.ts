/**
 * Email Campaign Queue
 * Database-backed job queue for reliable bulk email sending
 */
import { prisma } from '@/lib/prisma'
import { sendEmail, substituteVariables } from './sender'
import { checkSuppression } from './suppression'

const DEFAULT_BATCH_SIZE = 50
const DEFAULT_BATCH_DELAY_MS = 1000

export interface ProcessCampaignOptions {
  campaignId: string
  batchSize?: number
  batchDelayMs?: number
}

/**
 * Process a campaign: fetches PENDING recipients in batches, sends emails,
 * updates statuses, applies retry logic
 */
export async function processCampaign({
  campaignId,
  batchSize = DEFAULT_BATCH_SIZE,
  batchDelayMs = DEFAULT_BATCH_DELAY_MS,
}: ProcessCampaignOptions): Promise<void> {
  // Load campaign with template
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  })

  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)
  if (campaign.status === 'CANCELLED') return
  if (!['DRAFT', 'SENDING', 'SCHEDULED', 'PAUSED'].includes(campaign.status)) return

  // Mark as SENDING
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING', startedAt: campaign.startedAt ?? new Date() },
  })

  let hasMore = true

  while (hasMore) {
    // Check if campaign was paused or cancelled
    const freshCampaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    })
    if (freshCampaign?.status === 'PAUSED' || freshCampaign?.status === 'CANCELLED') break

    // Fetch next batch of PENDING recipients
    const recipients = await prisma.emailRecipient.findMany({
      where: { campaignId, status: 'PENDING' },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    })

    if (recipients.length === 0) {
      hasMore = false
      break
    }

    // Mark batch as SENDING
    await prisma.emailRecipient.updateMany({
      where: { id: { in: recipients.map((r) => r.id) } },
      data: { status: 'SENDING' },
    })

    // Send each email in the batch
    for (const recipient of recipients) {
      // Check suppression
      const suppressed = await checkSuppression(recipient.email)
      if (suppressed) {
        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: { status: 'FAILED', errorMessage: 'Email suppressed', failedAt: new Date() },
        })
        await prisma.emailCampaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        })
        continue
      }

      // Build HTML with variable substitution
      const variables: Record<string, string> = {
        firstName: recipient.name?.split(' ')[0] ?? '',
        lastName: recipient.name?.split(' ').slice(1).join(' ') ?? '',
        email: recipient.email,
        ...((recipient.variables as Record<string, string>) ?? {}),
      }

      const html = substituteVariables(campaign.template.html, variables)
      const subject = substituteVariables(campaign.subject, variables)
      const fromEmail = campaign.fromEmail ?? process.env.FROM_EMAIL ?? process.env.NEXT_PUBLIC_FROM_EMAIL ?? 'noreply@example.com'
      const fromName = campaign.fromName ?? 'Jose Madrid Salsa'

      // Add open tracking pixel if enabled
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? ''
      const trackedHtml = campaign.trackOpens
        ? html +
          `<img src="${baseUrl}/api/track/open/${recipient.id}" width="1" height="1" style="display:none" alt="" />`
        : html

      // Add click tracking if enabled
      const finalHtml = campaign.trackClicks
        ? trackedHtml.replace(
            /href="(https?:\/\/[^"]+)"/g,
            (_match, url) =>
              `href="${baseUrl}/api/track/click/${recipient.id}?url=${encodeURIComponent(url)}"`
          )
        : trackedHtml

      const result = await sendEmail(
        {
          to: recipient.email,
          subject,
          html: finalHtml,
          from: `${fromName} <${fromEmail}>`,
        },
        campaign.configId ?? undefined
      )

      if (result.success) {
        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: { status: 'SENT', sentAt: new Date() },
        })
        await prisma.emailCampaign.update({
          where: { id: campaignId },
          data: { sentCount: { increment: 1 } },
        })
      } else {
        const maxRetries = campaign.maxRetries ?? 3
        const newRetryCount = (recipient.retryCount ?? 0) + 1

        if (newRetryCount >= maxRetries) {
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'FAILED',
              errorMessage: result.error,
              failedAt: new Date(),
              retryCount: newRetryCount,
            },
          })
          await prisma.emailCampaign.update({
            where: { id: campaignId },
            data: { failedCount: { increment: 1 } },
          })
        } else {
          // Schedule retry
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'PENDING',
              errorMessage: result.error,
              retryCount: newRetryCount,
            },
          })
        }
      }
    }

    // Delay between batches
    if (batchDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, batchDelayMs))
    }
  }

  // Check final status
  const remaining = await prisma.emailRecipient.count({
    where: { campaignId, status: { in: ['PENDING', 'SENDING'] } },
  })

  const finalStatus = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  })

  if (remaining === 0 && finalStatus?.status === 'SENDING') {
    const [sent, failed, bounced] = await Promise.all([
      prisma.emailRecipient.count({ where: { campaignId, status: 'SENT' } }),
      prisma.emailRecipient.count({ where: { campaignId, status: 'FAILED' } }),
      prisma.emailRecipient.count({ where: { campaignId, status: 'BOUNCED' } }),
    ])
    const total = sent + failed + bounced

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'SENT',
        completedAt: new Date(),
        sentCount: sent,
        failedCount: failed,
        bouncedCount: bounced,
      },
    })

    // Upsert campaign stats
    await prisma.emailCampaignStats.upsert({
      where: { campaignId },
      create: {
        campaignId,
        openRate: 0,
        clickRate: 0,
        bounceRate: total > 0 ? bounced / total : 0,
        lastCalculatedAt: new Date(),
      },
      update: {
        bounceRate: total > 0 ? bounced / total : 0,
        lastCalculatedAt: new Date(),
      },
    })
  }
}
