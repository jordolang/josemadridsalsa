/**
 * Which abandoned carts are due their next reminder, and what that reminder says.
 *
 * Extracted from `app/api/cron/abandoned-cart` so the stage progression and the cart-total
 * formatting can be tested. The sequence spends real goodwill — three emails to someone who did
 * not buy — and every part of it that could go wrong (sending the wrong stage, sending twice,
 * putting "your items" where a price should be) was unreachable from a test while it lived in
 * the route.
 */
import type { Prisma } from '@prisma/client'

const HOUR_MS = 60 * 60 * 1000

/**
 * How long after the previous step each reminder waits.
 *
 * Indexed by the stage about to be sent, so `STAGE_DELAY_MS[1]` is the wait before the first
 * email. Index 0 is unused and present only to keep stage numbers and array positions aligned —
 * an off-by-one here sends the "last chance" copy an hour after abandonment.
 */
export const STAGE_DELAY_MS = [0, 1 * HOUR_MS, 24 * HOUR_MS, 48 * HOUR_MS]

/** The last stage anyone is sent. A cart at this stage is finished with. */
export const FINAL_STAGE = 3

export const STAGE_SUBJECTS = [
  '',
  'You left something behind 🌶️',
  'Your salsa is still waiting for you',
  'Last chance — your cart expires soon',
]

export const STAGE_INTROS = [
  '',
  "We noticed you left some items in your cart. Your taste in salsa is excellent — we'd hate for you to miss out!",
  "Your cart is still here! Don't let your favorite salsas slip away.",
  'This is your final reminder. Your cart will expire soon — complete your order today and save your selections.',
]

/**
 * Carts due their next reminder.
 *
 * Each stage is keyed off a different column, which is the part worth reading twice: stage 0 has
 * never been emailed, so it measures from `updatedAt` — when the shopper last touched the cart.
 * Later stages measure from `emailSentAt`, the previous reminder. Measuring everything from
 * `updatedAt` would fire all three within the same sweep once a cart was two days old.
 */
export function abandonedCartWhere(now: Date): Prisma.AbandonedCartWhereInput {
  const since = (stage: number) => new Date(now.getTime() - STAGE_DELAY_MS[stage])

  return {
    recoveredAt: null,
    emailStage: { lt: FINAL_STAGE },
    OR: [
      { emailStage: 0, updatedAt: { lte: since(1) } },
      { emailStage: 1, emailSentAt: { lte: since(2) } },
      { emailStage: 2, emailSentAt: { lte: since(3) } },
    ],
  }
}

interface CartItem {
  name?: string
  productName?: string
  quantity?: number
  price?: number
  totalPrice?: number
}

/**
 * Render the cart's value for the email.
 *
 * Returns the phrase "your items" rather than `$0.00` or `$NaN` when the total cannot be
 * determined. Cart JSON is a stored blob from whatever the storefront wrote at the time, so its
 * shape is not guaranteed across versions, and a wrong price in a marketing email is worse than
 * a vague one.
 */
export function formatCartTotal(cartData: unknown): string {
  try {
    const data = cartData as { items?: CartItem[]; total?: number } | null
    if (data?.total) return `$${Number(data.total).toFixed(2)}`

    if (data?.items?.length) {
      const total = data.items.reduce(
        (sum, item) => sum + (item.totalPrice ?? item.price ?? 0) * (item.quantity ?? 1),
        0
      )
      if (total > 0) return `$${total.toFixed(2)}`
    }

    return 'your items'
  } catch {
    return 'your items'
  }
}

/**
 * A name to greet the shopper by.
 *
 * The local part of an email address is a poor name but a better greeting than "there" — most
 * of these read as a first name, and the alternative is an obviously untargeted mail.
 */
export function customerName(
  userName: string | null | undefined,
  guestEmail: string | null | undefined
): string {
  if (userName) return userName
  if (guestEmail) return guestEmail.split('@')[0]
  return 'there'
}

/** Subject and intro for a stage, falling back rather than rendering an empty subject line. */
export function stageCopy(stage: number): { subject: string; intro: string } {
  return {
    subject: STAGE_SUBJECTS[stage] || STAGE_SUBJECTS[1],
    intro: STAGE_INTROS[stage] ?? '',
  }
}
