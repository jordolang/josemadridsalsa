/**
 * The two moments in a campaign's life that nobody was being told about.
 *
 * `sendCampaignLaunchEmail` and `sendCampaignSummaryEmail` were both written, both correct, and
 * neither had a caller. A coordinator set a fundraiser up and heard nothing when it went live,
 * and heard nothing when it finished — including the totals, which is the one thing they need
 * in order to hand money to a school.
 *
 * This is a sweep rather than a consumer of domain events because **one of the two facts has no
 * actor**. A campaign ending is simply a date passing: no route runs, no request is made, and
 * nothing would ever emit an event for it. Since the sweep has to exist for that, the launch
 * announcement rides along instead of being wired separately into the admin route.
 */
import { prisma } from '@/lib/prisma'
import { sendCampaignLaunchEmail, sendCampaignSummaryEmail } from '@/lib/email/automation'

/** How many campaigns one tick will handle, so a backlog cannot stall the cron. */
const SWEEP_LIMIT = 50

/**
 * How recently a campaign must have finished for its closing summary to still be worth sending.
 *
 * This is a correctness guard, not a preference. The sent-markers are backfilled by migration,
 * but `vercel-build` wraps `prisma migrate deploy` in a warning rather than a failure — a deploy
 * where the backfill did not apply would otherwise mail a closing summary to every coordinator
 * whose campaign ever finished. Relying on a data backfill for that is relying on a step that
 * can silently be skipped; a window cannot be skipped.
 *
 * It is also just true on its own terms: nobody needs a summary of a fundraiser that closed last
 * spring, and receiving one reads as a system malfunction rather than a service.
 */
const SUMMARY_WINDOW_DAYS = 30

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'https://www.josemadrid.net'

export interface LifecycleResult {
  launched: number
  ended: number
  summarised: number
}

function formatDate(value: Date): string {
  return value.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/**
 * Announce campaigns that are live and have not been announced.
 *
 * Gated on `startDate` as well as status so a campaign staged in advance — set up in June to
 * run in September — is announced when it actually opens rather than the moment an admin saves
 * it.
 *
 * Unlike the domain-event handlers, idempotency here rests on timing rather than a constraint:
 * the marker is read and written in separate statements with no unique index behind it, so two
 * overlapping runs — a manual trigger during the scheduled one — could both see a null marker
 * and both send. At a daily cadence that is close to unreachable and costs one duplicate email,
 * which is why it is documented rather than locked. Do not raise the frequency without adding a
 * conditional update.
 */
export async function announceLaunchedCampaigns(now: Date): Promise<number> {
  const due = await prisma.fundraiser.findMany({
    where: { status: 'ACTIVE', launchEmailSentAt: null, startDate: { lte: now } },
    orderBy: { startDate: 'asc' },
    take: SWEEP_LIMIT,
  })

  let sent = 0

  for (const fundraiser of due) {
    try {
      await sendCampaignLaunchEmail({
        email: fundraiser.contactEmail,
        // There is no coordinator-name column; the organisation is the contact point, which is
        // the same choice the closing summary makes.
        coordinatorName: fundraiser.organizationName,
        campaignName: fundraiser.name,
        organizationName: fundraiser.organizationName,
        campaignUrl: `${appUrl}/fundraisers/${fundraiser.slug}`,
        startDate: formatDate(fundraiser.startDate),
        endDate: formatDate(fundraiser.endDate),
        goalAmount: fundraiser.goal ? `$${Number(fundraiser.goal).toFixed(2)}` : undefined,
      })

      // Stamped after the send, so a failure retries next tick rather than going silent.
      await prisma.fundraiser.update({
        where: { id: fundraiser.id },
        data: { launchEmailSentAt: new Date() },
      })
      sent++
    } catch (error) {
      console.warn('[fundraiser-lifecycle] Launch email failed', { id: fundraiser.id, error })
    }
  }

  return sent
}

/**
 * Close campaigns whose end date has passed.
 *
 * Only the status moves here. The summary is sent by the next step, keyed off its own marker,
 * so a campaign that was ended by hand in the admin still gets its closing email.
 */
export async function endExpiredCampaigns(now: Date): Promise<number> {
  const { count } = await prisma.fundraiser.updateMany({
    where: { status: 'ACTIVE', endDate: { lt: now } },
    data: { status: 'ENDED', isActive: false },
  })
  return count
}

/**
 * Send the closing summary for campaigns that have ended recently and not had one.
 *
 * The recency window is what makes this safe independently of the backfill migration — see
 * `SUMMARY_WINDOW_DAYS`. Both guards are deliberate: the marker stops a repeat, the window stops
 * a first send for ancient history.
 */
export async function summariseEndedCampaigns(now: Date = new Date()): Promise<number> {
  const windowStart = new Date(now.getTime() - SUMMARY_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const due = await prisma.fundraiser.findMany({
    where: {
      status: 'ENDED',
      summaryEmailSentAt: null,
      endDate: { gte: windowStart },
    },
    select: { id: true },
    orderBy: { endDate: 'asc' },
    take: SWEEP_LIMIT,
  })

  let sent = 0

  for (const { id } of due) {
    try {
      const result = await sendCampaignSummaryEmail(id)

      // The sender reports failure by return value rather than throwing. Stamping regardless
      // would bury a campaign whose coordinator email is missing; leaving it unstamped retries
      // it, and the same missing address then shows up every tick, which is the visible failure.
      if (result && result.success === false) {
        console.warn('[fundraiser-lifecycle] Summary not sent', { id, error: result.error })
        continue
      }

      await prisma.fundraiser.update({
        where: { id },
        data: { summaryEmailSentAt: new Date() },
      })
      sent++
    } catch (error) {
      console.warn('[fundraiser-lifecycle] Summary email failed', { id, error })
    }
  }

  return sent
}

/**
 * Run the whole sweep.
 *
 * Ending runs before summarising so a campaign that expires on this tick is also summarised on
 * this tick, rather than waiting a further day.
 */
export async function runFundraiserLifecycle(now: Date = new Date()): Promise<LifecycleResult> {
  const launched = await announceLaunchedCampaigns(now)
  const ended = await endExpiredCampaigns(now)
  const summarised = await summariseEndedCampaigns(now)

  return { launched, ended, summarised }
}
