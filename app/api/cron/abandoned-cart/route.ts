import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, substituteVariables } from '@/lib/email/sender'
import { abandonedCartTemplate } from '@/lib/email/templates/abandoned-cart'
import { checkUnsubscribed } from '@/lib/email/logger'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://josemadrid.net'

// Stage delays in milliseconds
const STAGE_1_DELAY_MS = 60 * 60 * 1000          // 1 hour
const STAGE_2_DELAY_MS = 24 * 60 * 60 * 1000     // 24 hours
const STAGE_3_DELAY_MS = 48 * 60 * 60 * 1000     // 48 hours

const STAGE_SUBJECTS = [
  '',
  "You left something behind 🌶️",
  "Your salsa is still waiting for you",
  "Last chance — your cart expires soon",
]

const STAGE_INTROS = [
  '',
  "We noticed you left some items in your cart. Your taste in salsa is excellent — we'd hate for you to miss out!",
  "Your cart is still here! Don't let your favorite salsas slip away.",
  "This is your final reminder. Your cart will expire soon — complete your order today and save your selections.",
]

interface CartItem {
  name?: string
  productName?: string
  quantity?: number
  price?: number
  totalPrice?: number
}

function formatCartTotal(cartData: unknown): string {
  try {
    const data = cartData as { items?: CartItem[]; total?: number }
    if (data?.total) return `$${Number(data.total).toFixed(2)}`
    if (data?.items?.length) {
      const total = data.items.reduce((sum: number, item: CartItem) => {
        return sum + (item.totalPrice ?? item.price ?? 0) * (item.quantity ?? 1)
      }, 0)
      if (total > 0) return `$${total.toFixed(2)}`
    }
    return 'your items'
  } catch {
    return 'your items'
  }
}

function getCustomerName(userId: string | null, guestEmail: string | null): string {
  if (guestEmail) return guestEmail.split('@')[0]
  return 'there'
}

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

  const subject = STAGE_SUBJECTS[stage] ?? abandonedCartTemplate.subject
  const intro = STAGE_INTROS[stage] ?? ''

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

export async function GET() {
  try {
    const now = new Date()

    const stage1Threshold = new Date(now.getTime() - STAGE_1_DELAY_MS)
    const stage2Threshold = new Date(now.getTime() - STAGE_2_DELAY_MS)
    const stage3Threshold = new Date(now.getTime() - STAGE_3_DELAY_MS)

    // Fetch all eligible carts (stages 0–2, not recovered, updated before threshold)
    const carts = await prisma.abandonedCart.findMany({
      where: {
        recoveredAt: null,
        emailStage: { lt: 3 },
        OR: [
          { emailStage: 0, updatedAt: { lte: stage1Threshold } },
          { emailStage: 1, emailSentAt: { lte: stage2Threshold } },
          { emailStage: 2, emailSentAt: { lte: stage3Threshold } },
        ],
      },
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

      const name = cart.user?.name ?? getCustomerName(cart.userId, cart.guestEmail)
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
