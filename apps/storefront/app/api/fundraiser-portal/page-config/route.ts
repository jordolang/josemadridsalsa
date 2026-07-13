import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireFundraiserAccess, getCurrentFundraiserAccount } from '@/lib/rbac'
import { validatePageConfig } from '@/lib/fundraiser-page-config'

export async function GET() {
  try {
    await requireFundraiserAccess()
    const account = await getCurrentFundraiserAccount()
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    return NextResponse.json({
      pageConfig: account.fundraiser.pageConfig,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    await requireFundraiserAccess()
    const account = await getCurrentFundraiserAccount()
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const body = await request.json()
    const { pageConfig } = body

    const validation = validatePageConfig(pageConfig)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid page config', details: validation.error },
        { status: 400 }
      )
    }

    await prisma.fundraiser.update({
      where: { id: account.fundraiserId },
      data: { pageConfig: JSON.parse(JSON.stringify(validation.data)) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
