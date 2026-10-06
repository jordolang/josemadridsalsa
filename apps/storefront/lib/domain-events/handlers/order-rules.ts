/**
 * Domain events → the admin's own notification rules.
 *
 * Evaluates every active `OrderNotificationRule` against the fact that just happened and routes
 * matches to the addresses and Slack webhooks the rule names. The model has been in the schema
 * with no code reading it at all, so the admin could describe routing that never occurred.
 */
import type { OrderNotificationEvent } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import {
  RULE_EVENT_BY_DOMAIN_EVENT,
  postToSlack,
  ruleMatches,
  ruleMessage,
} from '@/lib/notifications/order-rules'
import type { RuleOrderContext } from '@/lib/notifications/order-rules'

import { registerDomainEventHandler } from '../subscribe'
import type { DomainEventRecord } from '../subscribe'
import type { DomainEventType } from '@/lib/domain-events/types'
import { SITE_URL } from '@/lib/site-url'

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? SITE_URL

/**
 * Route one fact through the configured rules.
 *
 * Not idempotent, and cannot easily be: a rule is an arbitrary recipient list with no row to
 * stamp, so there is nowhere to record "already told this address". A replayed event therefore
 * repeats these messages. That is acceptable here in a way it would not be for a customer
 * email — these go to staff, they are operational rather than transactional, and a replay only
 * happens when a handler crashed mid-batch.
 */
export async function handleOrderRules(event: DomainEventRecord): Promise<void> {
  const triggers = RULE_EVENT_BY_DOMAIN_EVENT[event.type as DomainEventType]
  if (!triggers || triggers.length === 0) return

  // Cheapest possible exit: almost every shop has no rules at all, and this runs on every paid
  // order. Checking before loading the order keeps the common case to one indexed count.
  const activeRules = await prisma.orderNotificationRule.findMany({
    where: { isActive: true, triggerEvent: { in: triggers } },
  })

  if (activeRules.length === 0) return

  const order = await prisma.order.findUnique({
    where: { id: event.entityId },
    select: { orderNumber: true, status: true, total: true },
  })

  if (!order) return

  const context: RuleOrderContext = {
    orderNumber: order.orderNumber,
    status: order.status,
    total: Number(order.total),
  }

  for (const rule of activeRules) {
    if (!ruleMatches(rule, context)) continue

    const message = ruleMessage(rule.triggerEvent as OrderNotificationEvent, context, appUrl)

    if (rule.emailEnabled && rule.emailTo.length > 0) {
      for (const recipient of rule.emailTo) {
        try {
          await sendEmail({
            to: recipient,
            subject: message.subject,
            html: message.html,
          })
        } catch (error) {
          // One bad address must not cost the other recipients, or the Slack half of this rule.
          console.warn('[order-rules] Rule email failed', { rule: rule.name, recipient, error })
        }
      }
    }

    if (rule.slackEnabled && rule.slackWebhook) {
      await postToSlack(rule.slackWebhook, message.text)
    }
  }
}

/** Subscribe to every fact any rule can be configured against. */
export function registerOrderRuleHandlers(): void {
  for (const type of Object.keys(RULE_EVENT_BY_DOMAIN_EVENT) as DomainEventType[]) {
    registerDomainEventHandler(type, 'order-rules', handleOrderRules)
  }
}
