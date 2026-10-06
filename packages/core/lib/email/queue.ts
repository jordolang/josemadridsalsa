/**
 * Email Campaign Queue
 * Database-backed job queue for reliable bulk email sending.
 *
 * Serverless-safe design: a single invocation sends for a bounded time budget
 * (well under the function's maxDuration), then hands off to a fresh invocation
 * via /api/internal/campaigns/continue. This "chains" until every recipient is
 * drained — so a campaign finishes no matter how large the list, and never
 * depends on the original request staying alive (which Vercel freezes the moment
 * the HTTP response returns).
 */
import { prisma } from '@/lib/prisma'
import { sendEmail, substituteVariables } from './sender'
import { checkSuppression } from './suppression'

// Time a single invocation spends sending before handing off. Kept well under
// the 60s route maxDuration so the handoff always fires.
const DEFAULT_CHUNK_BUDGET_MS = Number(process.env.EMAIL_CHUNK_BUDGET_MS) || 45_000
// Delay between individual sends. ~1.8/s stays under Resend's default 2 req/s
// limit; raise EMAIL_SEND_DELAY_MS if your Resend plan allows a higher rate.
const DEFAULT_SEND_DELAY_MS = Number(process.env.EMAIL_SEND_DELAY_MS) || 550

export interface ProcessCampaignOptions {
  campaignId: string
  /** Stop after this many ms and leave the rest PENDING for the next invocation. */
  timeBudgetMs?: number
  sendDelayMs?: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Absolute base URL for self-invocation (production domain, or the Vercel URL). */
function getBaseUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL
  if (explicit) return explicit.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return null
}

/**
 * Kick a fresh invocation to keep draining the campaign. Because this is a new
 * HTTP request, its work is not tied to the caller's (frozen) lifecycle.
 * Falls back to inline processing when there is no reachable base URL (e.g.
 * local scripts) — safe there because non-serverless processes aren't frozen.
 */
export async function triggerCampaignContinuation(campaignId: string): Promise<void> {
  const base = getBaseUrl()
  if (!base) {
    // No self-URL available: run to completion inline (unbounded budget).
    await processCampaign({ campaignId, timeBudgetMs: Number.MAX_SAFE_INTEGER })
    return
  }

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (process.env.CRON_SECRET) headers.authorization = `Bearer ${process.env.CRON_SECRET}`

  try {
    await fetch(`${base}/api/internal/campaigns/continue`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ campaignId }),
    })
  } catch (err) {
    console.error(`[campaign ${campaignId}] continuation trigger failed:`, err)
  }
}

/**
 * Run one bounded chunk of a campaign, then trigger the next chunk if work
 * remains. This is the unit the /continue route and cron invoke.
 */
export async function runCampaignChunkAndContinue(campaignId: string): Promise<void> {
  await processCampaign({ campaignId })

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  })
  if (campaign?.status !== 'SENDING') return

  const remaining = await prisma.emailRecipient.count({
    where: { campaignId, status: { in: ['PENDING', 'SENDING'] } },
  })
  if (remaining > 0) await triggerCampaignContinuation(campaignId)
}

/**
 * Process a campaign: claim PENDING recipients one at a time (atomically, so
 * concurrent workers never double-send), send with rate-limit pacing, apply
 * retry logic, and finalize when the list is fully drained. Returns as soon as
 * the time budget is exhausted, leaving the remainder PENDING.
 */
export async function processCampaign({
  campaignId,
  timeBudgetMs = DEFAULT_CHUNK_BUDGET_MS,
  sendDelayMs = DEFAULT_SEND_DELAY_MS,
}: ProcessCampaignOptions): Promise<void> {
  const startedAtMs = Date.now()

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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? ''
  const fromEmail =
    campaign.fromEmail ??
    process.env.FROM_EMAIL ??
    process.env.NEXT_PUBLIC_FROM_EMAIL ??
    'noreply@example.com'
  const fromName = campaign.fromName ?? 'Jose Madrid Salsa'

  while (Date.now() - startedAtMs < timeBudgetMs) {
    // Honor pause/cancel promptly.
    const fresh = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    })
    if (fresh?.status === 'PAUSED' || fresh?.status === 'CANCELLED') return

    // Grab the next pending recipient…
    const recipient = await prisma.emailRecipient.findFirst({
      where: { campaignId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    })
    if (!recipient) break

    // …and claim it atomically. count===0 means another worker took it first.
    const claim = await prisma.emailRecipient.updateMany({
      where: { id: recipient.id, status: 'PENDING' },
      data: { status: 'SENDING' },
    })
    if (claim.count === 0) continue

    // Suppression check
    if (await checkSuppression(recipient.email)) {
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

    // Variable substitution
    const variables: Record<string, string> = {
      firstName: recipient.name?.split(' ')[0] ?? '',
      lastName: recipient.name?.split(' ').slice(1).join(' ') ?? '',
      email: recipient.email,
      ...((recipient.variables as Record<string, string>) ?? {}),
    }

    const html = substituteVariables(campaign.template.html, variables)
    const subject = substituteVariables(campaign.subject, variables)

    // Open tracking pixel
    const trackedHtml = campaign.trackOpens
      ? html +
        `<img src="${baseUrl}/api/track/open/${recipient.id}" width="1" height="1" style="display:none" alt="" />`
      : html

    // Click tracking
    const finalHtml = campaign.trackClicks
      ? trackedHtml.replace(
          /href="(https?:\/\/[^"]+)"/g,
          (_match, url) =>
            `href="${baseUrl}/api/track/click/${recipient.id}?url=${encodeURIComponent(url)}"`,
        )
      : trackedHtml

    const result = await sendEmail(
      {
        to: recipient.email,
        subject,
        html: finalHtml,
        from: `${fromName} <${fromEmail}>`,
        skipLog: true,
      },
      campaign.configId ?? undefined,
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
        // Back to PENDING for a later retry.
        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: { status: 'PENDING', errorMessage: result.error, retryCount: newRetryCount },
        })
      }
    }

    // Pace to respect the provider rate limit.
    if (sendDelayMs > 0) await sleep(sendDelayMs)
  }

  await finalizeIfComplete(campaignId)
}

/** Mark the campaign SENT and write stats once no recipients remain in flight. */
async function finalizeIfComplete(campaignId: string): Promise<void> {
  const remaining = await prisma.emailRecipient.count({
    where: { campaignId, status: { in: ['PENDING', 'SENDING'] } },
  })
  if (remaining > 0) return

  const status = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  })
  if (status?.status !== 'SENDING') return

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
