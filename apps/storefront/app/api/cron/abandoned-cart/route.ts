import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { sendEmail, substituteVariables } from '@/lib/email/sender'
import { abandonedCartTemplate } from '@/lib/email/templates/abandoned-cart'
import { checkUnsubscribed } from '@/lib/email/logger'
import {
  abandonedCartWhere,
  customerName,
  formatCartTotal,
  stageCopy,
} from '@/lib/checkout/abandoned-cart'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://josemadrid.net'

async function sendAbandonedCartEmail(
  cartId: string,
  email: string,
  name: string,
  cartData: unknown,
  stage: number
): Promise<boolean> {
  const isUnsub = await checkUnsubscribed({ email, category: 'abandoned_cart' })
  if (isUnsub) return false

  const recoveryToken = await prisma.abandonedCart.findUnique({
    where: { id: cartId },
    select: { recoveryToken: true },
  })
  if (!recoveryToken) return false

  const cartUrl = `${BASE_URL}/api/cart/recover?token=${recoveryToken.recoveryToken}`
  const cartTotal = formatCartTotal(cartData)
  const unsubscribeUrl = `${BASE_URL}/unsubscribe?email=${encodeURIComponent(email)}`

  const { subject, intro } = stageCopy(stage)

  const vars: Record<string, string> = {
    name,
    cartUrl,
    cartTotal,
    stageIntro: intro,
    UNSUBSCRIBE_URL: unsubscribeUrl,
    NEWSLETTER_PREFERENCES_URL: `${BASE_URL}/account/settings`,
    VIEW_IN_BROWSER_URL: '',
    FORWARD_TO_FRIEND_URL: '',
  }

  const html = substituteVariables(abandonedCartTemplate.html, vars)
    .replace('{{stageIntro}}', intro)
  const text = substituteVariables(abandonedCartTemplate.text, vars)

  const result = await sendEmail({ to: email, subject, html, text })
  return result.success
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    const carts = await prisma.abandonedCart.findMany({
      where: abandonedCartWhere(now),
      include: {
        user: { select: { email: true, name: true } },
      },
      take: 100,
    })

    let sent = 0
    let skipped = 0

    for (const cart of carts) {
      const email = cart.user?.email ?? cart.guestEmail
      if (!email) { skipped++; continue }

      const name = customerName(cart.user?.name, cart.guestEmail)
      const nextStage = cart.emailStage + 1

      const success = await sendAbandonedCartEmail(cart.id, email, name, cart.cartData, nextStage)

      if (success) {
        await prisma.abandonedCart.update({
          where: { id: cart.id },
          data: {
            emailStage: nextStage,
            emailSent: true,
            emailSentAt: now,
          },
        })
        sent++
      } else {
        skipped++
      }
    }

    return NextResponse.json({ success: true, sent, skipped, total: carts.length })
  } catch (error) {
    console.error('Abandoned cart cron error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
