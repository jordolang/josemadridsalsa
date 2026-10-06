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

/**
 * The `metadata.type` every abandoned-cart `EmailLog` row carries.
 *
 * The send path writes it and the analytics query reads it back, so it is defined once here
 * rather than spelled out at both ends where a typo would silently empty the dashboard.
 */
export const ABANDONED_CART_EMAIL_TYPE = 'abandoned_cart'

/** The last stage anyone is sent. A cart at this stage is finished with. */
export const FINAL_STAGE = 3

/**
 * Stamped on a tracked cart (`cartData.checkout`) when it will be paid for on this site's own
 * checkout — the only checkout that marks a cart recovered. Once retail sells through
 * BigCommerce, carts without it are never emailed.
 */
export const SITE_CHECKOUT = 'site'

/**
 * How long a recovery link keeps working, and therefore the only deadline the emails may
 * advertise. `app/api/cart/recover` refuses a cart older than this with a 410, so the countdown
 * in the final email is read from here rather than restated — a promise the route does not keep
 * is worse than no promise at all.
 */
export const RECOVERY_LINK_TTL_MS = 30 * 24 * HOUR_MS

/**
 * Whole hours a cart has been sitting, for the "waiting for N hours" line in stage 2.
 *
 * Measured from when the shopper last touched the cart, not from the previous email, because
 * that is what the sentence claims. Never returns 0: a cart is only mailed an hour after it was
 * abandoned, and "waiting for 0 hours" would read as a bug.
 */
export function hoursWaiting(abandonedAt: Date, now: Date): number {
  return Math.max(1, Math.round((now.getTime() - abandonedAt.getTime()) / HOUR_MS))
}

/**
 * How long is left on the recovery link, as a phrase for the final email.
 *
 * Days rather than hours: at stage 3 the link still has four weeks on it, and "expires in 668
 * hours" reads as a machine talking. Returns null once the link has expired, which lets the
 * caller leave the cart alone rather than send a deadline that has passed.
 */
export function recoveryLinkExpiresIn(cartCreatedAt: Date, now: Date): string | null {
  const msLeft = cartCreatedAt.getTime() + RECOVERY_LINK_TTL_MS - now.getTime()
  if (msLeft <= 0) return null

  const hoursLeft = Math.ceil(msLeft / HOUR_MS)
  if (hoursLeft <= 48) return hoursLeft === 1 ? '1 hour' : `${hoursLeft} hours`

  const daysLeft = Math.ceil(hoursLeft / 24)
  return daysLeft === 1 ? '1 day' : `${daysLeft} days`
}

/**
 * Carts due their next reminder.
 *
 * Each stage is keyed off a different column, which is the part worth reading twice: stage 0 has
 * never been emailed, so it measures from `updatedAt` — when the shopper last touched the cart.
 * Later stages measure from `emailSentAt`, the previous reminder. Measuring everything from
 * `updatedAt` would fire all three within the same sweep once a cart was two days old.
 */
export function abandonedCartWhere(
  now: Date,
  { siteCheckoutOnly = false }: { siteCheckoutOnly?: boolean } = {},
): Prisma.AbandonedCartWhereInput {
  const since = (stage: number) => new Date(now.getTime() - STAGE_DELAY_MS[stage])

  return {
    recoveredAt: null,
    // Once retail checks out in BigCommerce, a purchase there never marks a cart recovered
    // here, so only carts known to finish on this site's checkout may be chased.
    ...(siteCheckoutOnly ? { cartData: { path: ['checkout'], equals: SITE_CHECKOUT } } : {}),
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
