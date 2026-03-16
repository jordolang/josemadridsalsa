import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { FundraiserAccountStatus } from '@prisma/client'
import { requirePermission } from '@/lib/rbac'


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
        fundraiser: { select: { id: true, name: true, organizationName: true, slug: true, subdomain: true, status: true } },
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

    const account = await prisma.fundraiserAccount.findUnique({
      where: { id: accountId },
      include: { fundraiser: true },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    }

    if (action === 'approve') {
      await prisma.$transaction([
        prisma.fundraiserAccount.update({
          where: { id: accountId },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedBy: user.id,
          },
        }),
        // Activate the linked fundraiser when account is approved
        prisma.fundraiser.update({
          where: { id: account.fundraiserId },
          data: { status: 'ACTIVE', isActive: true },
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating fundraiser account:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
