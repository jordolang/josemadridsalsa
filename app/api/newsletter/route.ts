import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendNewsletterWelcomeEmail } from '@/lib/email/automation'
import { logEngagementRequest } from '@/lib/engagements'

const NewsletterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
  source: z.string().max(120).optional(),
})

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = NewsletterSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid newsletter data.' },
        { status: 400 }
      )
    }

    const { email, name, source } = parsed.data
    const normalizedEmail = email.trim().toLowerCase()

    await logEngagementRequest({
      type: 'NEWSLETTER',
      email: normalizedEmail,
      name: name ?? null,
      source: source ?? 'footer:newsletter',
      metadata: { consentAt: new Date().toISOString() },
    })

    await sendNewsletterWelcomeEmail({
      email: normalizedEmail,
      name: name ?? undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Newsletter subscription error:', error)
    return NextResponse.json(
      { error: 'Unable to subscribe right now. Please try again later.' },
      { status: 500 }
    )
  }
}
