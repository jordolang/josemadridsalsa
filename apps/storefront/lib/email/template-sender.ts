/**
 * Send emails via Resend hosted templates.
 *
 * Use this when a template has been synced to Resend (see sync-templates-to-resend.ts).
 * The caller passes the template alias and a variables object; this module
 * handles idempotency keys, unsubscribe headers, suppression checks, and logging.
 */

import { Resend } from 'resend'
import { logEmailSend, checkUnsubscribed } from '@/lib/email/logger'
import { createHash } from 'crypto'
import { getTemplateByAlias } from './resend-templates'
import type { OrderItem } from '@/emails/components/OrderItemsTable'
import { colors, font } from './resend-templates/shared'
import { SITE_URL } from '@/lib/site-url'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

function hashEmail(email: string): string {
  return createHash('sha256')
    .update(email.toLowerCase())
    .digest('hex')
    .slice(0, 12)
}

/* ── Public types ───────────────────────────────────────── */

interface TemplateSendOptions {
  /** Template alias (e.g. "order-confirmation"). */
  templateAlias: string
  /** Recipient address(es). */
  to: string | string[]
  /** Variables to inject into the template. */
  variables: Record<string, string | number>
  /** Override the template's default subject. */
  subject?: string
  /** Override the template's default from. */
  from?: string
  replyTo?: string
  /** Used for idempotency key generation. */
  orderId?: string
  userId?: string
}

interface TemplateSendResult {
  success: boolean
  error?: string
  messageId?: string
}

/* ── Transactional aliases (always sent regardless of unsub) */

const TRANSACTIONAL_ALIASES = new Set([
  'order-confirmation',
  'shipping-notification',
  'delivery-confirmation',
])

/* ── Main send function ─────────────────────────────────── */

export async function sendWithTemplate({
  templateAlias,
  to,
  variables,
  subject,
  from,
  replyTo,
  orderId,
  userId,
}: TemplateSendOptions): Promise<TemplateSendResult> {
  const recipientEmail = Array.isArray(to) ? to[0] : to
  const emailHash = hashEmail(recipientEmail)

  // Validate the alias is known
  const definition = getTemplateByAlias(templateAlias)
  if (!definition) {
    const msg = `Unknown template alias: ${templateAlias}`
    console.error(msg)
    return { success: false, error: msg }
  }

  if (!resend) {
    const msg = 'Resend client not initialised - RESEND_API_KEY missing'
    console.error(msg)
    await logEmailSend({
      recipientEmail,
      userId,
      templateId: templateAlias,
      subject: subject ?? definition.subject,
      status: 'FAILED',
      errorMessage: msg,
      metadata: orderId ? { orderId } : undefined,
    }).catch(() => {})
    return { success: false, error: msg }
  }

  // Suppression / unsubscribe check (skip for transactional)
  if (!TRANSACTIONAL_ALIASES.has(templateAlias)) {
    const isUnsubscribed = await checkUnsubscribed({
      email: recipientEmail,
      category: templateAlias,
    })
    if (isUnsubscribed) {
      console.log(`Email not sent - user unsubscribed: ${emailHash}`)
      return { success: false, error: 'User unsubscribed' }
    }
  }

  // Build unsubscribe URL for the header
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || SITE_URL
  const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(recipientEmail)}`

  // Inject the built-in UNSUBSCRIBE_URL variable
  const mergedVars: Record<string, string | number> = {
    UNSUBSCRIBE_URL: unsubscribeUrl,
    ...variables,
  }

  // Build idempotency key
  const idempotencyKey = orderId
    ? `${templateAlias}/${orderId}`
    : `${templateAlias}/${emailHash}-${Date.now()}`

  const effectiveSubject = subject ?? definition.subject
  const effectiveFrom =
    from ?? process.env.FROM_EMAIL ?? definition.from

  const { data, error: sendError } = await resend.emails.send(
    {
      from: effectiveFrom,
      to,
      template: {
        id: templateAlias,
        variables: mergedVars,
      },
      ...(replyTo ? { replyTo } : {}),
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    },
    { idempotencyKey },
  )

  if (sendError) {
    console.error(`Template send error (${templateAlias}):`, sendError)
    await logEmailSend({
      recipientEmail,
      userId,
      templateId: templateAlias,
      subject: effectiveSubject,
      status: 'FAILED',
      errorMessage: sendError.message,
      metadata: orderId ? { orderId } : undefined,
    }).catch(() => {})
    return { success: false, error: sendError.message }
  }

  await logEmailSend({
    recipientEmail,
    userId,
    templateId: templateAlias,
    subject: effectiveSubject,
    status: 'SENT',
    metadata: { ...(orderId ? { orderId } : {}), ...(data?.id ? { messageId: data.id } : {}) },
  }).catch(() => {})

  console.log(`Email sent via template: ${templateAlias} to ${emailHash}`)

  return { success: true, messageId: data?.id }
}

/* ── Helper: render order items to HTML for template vars ── */

/**
 * Pre-render an array of order items into an HTML string
 * suitable for the {{{ORDER_ITEMS_HTML}}} variable.
 *
 * Resend templates cannot loop, so dynamic lists must be
 * rendered server-side before passing to the template.
 */
export function renderOrderItemsHtml(items: OrderItem[]): string {
  if (!items || items.length === 0) {
    return `<p style="margin:0;font-size:14px;color:#6b7280;${font}line-height:1.5;">No items</p>`
  }

  const rows = items
    .map((item) => {
      const parsed =
        typeof item.totalPrice === 'number'
          ? item.totalPrice
          : Number(item.totalPrice)
      const lineTotal = Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00'

      return `
<tr>
  <td valign="top" style="padding:0 16px 16px 0;">
    <p style="margin:0 0 4px 0;font-size:14px;font-weight:600;color:${colors.textDark};${font}line-height:1.5;">${item.quantity}&times; ${item.productName}</p>
    <p style="margin:0;font-size:12px;color:#6b7280;${font}line-height:1.5;">SKU: ${item.productSku}</p>
  </td>
  <td valign="top" align="right" width="100" style="padding:0 0 16px 0;">
    <p style="margin:0;font-size:14px;font-weight:600;color:${colors.textDark};${font}line-height:1.5;">$${lineTotal}</p>
  </td>
</tr>`
    })
    .join('')

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>`
}

/**
 * Pre-render a top-participants list for campaign summary emails.
 */
export function renderTopParticipantsHtml(
  participants: ReadonlyArray<{ name: string; sales: number }>,
): string {
  if (participants.length === 0) return ''

  const heading = `<p style="margin:16px 0 8px 0;font-size:16px;font-weight:600;color:${colors.textDark};${font}line-height:1.6;">Top Participants:</p>`

  const lines = participants
    .map(
      (p, i) =>
        `<p style="margin:0 0 8px 0;font-size:16px;color:${colors.textDark};${font}line-height:1.6;">${i + 1}. ${p.name} - ${p.sales} sales</p>`,
    )
    .join('')

  return heading + lines
}
