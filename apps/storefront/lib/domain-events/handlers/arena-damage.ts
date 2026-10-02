/**
 * Domain events → Battle Arena damage.
 *
 * A purchase from a team's shop used to be its own kind of sale: a bespoke Stripe Checkout
 * Session whose metadata the webhook read to fire `applyPurchaseDamage`. No `Order` row was
 * written, so those sales carried no shipping, no tax, no inventory movement, no commission
 * and no order history — and they priced themselves from the retail catalogue, the same
 * fallback that was quoting ten dollars and charging nine everywhere else.
 *
 * Now an arena purchase is an ordinary order that happens to deal damage. This hangs off
 * `payment.completed`, like every other consequence of a sale settling, so it fires from
 * whichever of the six payment paths got there first rather than from one provider's webhook.
 *
 * Donations are a separate thing and still settle through the Stripe metadata path: they buy
 * no goods, so they have no order to hang off.
 */
import { prisma } from '@/lib/prisma'
import { commissionBase } from '@/lib/fundraising/commission'

import { registerDomainEventHandler } from '../subscribe'
import type { DomainEventRecord } from '../subscribe'

/**
 * Deal arena damage for a paid order placed in an arena team's store.
 *
 * Replay-safe through `FundraiserSaleEvent.orderId`, which is unique: `applyPurchaseDamage`
 * returns `idempotentHit` rather than damaging twice when the same order arrives again. That
 * matters here because domain events are delivered at least once.
 *
 * The damage is sized on merchandise, not on the order total — the same figure commission is
 * taken from. Shipping is money owed to a carrier and tax is money owed to a state; letting
 * either swing a battle would mean a team in a high-tax state hit harder for the same salsa.
 */
export async function handleArenaDamage(event: DomainEventRecord): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: event.entityId },
    select: {
      id: true,
      subtotal: true,
      discountAmount: true,
      guestEmail: true,
      userId: true,
      createdAt: true,
      fundraiserId: true,
      user: { select: { name: true } },
    },
  })

  // Most orders are not fundraiser sales at all; leaving early keeps this off the general
  // checkout path.
  if (!order?.fundraiserId) return

  const team = await prisma.fundraiserTeam.findUnique({
    where: { fundraiserId: order.fundraiserId },
    select: { id: true, status: true },
  })

  // A campaign that has not been entered into the arena simply raises money.
  if (!team || team.status !== 'ACTIVE') return

  const saleAmount = commissionBase({
    subtotal: Number(order.subtotal),
    discountAmount: Number(order.discountAmount),
  })

  if (saleAmount <= 0) return

  const { applyPurchaseDamage } = await import('@/lib/arena/damage')

  await applyPurchaseDamage({
    sellingTeamId: team.id,
    saleAmount,
    placedAt: order.createdAt,
    // The order id is the idempotency key, so a replayed event lands on the sale event the
    // first delivery already wrote instead of striking every rival a second time.
    orderId: order.id,
    donor: {
      userId: order.userId,
      name: order.user?.name ?? null,
      email: order.guestEmail ?? null,
    },
  })
}

/** Subscribe to paid orders, whichever payment path produced them. */
export function registerArenaDamageHandlers(): void {
  registerDomainEventHandler('payment.completed', 'arena-damage', handleArenaDamage)
}
