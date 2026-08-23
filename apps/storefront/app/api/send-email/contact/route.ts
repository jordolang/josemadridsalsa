import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendEmail } from '@/lib/email/client'
import { ContactFormEmail } from '@/emails/contact-form'
import { checkRateLimit } from '@/lib/email/rate-limit'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ContactFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address').max(320),
  company: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  message: z.string().min(1, 'Message is required').max(5000),
  // Page the form was submitted from, used in the notification subject line.
  sourcePage: z.string().max(120).optional(),
  submittedAt: z.string().optional(),
  userId: z.string().optional(),
})

// API route for sending contact form emails
export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed, retryAfterMs } = checkRateLimit(`contact:${ip}`, { maxRequests: 5, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 60000) / 1000)) } }
      )
    }

    const body = await request.json()
    for (const field of ['name', 'email', 'message'] as const) {
      if (typeof body?.[field] !== 'string' || body[field].trim().length === 0) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    const parsed = ContactFormSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { error: `Validation error: ${firstError.message}` },
        { status: 400 }
      )
    }

    const { name, email, company, phone, message, sourcePage, submittedAt, userId } = parsed.data
    const receivedAt = submittedAt || new Date().toISOString()

    const conversation = await prisma.conversation.create({
      data: {
        subject: `Contact form submission from ${name}`,
        email,
        messages: {
          create: [
            {
              senderType: 'USER',
              body: [
                `Name: ${name}`,
                `Email: ${email}`,
                company ? `Company: ${company}` : null,
                phone ? `Phone: ${phone}` : null,
                `Submitted: ${receivedAt}`,
                '',
                message,
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ],
        },
      },
      select: {
        id: true,
      },
    })

    // Send email to company
    const result = await sendEmail({
      to: 'mike@josemadridsalsa.com',
      subject: `${email} submitted the form from your ${sourcePage || 'Contact'} page`,
      react: ContactFormEmail({ name, email, company, phone, message }),
      type: 'contact-form',
      userId,
      replyTo: email,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send contact form email', details: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      conversationId: conversation.id,
      from: email,
    })
  } catch (error) {
    console.error('Contact form email API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
