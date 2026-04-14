export type { ResendTemplateDefinition, ResendTemplateVariable } from './types'

export { orderConfirmation } from './order-confirmation'
export { shippingNotification } from './shipping-notification'
export { deliveryConfirmation } from './delivery-confirmation'
export { contactForm } from './contact-form'
export { campaignLaunch } from './campaign-launch'
export { campaignSummary } from './campaign-summary'
export { participantWelcome } from './participant-welcome'
export { participantMilestone } from './participant-milestone'

/* Convenience: all templates as a flat array for sync scripts. */

import { orderConfirmation } from './order-confirmation'
import { shippingNotification } from './shipping-notification'
import { deliveryConfirmation } from './delivery-confirmation'
import { contactForm } from './contact-form'
import { campaignLaunch } from './campaign-launch'
import { campaignSummary } from './campaign-summary'
import { participantWelcome } from './participant-welcome'
import { participantMilestone } from './participant-milestone'
import type { ResendTemplateDefinition } from './types'

export const allTemplates: ReadonlyArray<ResendTemplateDefinition> = [
  orderConfirmation,
  shippingNotification,
  deliveryConfirmation,
  contactForm,
  campaignLaunch,
  campaignSummary,
  participantWelcome,
  participantMilestone,
]

/**
 * Look up a template definition by its alias.
 * Returns undefined if no match.
 */
export function getTemplateByAlias(
  alias: string,
): ResendTemplateDefinition | undefined {
  return allTemplates.find((t) => t.alias === alias)
}
