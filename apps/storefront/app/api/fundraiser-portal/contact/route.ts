import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail, serverError } from '@/lib/api'
import { checkRateLimit } from '@/lib/email/rate-limit'
import { sendEmail } from '@/lib/email/client'
import { ContactFormEmail } from '@/emails/contact-form'
import { validatePageConfig } from '@/lib/fundraiser-page-config'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const field = (max: number) => z.string().trim().max(max).optional().default('')

const contactSchema = z
  .object({
    fundraiserSlug: z.string().trim().min(1).max(200),
    name: field(100),
    email: z.union([z.literal(''), z.string().trim().email().max(320)]).optional().default(''),
    phone: field(40),
    organization: field(200),
    message: field(5000),
  })
  .refine((d) => d.name || d.email || d.phone || d.organization || d.message, {
    message: 'Please fill in at least one field',
  })

/**
 * POST /api/fundraiser-portal/contact
 * Public endpoint behind the fundraiser page's contact-form block. The message is stored as a
 * ContactSubmission and emailed to the campaign. The recipient is resolved server-side from the
 * fundraiser's saved page config (falling back to its contact email) — never from the request,
 * which would make this an open mail relay.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed, retryAfterMs } = checkRateLimit(`fundraiser-contact:${ip}`, {
      maxRequests: 3,
      windowMs: 5 * 60 * 1000,
    })
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 300_000) / 1000)) },
        }
      )
    }

    const parsed = contactSchema.safeParse(await req.json())
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }
    const { fundraiserSlug, name, email, phone, organization, message } = parsed.data

    const fundraiser = await prisma.fundraiser.findUnique({
      where: { slug: fundraiserSlug },
      select: { name: true, contactEmail: true, pageConfig: true },
    })
    if (!fundraiser) return fail('Fundraiser not found', 404)

    const config = validatePageConfig(fundraiser.pageConfig)
    const formBlock = config.success
      ? config.data.blocks.find((b) => b.type === 'contact_form')
      : undefined
    const recipient =
      (formBlock?.type === 'contact_form' && formBlock.recipientEmail) || fundraiser.contactEmail

    const subject = `[Fundraiser: ${fundraiser.name}] Contact form`.slice(0, 200)
    const body = [
      phone && `Phone: ${phone}`,
      organization && `Organization: ${organization}`,
      message,
    ]
      .filter(Boolean)
      .join('\n\n')

    const submission = await prisma.contactSubmission.create({
      data: { name, email, subject, message: body, ip },
    })

    // Best-effort, like the developer contact form: the submission is already stored.
    try {
      await sendEmail({
        to: recipient,
        subject,
        react: ContactFormEmail({
          name,
          email,
          phone,
          company: organization,
          message,
          storeName: fundraiser.name,
        }),
        type: 'fundraiser-contact',
        replyTo: email || undefined,
      })
    } catch (emailError: unknown) {
      console.error('Failed to send fundraiser contact notification email:', emailError)
    }

    return ok({ sent: true, id: submission.id }, 201)
  } catch (error: unknown) {
    return serverError('Failed to process contact submission', error)
  }
}
