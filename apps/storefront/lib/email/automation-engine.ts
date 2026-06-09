/**
 * Automation Engine
 * Processes due automation enrollment steps and sends emails
 */
import { prisma } from '@/lib/prisma'
import { sendEmail, substituteVariables } from './sender'
import { checkSuppression } from './suppression'

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
 * Enroll a user in an automation when a trigger fires
 */
export async function enrollInAutomation(
  trigger: AutomationTriggerType,
  email: string,
  triggerData?: Record<string, unknown>
): Promise<void> {
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
        triggerData: triggerData as never,
        nextStepAt,
      },
      update: {
        currentStep: 0,
        status: 'ACTIVE',
        triggerData: triggerData as never,
        nextStepAt,
        completedAt: null,
      },
    })
  }
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

      // Check stop conditions
      const stopConditions = automation.stopConditions as Record<string, boolean> | null
      if (stopConditions?.onUnsubscribe) {
        const suppressed = await checkSuppression(email)
        if (suppressed) {
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
      }

      // Send email for this step
      if (step.templateId) {
        const template = await prisma.emailTemplate.findUnique({
          where: { id: step.templateId },
        })

        if (template) {
          const variables = {
            firstName: '',
            email,
            ...((enrollment.triggerData as Record<string, string>) ?? {}),
          }

          const html = substituteVariables(template.html, variables)
          const subject = step.subject
            ? substituteVariables(step.subject, variables)
            : substituteVariables(template.subject, variables)

          const result = await sendEmail({
            to: email,
            subject,
            html,
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
