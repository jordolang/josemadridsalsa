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

export type AccountReviewAction = 'approve' | 'suspend'

/** A review that cannot go ahead, with the HTTP status the web route answers with. */
export class AccountReviewError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409,
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
