/**
 * Verifying a fundraiser account: the one place that decides what approving or
 * suspending one does, shared by `/api/admin/fundraiser-accounts` and the
 * desktop admin's verification queue so the two cannot drift apart.
 *
 * Approving grants portal access, activates the campaign and stocks its store
 * from the package chosen at sign-up. Suspending revokes access and takes the
 * campaign offline. Neither writes an audit row — each caller logs in its own
 * way.
 */

import prisma from '@/lib/prisma'
import { resolveKitCatalog, shouldBlockApproval } from '@/lib/fundraising/kit-catalog.server'
import { canEraseData } from '@/lib/developer/constants'

export type AccountReviewAction = 'approve' | 'suspend'

/** A review that cannot go ahead, with the HTTP status the web route answers with. */
export class AccountReviewError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 404 | 409,
  ) {
    super(message)
    this.name = 'AccountReviewError'
  }
}

export async function reviewFundraiserAccount(accountId: string, action: AccountReviewAction, actorId: string) {
  const account = await prisma.fundraiserAccount.findUnique({
    where: { id: accountId },
    include: { fundraiser: true },
  })

  if (!account) throw new AccountReviewError('Account not found.', 404)

  // The package chosen at sign-up stocks the store, so nobody ticks salsas one by one.
  // Only on approval, and only rows that do not exist yet: a re-approval after a suspension
  // must not undo salsas an admin has since switched off.
  const kit = action === 'approve' ? await resolveKitCatalog(account.fundraiser.flavorPackage) : null
  if (kit && shouldBlockApproval(kit.missingSlugs, kit.kitSize)) {
    throw new AccountReviewError(
      `These ${account.fundraiser.flavorPackage}-flavor kit salsas have no active product: ${kit.missingSlugs.join(', ')}`,
      409,
    )
  }

  if (action === 'approve' && kit) {
    await prisma.$transaction([
      prisma.fundraiserAccount.update({
        where: { id: accountId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: actorId,
        },
      }),
      // Activate the linked fundraiser when account is approved
      prisma.fundraiser.update({
        where: { id: account.fundraiserId },
        data: { status: 'ACTIVE', isActive: true },
      }),
      prisma.fundraiserProduct.createMany({
        data: kit.catalog.map((row) => ({ ...row, fundraiserId: account.fundraiserId })),
        skipDuplicates: true,
      }),
    ])
  } else if (action === 'suspend') {
    await prisma.$transaction([
      prisma.fundraiserAccount.update({
        where: { id: accountId },
        data: { status: 'SUSPENDED' },
      }),
      prisma.fundraiser.update({
        where: { id: account.fundraiserId },
        data: { isActive: false },
      }),
    ])
  }

  return { account, kit }
}

/**
 * Throws away a sign-up nobody should review again — spam, mostly. The login,
 * the draft campaign and the account behind them are deleted, so the address
 * can sign up afresh and the queue no longer carries it.
 *
 * Deleting a User is held to the owner accounts everywhere else in the admin
 * (`canEraseData`), so it is here too. And only for sign-ups that never went
 * live: an account that was ever approved, or a campaign or login that has
 * taken an order, is suspended instead, so no sale loses the records it points
 * at. The checks run inside the transaction that deletes, so an order placed in
 * between cannot slip past them.
 */
export async function denyFundraiserAccount(accountId: string, actorEmail: string | null | undefined) {
  if (!canEraseData(actorEmail)) {
    throw new AccountReviewError('Only an owner account can deny a sign-up, because it deletes the login.', 403)
  }

  return prisma.$transaction(async (tx) => {
    const account = await tx.fundraiserAccount.findUnique({
      where: { id: accountId },
      include: {
        fundraiser: { select: { id: true, name: true, _count: { select: { orders: true } } } },
        user: { select: { id: true, email: true, role: true, _count: { select: { orders: true } } } },
      },
    })

    if (!account) throw new AccountReviewError('Account not found.', 404)

    if (account.status === 'APPROVED' || account.approvedAt) {
      throw new AccountReviewError(`${account.fundraiser.name} has been approved before, so suspend it instead.`, 409)
    }
    if (account.user.role !== 'FUNDRAISER') {
      throw new AccountReviewError(`${account.user.email} is not a fundraiser-only login, so suspend it instead.`, 409)
    }
    if (account.fundraiser._count.orders > 0 || account.user._count.orders > 0) {
      throw new AccountReviewError(`${account.fundraiser.name} has orders, so suspend it instead.`, 409)
    }

    // Both deletes cascade to the account row.
    await tx.fundraiser.delete({ where: { id: account.fundraiserId } })
    await tx.user.delete({ where: { id: account.userId } })

    return { name: account.fundraiser.name, email: account.user.email }
  })
}
