import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addSuppression } from '@/lib/email/suppression'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()

    // Verify webhook signature
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (webhookSecret) {
      const signature = request.headers.get('svix-signature') ?? ''
      const timestamp = request.headers.get('svix-timestamp') ?? ''
      const msgId = request.headers.get('svix-id') ?? ''

      const signedContent = `${msgId}.${timestamp}.${body}`
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedContent)
        .digest('base64')

      const sigParts = signature.split(' ')
      const isValid = sigParts.some((part) => {
        const [, sig] = part.split(',')
        return sig === expectedSig
      })

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const event = JSON.parse(body) as {
      type: string
      data: {
        to?: { email: string }[]
        email?: string
        bounce?: { type?: string; message?: string }
      }
    }
    const { type, data } = event

    const email = data?.to?.[0]?.email ?? data?.email
    if (!email) return NextResponse.json({ ok: true })

    switch (type) {
      case 'email.bounced': {
        const bounceType = data.bounce?.type === 'permanent' ? 'HARD' : 'SOFT'
        const reason = data.bounce?.message ?? 'Unknown bounce reason'

        // Record bounce
        await prisma.emailBounce.create({
          data: { email, bounceType, reason },
        })

        // Update email log
        await prisma.emailLog.updateMany({
          where: { recipientEmail: email, status: { in: ['SENT', 'PENDING', 'SENDING'] } },
          data: { status: 'BOUNCED', bouncedAt: new Date() },
        })

        // Hard bounces go on suppression list
        if (bounceType === 'HARD') {
          await addSuppression(email, 'HARD_BOUNCE', 'resend_webhook')
        }
        break
      }

      case 'email.complained': {
        await addSuppression(email, 'SPAM_COMPLAINT', 'resend_webhook')

        // Unsubscribe from all
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
          where: { recipientEmail: email, status: { in: ['PENDING', 'SENDING'] } },
          data: { status: 'SENT', sentAt: new Date() },
        })
        break
      }

      case 'email.opened': {
        await prisma.emailLog.updateMany({
          where: { recipientEmail: email, status: 'SENT', openedAt: null },
          data: { status: 'OPENED', openedAt: new Date() },
        })
        break
      }

      case 'email.clicked': {
        await prisma.emailLog.updateMany({
          where: { recipientEmail: email, status: { in: ['SENT', 'OPENED'] } },
          data: { status: 'CLICKED', clickedAt: new Date() },
        })
        break
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Resend webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
