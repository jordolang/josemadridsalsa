import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { addSuppression } from '@/lib/email/suppression'

export async function POST(request: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const payload = await request.text()

    // Verify webhook signature using the Resend SDK
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    let event: { type: string; data: Record<string, any> }

    if (webhookSecret) {
      try {
        event = resend.webhooks.verify({
          payload,
          headers: {
            id: request.headers.get('svix-id') ?? '',
            timestamp: request.headers.get('svix-timestamp') ?? '',
            signature: request.headers.get('svix-signature') ?? '',
          },
          webhookSecret,
        }) as { type: string; data: Record<string, any> }
      } catch {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else {
      event = JSON.parse(payload) as { type: string; data: Record<string, any> }
    }

    const { type, data } = event
    // Resend sends recipients as plain address strings (`to: string[]`).
    const email = (data?.to as string[] | undefined)?.[0]

    if (!email) return NextResponse.json({ ok: true })

    // Delivery and engagement belong to one message, not to everything ever sent to the
    // address. Sends record Resend's id as `metadata.messageId`; match on it when present.
    const emailId = data?.email_id as string | undefined
    const thisMessage: Prisma.EmailLogWhereInput = emailId
      ? { metadata: { path: ['messageId'], equals: emailId } }
      : { recipientEmail: email }

    switch (type) {
      case 'email.bounced': {
        // Resend reports `Permanent` / `Transient` / `Undetermined`; compare case-insensitively.
        const bounceType =
          String(data.bounce?.type ?? '').toLowerCase() === 'permanent' ? 'HARD' : 'SOFT'
        const reason =
          (data.bounce?.message as string) ?? 'Unknown bounce reason'

        await prisma.emailBounce.create({
          data: { email, bounceType, reason },
        })

        await prisma.emailLog.updateMany({
          where: {
            ...thisMessage,
            status: { in: ['SENT', 'PENDING', 'SENDING'] },
          },
          data: { status: 'BOUNCED', bouncedAt: new Date() },
        })

        if (bounceType === 'HARD') {
          await addSuppression(email, 'HARD_BOUNCE', 'resend_webhook')
        }
        break
      }

      case 'email.complained': {
        await addSuppression(email, 'SPAM_COMPLAINT', 'resend_webhook')

        await prisma.unsubscribePreference.upsert({
          where: { email: email.toLowerCase().trim() },
          create: {
            email: email.toLowerCase().trim(),
            unsubscribeAll: true,
            unsubscribedFrom: [],
          },
          update: { unsubscribeAll: true },
        })
        break
      }

      case 'email.delivered': {
        await prisma.emailLog.updateMany({
          where: {
            ...thisMessage,
            status: { in: ['PENDING', 'SENDING'] },
          },
          data: { status: 'SENT', sentAt: new Date() },
        })
        break
      }

      case 'email.opened': {
        await prisma.emailLog.updateMany({
          where: {
            ...thisMessage,
            status: 'SENT',
            openedAt: null,
          },
          data: { status: 'OPENED', openedAt: new Date() },
        })
        break
      }

      case 'email.clicked': {
        await prisma.emailLog.updateMany({
          where: {
            ...thisMessage,
            status: { in: ['SENT', 'OPENED'] },
          },
          data: { status: 'CLICKED', clickedAt: new Date() },
        })
        break
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Resend webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
