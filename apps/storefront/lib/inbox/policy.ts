/**
 * Whether a proposed reply is actually sent.
 *
 * The classifier proposes; this decides. It is deliberately a separate, dependency-free,
 * fully-tested function rather than a branch inside the sweep, because it is the single
 * point where an automated message becomes a message to a real customer, and that decision
 * should be readable in one screen by someone who does not trust it.
 *
 * Three gates, in order:
 *   1. The operator's kill switch and confidence floor on the connection.
 *   2. Categories that are never answered automatically — the ones Mike named directly:
 *      returns, broken jars, payments, and anything where a wrong answer costs money.
 *   3. The classifier's own judgement that it had the facts.
 */

import type { InboundEmailCategory, InboundEmailStatus } from '@prisma/client'

import type { Classification } from './classifier'

/**
 * Categories a machine never answers unattended, whatever its confidence.
 *
 * Not a hedge against the classifier: these are the cases where the *right* reply commits
 * the business to money or to a remedy, so a person has to be the one committing it.
 */
export const NEVER_AUTO_ANSWER: InboundEmailCategory[] = [
  'RETURN_OR_DAMAGE',
  'PAYMENT_OR_BILLING',
  'WHOLESALE',
]

export interface ReplyDecision {
  /** Send it now, in-thread, from the mailbox. */
  send: boolean
  /** Leave it in Gmail as a draft for a human to read and send. */
  draft: boolean
  /** The resulting status for the email row. */
  status: InboundEmailStatus
  /** Why, in one line, for the alert and the audit trail. */
  reason: string
}

export interface ReplyPolicyInput {
  classification: Classification
  autoReplyEnabled: boolean
  autoReplyMinConfidence: number
}

export function decideReply({
  classification,
  autoReplyEnabled,
  autoReplyMinConfidence,
}: ReplyPolicyInput): ReplyDecision {
  const { category, confidence, canAnswerWithoutHuman, replyBody } = classification

  if (category === 'SPAM_OR_AUTOMATED') {
    return {
      send: false,
      draft: false,
      status: 'IGNORED',
      reason: 'Not a customer contact — no reply and no alert.',
    }
  }

  if (!canAnswerWithoutHuman) {
    return {
      send: false,
      draft: Boolean(replyBody),
      status: replyBody ? 'REPLY_DRAFTED' : 'NEEDS_ACTION',
      reason: replyBody
        ? 'Needs a person. A suggested reply is drafted in Gmail, unsent.'
        : 'Needs a person.',
    }
  }

  if (!replyBody) {
    return {
      send: false,
      draft: false,
      status: 'NEEDS_ACTION',
      reason: 'Judged simple, but no reply was written — escalated rather than sending nothing.',
    }
  }

  if (NEVER_AUTO_ANSWER.includes(category)) {
    return {
      send: false,
      draft: true,
      status: 'REPLY_DRAFTED',
      reason: `${humaniseCategory(category)} is never answered automatically. A reply is drafted in Gmail for you to send.`,
    }
  }

  if (!autoReplyEnabled) {
    return {
      send: false,
      draft: true,
      status: 'REPLY_DRAFTED',
      reason: 'Auto-reply is switched off. A reply is drafted in Gmail for you to send.',
    }
  }

  if (confidence < autoReplyMinConfidence) {
    return {
      send: false,
      draft: true,
      status: 'REPLY_DRAFTED',
      reason: `Confidence ${confidence}% is below the ${autoReplyMinConfidence}% floor. A reply is drafted in Gmail for you to send.`,
    }
  }

  return {
    send: true,
    draft: false,
    status: 'AUTO_ANSWERED',
    reason: `Answered automatically at ${confidence}% confidence.`,
  }
}

/**
 * The steps that will actually be attached to the email.
 *
 * The classifier only writes steps when it thinks a human is needed. That leaves a hole:
 * a reply held back for low confidence, or because its category is never auto-answered,
 * arrives with a Gmail draft and *no* steps — so the alert would clear in one click while
 * the draft sits in Gmail, unsent, forever. An unsent draft is an unanswered customer, so
 * a drafted reply always carries the step that sends it.
 */
export function stepsFor(
  classification: Pick<Classification, 'steps'>,
  decision: Pick<ReplyDecision, 'draft' | 'status'>,
): Array<{ instruction: string; isOptional: boolean }> {
  const steps = classification.steps.map((step) => ({ ...step }))

  if (!decision.draft) return steps

  const sendStep = {
    instruction: 'Read the reply drafted in Gmail, correct it if it needs it, and send it.',
    isOptional: false,
  }

  // Where the classifier already ended on "reply to the customer", that step *is* this one
  // — replace it rather than asking for the same thing twice in different words.
  const last = steps[steps.length - 1]
  if (last && /\breply\b|\brespond\b/i.test(last.instruction)) {
    steps[steps.length - 1] = sendStep
    return steps
  }

  return [...steps, sendStep]
}

export function humaniseCategory(category: InboundEmailCategory): string {
  return category
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(' Or ', ' / ')
}

/**
 * The Gmail label applied to the message, so the mailbox shows the same verdict the admin
 * panel does. Nested under one parent, alongside — never replacing — the daily agent's own
 * filing.
 */
export function gmailLabelFor(status: InboundEmailStatus): string | null {
  switch (status) {
    case 'AUTO_ANSWERED':
      return 'JMS/Answered'
    case 'REPLY_DRAFTED':
      return 'JMS/Reply drafted'
    case 'NEEDS_ACTION':
    case 'IN_PROGRESS':
      return 'JMS/Needs action'
    case 'RESOLVED':
      return 'JMS/Resolved'
    case 'IGNORED':
      return null
  }
}
