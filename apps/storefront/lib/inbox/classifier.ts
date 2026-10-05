/**
 * Deciding what a customer email is, and whether it can be answered without a person.
 *
 * The model is given three things and nothing else: the message, the resolved facts about
 * the sender and their orders (`lib/inbox/context.ts`), and the same site content the
 * storefront assistant answers from (`lib/ai-rag`). It is told in the strongest terms that
 * an answer must come from those, because the failure this whole feature exists to prevent
 * is a customer being told something untrue quickly instead of something true slowly.
 *
 * Its output is a *proposal*. Whether a reply is actually sent is decided by
 * `lib/inbox/policy.ts`, which does not take the model's word for it.
 */

import Anthropic from '@anthropic-ai/sdk'
import { inboxTriageAgent, trackedAnthropic } from '@/lib/analytics/agent-analytics'
import type { InboundEmailCategory, NotificationSeverity } from '@prisma/client'

import { getIndexedContent } from '@/lib/ai-rag/content-cache'
import { formatContextForLLM, searchContent } from '@/lib/ai-rag/retriever'

import type { EmailContext } from './context'

/** How much of a message the model sees. Long threads quote themselves endlessly. */
export const MAX_BODY_CHARS = 6000

export interface ProposedStep {
  instruction: string
  isOptional: boolean
}

export interface Classification {
  category: InboundEmailCategory
  severity: NotificationSeverity
  /** 0–100, the model's confidence in its own reading of the message. */
  confidence: number
  /** One line: what this person actually wants. */
  summary: string
  /** True only when every fact the reply needs was supplied, not inferred. */
  canAnswerWithoutHuman: boolean
  /** The reply itself, always written — sending it is a separate decision. */
  replyBody: string | null
  /** What a human has to do, when a human has to do something. */
  actionSummary: string | null
  steps: ProposedStep[]
}

const CATEGORIES: InboundEmailCategory[] = [
  'ORDER_STATUS',
  'SHIPPING_DELIVERY',
  'RETURN_OR_DAMAGE',
  'PAYMENT_OR_BILLING',
  'FUNDRAISER',
  'WHOLESALE',
  'PRODUCT_QUESTION',
  'GENERAL_QUESTION',
  'SPAM_OR_AUTOMATED',
]

const SEVERITIES: NotificationSeverity[] = ['INFO', 'WARNING', 'CRITICAL']

const SYSTEM_PROMPT = `You triage customer email for Jose Madrid Salsa, a family salsa company in Zanesville, Ohio. You read one message and decide what it is and whether it can be answered without involving Mike or Jordan.

THE ONE RULE THAT OVERRIDES EVERYTHING
You may only set canAnswerWithoutHuman to true when every single fact your reply depends on appears in the CONTEXT or SITE CONTENT below. If you find yourself reaching for a plausible shipping date, an order status you were not given, a refund amount, a policy you were not shown, or anything about an order the sender does not own — that is not a simple question. Set canAnswerWithoutHuman to false. Being slow is recoverable. Being confidently wrong to a customer is not.

ALWAYS requires a human, no matter how clear it looks:
- A return, refund, exchange, or a jar that arrived broken, leaking or short
- Anything about a charge, a card, a failed or duplicate payment, or an invoice dispute
- A delivery that failed, went missing, or is late past its estimate
- Fundraiser logistics: delivery dates, splits, quantities, who owes whom
- Wholesale pricing or terms
- Anger, a threat to dispute a charge, a legal or health complaint
- Any message naming an order number the sender does not own

CAN be answered without a human, when the facts are in front of you:
- Order status, tracking or delivery date for an order listed in CONTEXT
- Heat level, ingredients, allergens, or which salsas exist — from SITE CONTENT
- Where to buy, store hours, store locations — from SITE CONTENT
- How fundraisers work in general, how to start one — from SITE CONTENT
- A thank-you or a compliment needing only a warm, brief acknowledgement

WRITING THE REPLY
Always write replyBody, even when a human must send it — a drafted reply saves them the typing.
- Plain text. No markdown, no headings, no bullet characters.
- Warm and direct, the way a small family business writes. Two short paragraphs at most.
- Sign off exactly: "— Jose Madrid Salsa"
- Never promise a date, a refund, or an outcome you were not given.
- Never mention that you are an automated system, and never apologise for being one.

THE STEPS
When a human is needed, steps are the specific, checkable things that must actually be done before this can be considered handled. Write them as instructions to a person who has not read the email: name the order, the customer and the amount where you know them. "Reply to the customer" is always the last step. Three to six steps is usual. Mark a step optional only when the concern is genuinely addressed without it.`

function buildUserPrompt(params: {
  fromEmail: string
  fromName: string | null
  subject: string
  body: string
  context: EmailContext
  siteContent: string
}): string {
  const { context } = params

  const contextLines: string[] = []

  contextLines.push(
    context.customer
      ? `Known customer: ${context.customer.name ?? '(no name on file)'} <${context.customer.email}> — ${context.customer.totalOrders} order(s) to date, last on ${context.customer.lastOrderAt ?? 'unknown'}.`
      : `This address is not in the customer database. Treat any order claim as unverified.`,
  )

  if (context.orders.length === 0) {
    contextLines.push('Orders belonging to this sender: none found.')
  } else {
    contextLines.push('Orders belonging to this sender (these facts are verified):')
    for (const order of context.orders) {
      contextLines.push(
        `- ${order.orderNumber}: status ${order.status}, payment ${order.paymentStatus}, fulfillment ${order.fulfillmentStatus}, total $${order.total}, placed ${order.placedAt}` +
          `${order.shippedAt ? `, shipped ${order.shippedAt}` : ''}` +
          `${order.deliveredAt ? `, delivered ${order.deliveredAt}` : ''}` +
          `${order.carrierName ? `, carrier ${order.carrierName}` : ''}` +
          `${order.trackingNumber ? `, tracking ${order.trackingNumber}` : ''}` +
          `${order.items.length ? `, items: ${order.items.join(', ')}` : ''}`,
      )
    }
  }

  if (context.referencedForeignOrderNumbers.length > 0) {
    contextLines.push(
      `The message names order number(s) ${context.referencedForeignOrderNumbers.join(', ')}, which this sender does NOT own. Do not answer about them. A human must look.`,
    )
  }

  if (context.fundraiser) {
    contextLines.push(
      `Attached fundraiser: ${context.fundraiser.name} (status ${context.fundraiser.status}, ends ${context.fundraiser.endDate ?? 'unknown'}).`,
    )
  }

  return [
    '--- CONTEXT (verified facts) ---',
    contextLines.join('\n'),
    '',
    '--- SITE CONTENT (the only source for general answers) ---',
    params.siteContent || '(no relevant site content found for this message)',
    '',
    '--- THE MESSAGE ---',
    `From: ${params.fromName ? `${params.fromName} <${params.fromEmail}>` : params.fromEmail}`,
    `Subject: ${params.subject}`,
    '',
    params.body,
  ].join('\n')
}

/**
 * The tool is how the answer is forced into a shape. Asking for JSON in prose and parsing
 * whatever comes back fails on the days it matters; a tool schema does not.
 */
const TRIAGE_TOOL: Anthropic.Tool = {
  name: 'record_triage',
  description: 'Record the triage decision for one customer email.',
  input_schema: {
    type: 'object',
    properties: {
      category: { type: 'string', enum: CATEGORIES },
      severity: {
        type: 'string',
        enum: SEVERITIES,
        description:
          'INFO for routine questions. WARNING where the customer is out money, time or product. CRITICAL for anger, a threatened chargeback, a health or legal claim.',
      },
      confidence: { type: 'integer', minimum: 0, maximum: 100 },
      summary: { type: 'string', description: 'One line: what this person wants.' },
      canAnswerWithoutHuman: { type: 'boolean' },
      replyBody: { type: 'string', description: 'The reply, plain text. Always write it.' },
      actionSummary: {
        type: 'string',
        description: 'What a human must do. Empty string when nothing is owed.',
      },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            instruction: { type: 'string' },
            isOptional: { type: 'boolean' },
          },
          required: ['instruction', 'isOptional'],
        },
      },
    },
    required: [
      'category',
      'severity',
      'confidence',
      'summary',
      'canAnswerWithoutHuman',
      'replyBody',
      'actionSummary',
      'steps',
    ],
  },
}

function coerce(raw: any): Classification {
  const category: InboundEmailCategory = CATEGORIES.includes(raw?.category)
    ? raw.category
    : 'GENERAL_QUESTION'

  const severity: NotificationSeverity = SEVERITIES.includes(raw?.severity)
    ? raw.severity
    : 'INFO'

  const confidence = Number.isFinite(raw?.confidence)
    ? Math.max(0, Math.min(100, Math.round(raw.confidence)))
    : 0

  const steps: ProposedStep[] = Array.isArray(raw?.steps)
    ? raw.steps
        .filter((step: any) => typeof step?.instruction === 'string' && step.instruction.trim())
        .map((step: any) => ({
          instruction: String(step.instruction).trim(),
          isOptional: Boolean(step.isOptional),
        }))
        .slice(0, 10)
    : []

  const reply = typeof raw?.replyBody === 'string' ? raw.replyBody.trim() : ''
  const action = typeof raw?.actionSummary === 'string' ? raw.actionSummary.trim() : ''

  return {
    category,
    severity,
    confidence,
    summary:
      typeof raw?.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : 'Customer email needing review',
    canAnswerWithoutHuman: Boolean(raw?.canAnswerWithoutHuman),
    replyBody: reply || null,
    actionSummary: action || null,
    steps,
  }
}

/**
 * The fallback when the model cannot be reached or refuses.
 *
 * It escalates. A triage system whose AI is down must not go quiet — it must produce a
 * human-actionable alert for every message it could not read.
 */
export function escalationFallback(reason: string): Classification {
  return {
    category: 'GENERAL_QUESTION',
    severity: 'WARNING',
    confidence: 0,
    summary: 'Unread customer email — automatic triage failed',
    canAnswerWithoutHuman: false,
    replyBody: null,
    actionSummary: `This email could not be classified automatically (${reason}). Read it in Gmail and respond.`,
    steps: [
      { instruction: 'Open the email in Gmail and read it in full.', isOptional: false },
      { instruction: 'Decide what the customer needs and do it.', isOptional: false },
      { instruction: 'Reply to the customer.', isOptional: false },
    ],
  }
}

export async function classifyEmail(params: {
  fromEmail: string
  fromName: string | null
  subject: string
  body: string
  context: EmailContext
  /** The mailbox message id; one Agent Analytics session per email. */
  sessionId?: string
  /** Stable Agent Analytics identity: the mailbox connection the email arrived on. */
  deviceId?: string
}): Promise<Classification> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return escalationFallback('ANTHROPIC_API_KEY is not configured')

  // The same content the storefront assistant answers from, so an emailed question and a
  // chat question cannot get two different answers.
  let siteContent = ''
  try {
    const indexed = await getIndexedContent()
    const relevant = searchContent(`${params.subject}\n${params.body}`, indexed, 5)
    siteContent = formatContextForLLM(relevant)
  } catch (error) {
    console.warn('[inbox] Site content lookup failed:', error)
  }

  const body = params.body.slice(0, MAX_BODY_CHARS)

  try {
    // Metadata only: the prompt is a customer's whole email.
    const message = await inboxTriageAgent.session({ sessionId: params.sessionId, deviceId: params.deviceId }).run(() =>
      trackedAnthropic(apiKey, { metadataOnly: true }).createMessage({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: [TRIAGE_TOOL],
        tool_choice: { type: 'tool', name: 'record_triage' },
        messages: [{ role: 'user', content: buildUserPrompt({ ...params, body, siteContent }) }],
      }),
    )

    if (message.stop_reason === 'refusal') {
      return escalationFallback('the model declined to classify this message')
    }

    const call = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    )
    if (!call) return escalationFallback('the model returned no triage decision')

    return coerce(call.input)
  } catch (error) {
    const reason =
      error instanceof Anthropic.APIError ? `API error ${error.status}` : 'an unexpected error'
    console.error('[inbox] Classification failed:', error)
    return escalationFallback(reason)
  }
}
