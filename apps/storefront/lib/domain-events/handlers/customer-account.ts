/**
 * Domain events → a customer account for everyone who actually buys.
 *
 * Fires on the same two facts the order confirmation does, and for the same reason: an order
 * opened on the website is not a purchase until `payment.completed`, while one an admin records
 * by hand is final the moment it is written. Abandoned checkouts therefore never create an
 * account. `ensureCustomerAccount` is idempotent, so repeated delivery is harmless.
 */
import { ensureCustomerAccount, splitName } from '@/lib/customers/ensure-account'
import { prisma } from '@/lib/prisma'

import { registerDomainEventHandler } from '../subscribe'
import type { DomainEventRecord } from '../subscribe'
import { FINAL_AT_CREATION } from './order-confirmation'

export async function handleCustomerAccount(event: DomainEventRecord): Promise<void> {
  if (event.entityType !== 'order') return

  const order = await prisma.order.findUnique({
    where: { id: event.entityId },
    select: {
      userId: true,
      guestEmail: true,
      guestPhone: true,
      salesChannel: true,
      user: { select: { email: true, name: true, phone: true } },
    },
  })
  if (!order) return

  if (event.type === 'order.created' && !FINAL_AT_CREATION.includes(order.salesChannel)) return

  const email = order.user?.email ?? order.guestEmail
  if (!email) return

  await ensureCustomerAccount({
    email,
    ...splitName(order.user?.name),
    phone: order.user?.phone ?? order.guestPhone,
    userId: order.userId,
    source: order.userId ? 'REGISTERED' : 'GUEST_ORDER',
  })
}

export function registerCustomerAccountHandlers(): void {
  registerDomainEventHandler('payment.completed', 'customer-account', handleCustomerAccount)
  registerDomainEventHandler('order.created', 'customer-account', handleCustomerAccount)
}
