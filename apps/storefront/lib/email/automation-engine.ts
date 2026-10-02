/**
 * Automation Engine
 * Processes due automation enrollment steps and sends emails
 */
import { prisma } from '@/lib/prisma'
import { PAID_PAYMENT_STATUSES } from '@/lib/payments/status'
import { sendEmail, substituteVariables } from './sender'
import { checkSuppression } from './suppression'
import { checkUnsubscribed } from './logger'
import { buildOneClickUnsubscribeUrl, buildUnsubscribeUrl } from './unsubscribe-url'

export type AutomationTriggerType =
  | 'USER_REGISTERED'
  | 'ORDER_PLACED'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_REFUNDED'
  | 'ABANDONED_CART'
  | 'LOYALTY_POINTS_EARNED'
  | 'LOYALTY_TIER_UPGRADE'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_CANCELLED'
  | 'BIRTHDAY'
  | 'ANNIVERSARY'
  | 'REENGAGEMENT'
  | 'LOW_STOCK'
  | 'CUSTOM'

/**
 * Enroll a user in an automation when a trigger fires.
 *
 * `dedupeKey` names the fact that caused the enrollment (`payment.completed:<orderId>`,
 * `BIRTHDAY:2026`). A second enrollment carrying the same key is skipped whatever the earlier
 * one's status, so the same fact arriving twice — the checkout route and the Stripe webhook both
 * record a payment, a cron re-scans the same birthday every tick — cannot restart a series that
 * has already run. Without a key only an ACTIVE enrollment blocks re-entry.
 */
export async function enrollInAutomation(
  trigger: AutomationTriggerType,
  rawEmail: string,
  triggerData?: Record<string, unknown>,
  dedupeKey?: string
): Promise<void> {
  // The unique key is (automationId, email), so `Buyer@x.com` and `buyer@x.com` must be one row.
  const email = rawEmail.trim().toLowerCase()
  const data = dedupeKey ? { ...triggerData, dedupeKey } : triggerData

  // Find all active automations for this trigger
  const automations = await prisma.emailAutomation.findMany({
    where: { trigger: trigger as never, isActive: true },
    include: { steps: { orderBy: { order: 'asc' } } },
  })

  for (const automation of automations) {
    if (automation.steps.length === 0) continue

    // Check if already enrolled
    const existing = await prisma.automationEnrollment.findUnique({
      where: { automationId_email: { automationId: automation.id, email } },
    })

    if (existing && existing.status === 'ACTIVE') continue // Already enrolled
    if (dedupeKey && existing && readDedupeKey(existing.triggerData) === dedupeKey) continue

    const firstStep = automation.steps[0]
    const nextStepAt = new Date()
    nextStepAt.setHours(nextStepAt.getHours() + (firstStep.delayHours ?? 0))

    await prisma.automationEnrollment.upsert({
      where: { automationId_email: { automationId: automation.id, email } },
      create: {
        automationId: automation.id,
        email,
        currentStep: 0,
        status: 'ACTIVE',
        triggerData: data as never,
        nextStepAt,
      },
      update: {
        currentStep: 0,
        status: 'ACTIVE',
        triggerData: data as never,
        nextStepAt,
        // Reset so the purchase stop condition measures from this run, not the first one.
        enrolledAt: new Date(),
        completedAt: null,
      },
    })
  }
}

function readDedupeKey(triggerData: unknown): string | null {
  if (!triggerData || typeof triggerData !== 'object' || Array.isArray(triggerData)) return null
  const value = (triggerData as Record<string, unknown>).dedupeKey
  return typeof value === 'string' ? value : null
}

/**
 * Whether this address may receive an automation email.
 *
 * Always checked, not only when the builder's "stop on unsubscribe" switch is on: the suppression
 * list holds hard bounces and spam complaints, and mailing those is never an admin's choice.
 * Automation series are marketing, so a `marketing` category opt-out applies to all of them;
 * a series that has its own category (the unsubscribe form's `reengagement`, the built-in cart
 * sequence's `abandoned_cart`) honours that one too.
 */
const EXTRA_OPT_OUT_CATEGORY: Partial<Record<string, string>> = {
  REENGAGEMENT: 'reengagement',
  ABANDONED_CART: 'abandoned_cart',
}

async function isOptedOut(email: string, trigger: string): Promise<boolean> {
  if (await checkSuppression(email)) return true
  const extra = EXTRA_OPT_OUT_CATEGORY[trigger]
  const category = extra ? ['marketing', extra] : ['marketing']
  return checkUnsubscribed({ email: email.trim().toLowerCase(), category })
}

/** Has this address paid for an order since the enrollment started? */
async function hasPurchasedSince(email: string, since: Date): Promise<boolean> {
  const order = await prisma.order.findFirst({
    where: {
      paymentStatus: { in: PAID_PAYMENT_STATUSES },
      createdAt: { gt: since },
      OR: [
        { guestEmail: { equals: email, mode: 'insensitive' } },
        { user: { email: { equals: email, mode: 'insensitive' } } },
      ],
    },
    select: { id: true },
  })
  return order !== null
}

/**
 * Make sure a rendered automation email carries a working unsubscribe link.
 *
 * Templates built on the shared footer already print `{{UNSUBSCRIBE_URL}}`, which the caller
 * fills in; anything else gets a plain footer appended rather than going out with no way out.
 */
export function withUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  if (html.includes(unsubscribeUrl)) return html
  const footer =
    `<p style="margin:24px 0 0;font-size:12px;color:#6b7280;text-align:center;">` +
    `Don't want these emails? <a href="${unsubscribeUrl}" style="color:#6b7280;">Unsubscribe</a></p>`
  return html.includes('</body>') ? html.replace('</body>', `${footer}</body>`) : html + footer
}

/**
 * Process all due automation steps - called by cron job
 */
export async function processDueAutomationSteps(): Promise<{
  processed: number
  errors: number
}> {
  const now = new Date()
  let processed = 0
  let errors = 0

  // Find enrollments due for their next step
  const dueEnrollments = await prisma.automationEnrollment.findMany({
    where: {
      status: 'ACTIVE',
      nextStepAt: { lte: now },
    },
    include: {
      automation: {
        include: { steps: { orderBy: { order: 'asc' } } },
      },
    },
    take: 100,
  })

  for (const enrollment of dueEnrollments) {
    try {
      const { automation, email, currentStep } = enrollment
      const step = automation.steps[currentStep]

      if (!step) {
        // No more steps - complete enrollment
        await prisma.automationEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'COMPLETED', completedAt: now },
        })
        continue
      }

      // Stop conditions. Suppression is checked for every send; see `isOptedOut`.
      const stopConditions = automation.stopConditions as Record<string, boolean> | null
      if (await isOptedOut(email, automation.trigger)) {
        await prisma.automationEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'UNSUBSCRIBED' },
        })
        await prisma.automationLog.create({
          data: {
            automationId: automation.id,
            enrollmentId: enrollment.id,
            recipientEmail: email,
            stepIndex: currentStep,
            status: 'SKIPPED',
            triggeredAt: now,
          },
        })
        continue
      }

      // "Stop on purchase": the series exists to get a sale, so a sale ends it.
      if (stopConditions?.onPurchase && (await hasPurchasedSince(email, enrollment.enrolledAt))) {
        await prisma.automationEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'CANCELLED', completedAt: now },
        })
        continue
      }

      // Send email for this step
      if (step.templateId) {
        const template = await prisma.emailTemplate.findUnique({
          where: { id: step.templateId },
        })

        if (template) {
          const unsubscribeUrl = buildUnsubscribeUrl(email)
          const variables = {
            firstName: '',
            email,
            ...((enrollment.triggerData as Record<string, string>) ?? {}),
            // After the trigger data so nothing in a payload can replace the opt-out link.
            UNSUBSCRIBE_URL: unsubscribeUrl,
            unsubscribe_url: unsubscribeUrl,
          }

          const html = withUnsubscribeFooter(
            substituteVariables(template.html, variables),
            unsubscribeUrl
          )
          const subject = step.subject
            ? substituteVariables(step.subject, variables)
            : substituteVariables(template.subject, variables)

          const result = await sendEmail({
            to: email,
            subject,
            html,
            headers: {
              'List-Unsubscribe': `<${buildOneClickUnsubscribeUrl(email)}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          })

          await prisma.automationLog.create({
            data: {
              automationId: automation.id,
              enrollmentId: enrollment.id,
              recipientEmail: email,
              stepIndex: currentStep,
              status: result.success ? 'SENT' : 'FAILED',
              triggeredAt: now,
              sentAt: result.success ? now : undefined,
              errorMessage: result.error,
            },
          })

          if (!result.success) {
            errors++
          } else {
            processed++
          }
        }
      }

      // Advance to next step
      const nextStepIndex = currentStep + 1
      const nextStep = automation.steps[nextStepIndex]

      if (nextStep) {
        const nextStepAt = new Date()
        nextStepAt.setHours(nextStepAt.getHours() + (nextStep.delayHours ?? 0))
        await prisma.automationEnrollment.update({
          where: { id: enrollment.id },
          data: { currentStep: nextStepIndex, nextStepAt },
        })
      } else {
        // Last step - mark complete
        await prisma.automationEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'COMPLETED', completedAt: now },
        })
      }
    } catch (err) {
      console.error(`Automation enrollment ${enrollment.id} error:`, err)
      errors++
    }
  }

  return { processed, errors }
}
