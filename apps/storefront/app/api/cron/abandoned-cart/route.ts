import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { sendEmail, substituteVariables } from '@/lib/email/sender'
import { abandonedCartStage1Template } from '@/lib/email/templates/abandoned-cart-stage-1'
import { abandonedCartStage2Template } from '@/lib/email/templates/abandoned-cart-stage-2'
import { abandonedCartStage3Template } from '@/lib/email/templates/abandoned-cart-stage-3'
import { checkUnsubscribed, logEmailSend } from '@/lib/email/logger'
import { enrollInAutomation } from '@/lib/email/automation-engine'
import {
  ABANDONED_CART_EMAIL_TYPE,
  abandonedCartWhere,
  customerName,
  formatCartTotal,
  hoursWaiting,
  recoveryLinkExpiresIn,
} from '@/lib/checkout/abandoned-cart'
import { SITE_URL } from '@/lib/site-url'
import { isBigCommerceStorefrontEnabled } from '@/lib/bigcommerce/storefront'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? SITE_URL

const abandonedCartStageTemplates: Record<number, typeof abandonedCartStage1Template> = {
  1: abandonedCartStage1Template,
  2: abandonedCartStage2Template,
  3: abandonedCartStage3Template,
}

interface DueCart {
  id: string
  recoveryToken: string
  createdAt: Date
  updatedAt: Date
  cartData: unknown
  user?: { id?: string; email: string | null; name: string | null } | null
}

async function sendAbandonedCartEmail(
  cart: DueCart,
  email: string,
  name: string,
  stage: number,
  now: Date
): Promise<boolean> {
  const isUnsub = await checkUnsubscribed({ email, category: 'abandoned_cart' })
  if (isUnsub) return false

  const recoveryToken = await prisma.abandonedCart.findUnique({
    where: { id: cart.id },
    select: { recoveryToken: true },
  })
  if (!recoveryToken) return false

  const template = abandonedCartStageTemplates[stage]
  if (!template) {
    return false
  }

  // The checkout page is what restores a cart: it reads `?recover=`, calls the recovery API
  // itself and drops the items into the shopper's session. Linking straight at the API instead
  // would show them a page of JSON and, worse, burn the token — the API marks the cart recovered
  // on the first call, so the sequence would stop and the real checkout link would 410.
  const cartUrl = `${BASE_URL}/checkout?recover=${recoveryToken.recoveryToken}`
  const unsubscribeUrl = `${BASE_URL}/unsubscribe?email=${encodeURIComponent(email)}`

  const expiresIn = recoveryLinkExpiresIn(cart.createdAt, now)
  if (!expiresIn) return false

  const vars: Record<string, string> = {
    name,
    cartUrl,
    cartTotal: formatCartTotal(cart.cartData),
    hoursWaiting: String(hoursWaiting(cart.updatedAt, now)),
    expiresIn,
    UNSUBSCRIBE_URL: unsubscribeUrl,
    NEWSLETTER_PREFERENCES_URL: `${BASE_URL}/account/settings`,
    VIEW_IN_BROWSER_URL: '',
    FORWARD_TO_FRIEND_URL: '',
  }

  // Subject, HTML and text all come from the one template the stage selected, so editing a
  // template's subject line changes what is sent rather than only what the preview shows.
  const subject = substituteVariables(template.subject, vars)
  const html = substituteVariables(template.html, vars)
  const text = substituteVariables(template.text, vars)

  const result = await sendEmail({ to: email, subject, html, text })
  if (!result.success) return false

  // One row per send, tagged with the stage. Without it the only record of the sequence is the
  // cart's current stage, which counts a cart once however many emails it has had — and the
  // Resend webhook, which records opens and clicks against these rows, would have nothing to
  // write to. Failing to log must not un-send the email, so this never throws.
  try {
    await logEmailSend({
      recipientEmail: email,
      recipientName: name,
      userId: cart.user?.id,
      subject,
      status: 'SENT',
      metadata: {
        type: ABANDONED_CART_EMAIL_TYPE,
        stage,
        cartId: cart.id,
        ...(result.messageId ? { messageId: result.messageId } : {}),
      },
    })
  } catch (error) {
    console.error('Abandoned cart email log failed:', error)
  }

  return true
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    const carts = await prisma.abandonedCart.findMany({
      where: abandonedCartWhere(now, { siteCheckoutOnly: isBigCommerceStorefrontEnabled() }),
      include: {
        user: { select: { id: true, email: true, name: true } },
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

      // The moment a cart first counts as abandoned is the ABANDONED_CART trigger. Keyed on the
      // cart, so the hourly re-scan of a cart still at stage 0 (an unsubscribed shopper, a failed
      // send) never enrolls it twice. Runs alongside the built-in sequence below, not instead of
      // it — an admin who builds a cart series should switch one of the two off.
      if (cart.emailStage === 0) {
        try {
          await enrollInAutomation(
            'ABANDONED_CART',
            email,
            {
              firstName: name,
              cartUrl: `${BASE_URL}/checkout?recover=${cart.recoveryToken}`,
              cartTotal: formatCartTotal(cart.cartData),
              cartId: cart.id,
            },
            `abandoned_cart:${cart.id}`
          )
        } catch (error) {
          console.error('Abandoned cart automation enrollment failed:', error)
        }
      }

      const success = await sendAbandonedCartEmail(cart, email, name, nextStage, now)

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
