import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { FundraiserAccountStatus } from '@prisma/client'
import { requirePermission } from '@/lib/rbac'
import { createChangeSnapshot, logAuditWithRequest } from '@/lib/audit'
import { AccountReviewError, denyFundraiserAccount, reviewFundraiserAccount } from '@/lib/fundraising/account-review'


export async function GET(request: NextRequest) {
  try {
    await requirePermission('orders:write')

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')

    const validStatus = z.enum(['PENDING', 'APPROVED', 'SUSPENDED']).safeParse(status)
    const where = validStatus.success ? { status: validStatus.data as FundraiserAccountStatus } : {}

    const accounts = await prisma.fundraiserAccount.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        fundraiser: { select: { id: true, name: true, organizationName: true, slug: true, subdomain: true, status: true, flavorPackage: true, fulfillmentMethod: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Error fetching fundraiser accounts:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

const UpdateSchema = z.object({
  accountId: z.string(),
  action: z.enum(['approve', 'suspend']),
})

export async function PATCH(request: Request) {
  try {
    const user = await requirePermission('orders:write')
    const body = await request.json()
    const parsed = UpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data.', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { accountId, action } = parsed.data

    const { account, kit } = await reviewFundraiserAccount(accountId, action, user.id)

    // Approving grants portal access and activates the campaign; suspending revokes both.
    await logAuditWithRequest(
      {
        userId: user.id,
        action,
        entityType: 'fundraiser_account',
        entityId: accountId,
        changes: {
          status: { from: account.status, to: action === 'approve' ? 'APPROVED' : 'SUSPENDED' },
          fundraiserId: account.fundraiserId,
          ...(kit && {
            flavorPackage: account.fundraiser.flavorPackage,
            productsEnabled: kit.catalog.length,
            missingSlugs: kit.missingSlugs,
          }),
        },
      },
      request
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AccountReviewError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error updating fundraiser account:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

const DenySchema = z.object({ accountId: z.string().min(1) })

/** Denies a never-approved sign-up as spam: its login, draft campaign and account are deleted. */
export async function DELETE(request: Request) {
  try {
    const user = await requirePermission('orders:write')
    const parsed = DenySchema.safeParse(await request.json().catch(() => null))

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data.', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { accountId } = parsed.data
    const denied = await denyFundraiserAccount(accountId, user.email)

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'delete',
        entityType: 'fundraiser_account',
        entityId: accountId,
        changes: { deniedAsSpam: true, fundraiser: denied.name, email: denied.email },
      },
      request
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AccountReviewError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error denying fundraiser account:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
