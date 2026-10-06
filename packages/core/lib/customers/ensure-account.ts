/**
 * Make sure the person behind a sale or a fundraiser has a customer account.
 *
 * The account page joins everything — orders, emails, chats, notes — on the customer's email.
 * Until now a `Customer` row only appeared when an admin ran the sync, so someone who had just
 * started a fundraiser or paid for an order had nowhere for their correspondence to land. This
 * is called at those two moments so the account exists from the first message onward.
 *
 * It only ever fills gaps: a name, phone or login already on the account is never overwritten,
 * and an account type is only raised from STANDARD, never lowered.
 */

import type { CustomerAccountType, CustomerSource } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export interface EnsureCustomerAccountInput {
  email: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  userId?: string | null
  source: CustomerSource
  accountType?: CustomerAccountType
}

/** "Maria de la Cruz" → first "Maria", last "de la Cruz". */
export function splitName(name: string | null | undefined): { firstName: string | null; lastName: string | null } {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  }
}

export async function ensureCustomerAccount(input: EnsureCustomerAccountInput): Promise<string | null> {
  const email = input.email.trim().toLowerCase()
  if (!email) return null

  // A login can belong to only one customer. If it is already attached elsewhere, leave it.
  const userIdFree = input.userId
    ? !(await prisma.customer.findUnique({ where: { userId: input.userId }, select: { id: true } }))
    : false

  const existing = await prisma.customer.findUnique({ where: { email } })

  if (!existing) {
    try {
      const created = await prisma.customer.create({
        data: {
          email,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          phone: input.phone ?? null,
          userId: userIdFree ? input.userId : null,
          source: input.source,
          accountType: input.accountType ?? 'STANDARD',
        },
        select: { id: true },
      })
      return created.id
    } catch {
      // Lost a race with another request creating the same email; that row is just as good.
      const raced = await prisma.customer.findUnique({ where: { email }, select: { id: true } })
      return raced?.id ?? null
    }
  }

  const data: Record<string, unknown> = {}
  if (!existing.firstName && input.firstName) data.firstName = input.firstName
  if (!existing.lastName && input.lastName) data.lastName = input.lastName
  if (!existing.phone && input.phone) data.phone = input.phone
  if (!existing.userId && userIdFree) data.userId = input.userId
  if (input.accountType && input.accountType !== 'STANDARD' && existing.accountType === 'STANDARD') {
    data.accountType = input.accountType
  }

  if (Object.keys(data).length > 0) {
    await prisma.customer.update({ where: { id: existing.id }, data })
  }
  return existing.id
}
