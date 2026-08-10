/**
 * The registration point for every domain event consumer.
 *
 * One place to look for "what reacts to what". Anything that subscribes to the bus is
 * registered here, so a new consumer is one line rather than a hunt for where the wiring
 * happens.
 */
import { clearDomainEventHandlers } from '../subscribe'

import { registerAutomationEnrollmentHandlers } from './automation-enrollment'
import { registerOrderConfirmationHandlers } from './order-confirmation'
import { registerOrderNotificationHandlers } from './order-notifications'
import { registerOrderRuleHandlers } from './order-rules'
import { registerParticipantMilestoneHandlers } from './participant-milestone'
import { registerPickupReadyHandlers } from './pickup-ready'
import { registerRefundNotificationHandlers } from './refund-notification'
import { registerRestockAlertHandlers } from './restock-alert'

let registered = false

/**
 * Register all consumers, once.
 *
 * The guard matters: module state survives between invocations on a warm serverless
 * instance, so a route that calls this on every request would otherwise stack a fresh copy
 * of every handler onto the registry each time and send one duplicate email per warm
 * invocation.
 */
export function registerDomainEventConsumers(): void {
  if (registered) return
  registered = true

  registerAutomationEnrollmentHandlers()
  registerOrderConfirmationHandlers()
  registerOrderNotificationHandlers()
  registerPickupReadyHandlers()
  registerParticipantMilestoneHandlers()
  registerRefundNotificationHandlers()
  registerOrderRuleHandlers()
  registerRestockAlertHandlers()
}

/** Reset registration state. For tests, which need to re-register against a clean registry. */
export function resetDomainEventConsumers(): void {
  registered = false
  clearDomainEventHandlers()
}
