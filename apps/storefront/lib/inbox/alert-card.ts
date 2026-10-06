/**
 * The pieces of a customer-email alert, laid out for the notifications page.
 *
 * The notification row only holds a flattened message, which reads as one run-on paragraph.
 * Every alert this feature raises points back at its `InboundEmail`, so the card is built
 * from that row instead — which also means alerts raised before this layout existed render
 * the same way.
 */

import type { InboundEmail, InboundEmailStep } from '@prisma/client'

import { TRIAGE_FAILED_SUMMARY } from './classifier'
import { gmailThreadUrl } from './gmail'
import { humaniseCategory } from './policy'

export interface EmailAlertStep {
  instruction: string
  isOptional: boolean
  done: boolean
}

export interface EmailAlertDetails {
  /** e.g. "General Question from Deborah K Grose". */
  heading: string
  from: string
  subject: string
  /** What the customer wants, when the model read the email; null when it never did. */
  summary: string | null
  steps: EmailAlertStep[]
  gmailUrl: string
  /** Whether, and how, Anthropic classified the email. */
  classification: string
}

export function emailAlertDetails(
  email: InboundEmail & { steps: InboundEmailStep[] },
): EmailAlertDetails {
  const triageFailed = email.summary === TRIAGE_FAILED_SUMMARY

  let classification: string
  if (triageFailed) classification = 'Anthropic Classification Not Available'
  else if (email.autoReplySent) classification = 'Answered automatically by Anthropic'
  else classification = `Classified by Anthropic (${email.confidence}% confidence)`

  return {
    heading: `${humaniseCategory(email.category)} from ${email.fromName ?? email.fromEmail}`,
    from: email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail,
    subject: email.subject,
    summary: triageFailed ? null : email.summary,
    steps: [...email.steps]
      .sort((a, b) => a.position - b.position)
      .map((step) => ({
        instruction: step.instruction,
        isOptional: step.isOptional,
        done: step.completedAt !== null,
      })),
    gmailUrl: gmailThreadUrl(email.gmailThreadId),
    classification,
  }
}
