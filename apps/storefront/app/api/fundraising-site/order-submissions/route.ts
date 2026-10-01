import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/email/rate-limit'
import { sendEmail } from '@/lib/email/sender'
import { logEngagementRequest } from '@/lib/engagements'
import {
  DUE_PER_JAR,
  ORDER_KITS,
  PAYMENT_METHODS,
  orderSubmissionSchema,
  summarizeOrder,
} from '@/lib/fundraising-site/order-submission'
import { buildSignedOrderPdf, signedOrderPathname } from '@/lib/fundraising-site/signed-order-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

const money = (amount: number) => `$${amount.toLocaleString('en-US')}`

/**
 * POST /api/fundraising-site/order-submissions
 * Public endpoint behind fundraising.josemadridsalsa.com/submit: a community
 * fundraiser's 100% final bulk order. Emails the order to the fundraising inbox
 * (which is what starts fulfillment), confirms to the submitter, and records it.
 * Succeeds only if the inbox email was sent, so a lost order is never reported as received.
 * The drawn signature is archived as a signed PDF in Vercel Blob and linked from both emails.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { allowed, retryAfterMs } = checkRateLimit(`fundraiser-order:${ip}`, { maxRequests: 5, windowMs: 10 * 60 * 1000 })
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many submissions. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 600_000) / 1000)) } },
    )
  }

  const parsed = orderSubmissionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid order.', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  try {
    const order = parsed.data
    const { signature: _signature, ...orderWithoutSignature } = order
    const submittedAt = new Date()
    const summary = summarizeOrder(order.kit, order.quantities)
    const email = order.email.toLowerCase()
    const kitLabel = ORDER_KITS[order.kit].label
    const payment = PAYMENT_METHODS[order.paymentMethod]

    const record = await logEngagementRequest({
      type: 'FUNDRAISER',
      email,
      name: order.contactName,
      source: 'site:fundraising-submit',
      metadata: { ...orderWithoutSignature, summary, signed: true, submittedAt: submittedAt.toISOString() },
    })
    const reference = record?.id ? record.id.slice(-8).toUpperCase() : null

    // The Blob store is public, so the random suffix keeps the URL unguessable; nothing lists it.
    // A storage failure must not lose the order, so the emails go out either way.
    let pdfUrl: string | null = null
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN
    if (blobToken) {
      try {
        const pdf = await buildSignedOrderPdf(order, { submittedAt, reference, ipAddress: ip === 'unknown' ? null : ip })
        const blob = await put(signedOrderPathname(order, submittedAt), Buffer.from(pdf), {
          access: 'public',
          contentType: 'application/pdf',
          addRandomSuffix: true,
          token: blobToken,
        })
        pdfUrl = blob.url
      } catch (error) {
        console.error('Signed fundraiser order PDF failed:', error)
      }
    } else {
      console.warn('BLOB_READ_WRITE_TOKEN missing; signed fundraiser order PDF not archived')
    }

    const e = escapeHtml
    const rowsHtml = summary.lines
      .map((line) => `<tr><td style="padding:4px 12px 4px 0">${e(line.name)}</td><td style="text-align:right">${line.quantity}</td></tr>`)
      .join('')
    const rowsText = summary.lines.map((line) => `  ${line.quantity.toString().padStart(4)}  ${line.name}`).join('\n')
    const shipTo = `${order.shipName}\n${order.shipStreet}\n${order.shipCity}, ${order.shipState} ${order.shipZip}`
    const details = [
      ['Organization', order.organizationName],
      ['Contact', `${order.contactName} · ${email} · ${order.phone}`],
      ['Kit', kitLabel],
      ['Payment', `${payment} — amount due ${money(summary.amountDue)} (${summary.totalJars} jars × ${money(DUE_PER_JAR)})`],
      ['Signed', `Electronically by ${order.contactName}`],
      ...(reference ? [['Reference', reference]] : []),
    ]
    const html = `
      <h2>Final fundraiser order: ${e(order.organizationName)}</h2>
      ${details.map(([k, v]) => `<p><strong>${k}:</strong> ${e(v)}</p>`).join('')}
      <p><strong>Ship to:</strong><br/>${e(shipTo).replace(/\n/g, '<br/>')}</p>
      <table style="border-collapse:collapse"><tr><th align="left">Flavor</th><th align="right">Jars</th></tr>${rowsHtml}
      <tr><td style="padding-top:6px"><strong>Total jars</strong></td><td style="text-align:right"><strong>${summary.totalJars}</strong></td></tr></table>
      <p><strong>Notes:</strong> ${order.notes ? e(order.notes).replace(/\n/g, '<br/>') : '—'}</p>
      ${pdfUrl ? `<p><a href="${e(pdfUrl)}">Signed order form (PDF)</a></p>` : ''}`
    const text = `Final fundraiser order: ${order.organizationName}
${details.map(([k, v]) => `${k}: ${v}`).join('\n')}

Ship to:
${shipTo}

${rowsText}
  ${summary.totalJars.toString().padStart(4)}  TOTAL JARS

Notes: ${order.notes || '—'}${pdfUrl ? `\n\nSigned order form: ${pdfUrl}` : ''}`

    const inbox = process.env.FUNDRAISING_EMAIL || 'mike@josemadridsalsa.com'
    const sent = await sendEmail({
      to: inbox,
      replyTo: email,
      subject: `FINAL fundraiser order: ${order.organizationName} — ${summary.totalJars} jars`,
      html,
      text,
    })
    if (!sent.success) {
      console.error('Fundraiser order email failed:', sent.error)
      return NextResponse.json(
        { error: 'We could not send your order. Please try again, or call 740-521-4304.' },
        { status: 502 },
      )
    }

    // The submitter's copy is a courtesy; the order already reached the inbox.
    await sendEmail({
      to: email,
      replyTo: inbox,
      subject: `We received your final fundraiser order (${summary.totalJars} jars)`,
      html: `<p>Thank you! We received the final order for <strong>${e(order.organizationName)}</strong> and will fill it from the details below.</p>
        <p>Please pay ${money(summary.amountDue)} by ${e(payment.toLowerCase())}. Orders ship within 10 days of payment.
        Need to change something? Reply to this email or call 740-521-4304.</p>${html}`,
      text: `Thank you! We received your final order and will fill it from the details below.\n` +
        `Please pay ${money(summary.amountDue)} by ${payment.toLowerCase()}. Orders ship within 10 days of payment.\n` +
        `Need to change something? Reply to this email or call 740-521-4304.\n\n${text}`,
    }).catch((error) => console.error('Fundraiser order confirmation failed:', error))

    await logAudit({
      userId: null,
      action: 'CREATE',
      entityType: 'FundraiserOrderSubmission',
      entityId: record?.id ?? email,
      changes: { organizationName: order.organizationName, kit: order.kit, totalJars: summary.totalJars, signed: true, pdfUrl },
    })

    return NextResponse.json({ success: true, reference, pdfUrl, ...summary })
  } catch (error) {
    console.error('Fundraiser order submission error:', error)
    return NextResponse.json(
      { error: 'We could not submit your order right now. Please try again, or call 740-521-4304.' },
      { status: 500 },
    )
  }
}
