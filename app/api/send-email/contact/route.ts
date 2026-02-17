import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/client'
import { ContactFormEmail } from '@/emails/contact-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ContactFormRequest {
  name: string
  email: string
  phone?: string
  message: string
  submittedAt?: string
  userId?: string
  unsubscribeUrl?: string
}

// API route for sending contact form emails
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContactFormRequest

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      )
    }

    if (!body.email) {
      return NextResponse.json(
        { error: 'Missing required field: email' },
        { status: 400 }
      )
    }

    if (!body.message) {
      return NextResponse.json(
        { error: 'Missing required field: message' },
        { status: 400 }
      )
    }

    // Prepare email data
    const emailProps = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      message: body.message,
      submittedAt: body.submittedAt || new Date().toISOString(),
      unsubscribeUrl: body.unsubscribeUrl,
    }

    // Send email to company
    const result = await sendEmail({
      to: 'info@josemadridsalsa.com',
      subject: `New Contact Form Submission from ${body.name}`,
      react: ContactFormEmail(emailProps),
      type: 'contact-form',
      userId: body.userId,
      replyTo: body.email,
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
      from: body.email,
    })
  } catch (error) {
    console.error('Contact form email API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
