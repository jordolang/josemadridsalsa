import { put } from '@vercel/blob'
import type { NextRequest } from 'next/server'
import { fail, ok, serverError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { sendEmail } from '@/lib/email/sender'
import { logEngagementRequest } from '@/lib/engagements'
import { orderFormSubmissionSchema } from '@/lib/fundraising-site/order-form'
import {
  buildOrderFormEmail,
  buildOrderFormPathname,
  buildOrderFormPdf,
  createOrderFormRecord,
  orderFormLineItems,
} from '@/lib/fundraising-site/order-form-submission'
import { checkRateLimit, createRateLimitHeaders, getClientIdentifier } from '@/lib/rate-limiter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** A group submits a handful of orders a season; this only stops a runaway script. */
const ORDER_FORM_RATE_LIMIT = { maxRequests: 10, windowSeconds: 60 * 60 }

/**
 * Receives a signed fundraiser order form from fundraising.josemadridsalsa.com/submit.
 * The signed PDF is archived to Vercel Blob, the order is logged as a FUNDRAISER
 * engagement request for follow-up, and both the fundraising inbox and the group
 * get an email copy.
 */
export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request)
  const rateLimit = await checkRateLimit({ ...ORDER_FORM_RATE_LIMIT, identifier: `fundraiser-order-form:${clientId}` })
  if (!rateLimit.allowed) {
    const response = fail('Too many order forms from this connection. Please call us at 740-521-4304.', 429)
    for (const [key, value] of Object.entries(createRateLimitHeaders(rateLimit))) response.headers.set(key, String(value))
    return response
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('Invalid JSON body', 400)
  }

  const parsed = orderFormSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return fail('Please check the form and try again', 422, parsed.error.flatten().fieldErrors)
  }

  const record = createOrderFormRecord(parsed.data, {
    ipAddress: clientId === 'unknown-ip' ? null : clientId,
    userAgent: request.headers.get('user-agent'),
  })

  try {
    const pdf = await buildOrderFormPdf(record)

    // The Blob store is public, so the random suffix keeps these URLs unguessable;
    // nothing on the site links to or lists them. Without a token the order still
    // goes through by email — losing a group's order over storage would be worse.
    let pdfUrl: string | null = null
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (token) {
      const blob = await put(`${buildOrderFormPathname(record)}.pdf`, Buffer.from(pdf), {
        access: 'public',
        contentType: 'application/pdf',
        addRandomSuffix: true,
        token,
      })
      pdfUrl = blob.url
    } else {
      console.warn('[fundraiser-order-forms] BLOB_READ_WRITE_TOKEN missing; signed PDF not archived', record.code)
    }

    const { signature: _signature, ...recordWithoutSignature } = record
    await logEngagementRequest({
      type: 'FUNDRAISER',
      email: record.email,
      name: record.contactName,
      source: 'site:fundraising:order-form',
      metadata: {
        kind: 'order-form',
        code: record.code,
        organization: record.organizationName,
        phone: record.phone,
        shipTo: record.shipTo,
        notes: record.notes,
        items: orderFormLineItems(record),
        totals: record.totals,
        agreementText: record.agreementText,
        signed: true,
        pdfUrl,
        submittedAt: record.submittedAt,
      },
    })

    const fundraisingInbox = process.env.FUNDRAISING_EMAIL || 'mike@josemadridsalsa.com'
    const staffEmail = buildOrderFormEmail(record, { audience: 'staff', pdfUrl })
    const submitterEmail = buildOrderFormEmail(record, { audience: 'submitter', pdfUrl })
    const [staffResult] = await Promise.all([
      sendEmail({ to: fundraisingInbox, replyTo: record.email, ...staffEmail }),
      sendEmail({ to: record.email, ...submitterEmail }),
    ])
    if (!staffResult.success) {
      console.error('[fundraiser-order-forms] Staff notification failed', record.code, staffResult.error)
    }

    await logAudit({
      userId: null,
      action: 'CREATE',
      entityType: 'FundraiserOrderForm',
      entityId: record.id,
      changes: { ...recordWithoutSignature, pdfUrl },
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
    })

    return ok(
      {
        id: record.id,
        code: record.code,
        submittedAt: record.submittedAt,
        totals: record.totals,
        pdfUrl,
      },
      201,
    )
  } catch (error) {
    return serverError('Could not submit the order form. Please try again or call 740-521-4304.', error)
  }
}

