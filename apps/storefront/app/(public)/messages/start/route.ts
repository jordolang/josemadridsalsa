import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendContactConfirmationEmail } from '@/lib/email/automation'
import { sendEmail } from '@/lib/email/sender'
import { logEngagementRequest } from '@/lib/engagements'

export const dynamic = 'force-dynamic'


export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json()

    // Rate limiting by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0'
    const { rateLimit } = await import('@/lib/rateLimit')
    const limitCheck = rateLimit(`messages:start:${ip}`, 5, 60_000)
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(Math.ceil(limitCheck.retryAfterMs / 1000)) } as any })
    }

    // Validate payload
    const { MessageStartSchema } = await import('@/lib/validation')
    const parsed = MessageStartSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const { subject, message, email } = parsed.data

    if (!session?.user?.id && !email) {
      return NextResponse.json({ error: 'Email is required for guests' }, { status: 400 })
    }

    const conversation = await prisma.conversation.create({
      data: {
        subject: subject || null,
        userId: session?.user?.id || null,
        email: session?.user?.id ? null : (email || null),
        messages: {
          create: [
            {
              senderType: 'USER',
              body: message,
            },
          ],
        },
      },
      include: {
        messages: true,
      },
    })

    const recipientEmail = session?.user?.email || email || null

    if (recipientEmail) {
      await Promise.allSettled([
        sendContactConfirmationEmail({
          email: recipientEmail,
          name: session?.user?.name || undefined,
          subject: subject || undefined,
        }),
        logEngagementRequest({
          type: 'CONTACT',
          email: recipientEmail,
          name: session?.user?.name || null,
          source: 'messages:start',
          metadata: {
            subject,
            conversationId: conversation.id,
          },
        }),
      ])
    }

    const supportEmail = process.env.SUPPORT_EMAIL || 'support@josemadridsalsa.com'
    const notifyResult = await sendEmail({
      to: supportEmail,
      subject: `[New Conversation] ${subject || 'Customer Inquiry'}`,
      html: `<p>You have a new customer inquiry.</p>
             <p><strong>From:</strong> ${recipientEmail ?? 'Logged-in user'}</p>
             <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
             <p><strong>Message:</strong></p>
             <p>${message.replace(/\n/g, '<br/>')}</p>
             <p><a href="${process.env.NEXTAUTH_URL || 'https://www.josemadridsalsa.com'}/admin/messages/${conversation.id}">View conversation</a></p>`,
      text: `New conversation from ${recipientEmail ?? 'Logged-in user'}\nSubject: ${subject || 'N/A'}\n\n${message}\n\nView: ${process.env.NEXTAUTH_URL || 'https://www.josemadridsalsa.com'}/admin/messages/${conversation.id}`,
    })
    if (!notifyResult.success) {
      console.error('Failed to notify support of new conversation', notifyResult.error)
    }

    return NextResponse.json(conversation)
  } catch (e) {
    console.error('Message start failed', e)
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}
