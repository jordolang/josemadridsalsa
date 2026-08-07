import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createChangeSnapshot, logAuditWithRequest } from '@/lib/audit'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'settings:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const brandKit = await prisma.brandKit.findFirst()
    return NextResponse.json({ brandKit })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch brand kit' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'settings:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const existing = await prisma.brandKit.findFirst()
    const brandKit = existing
      ? await prisma.brandKit.update({ where: { id: existing.id }, data: body })
      : await prisma.brandKit.create({ data: body })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: existing ? 'update' : 'create',
        entityType: 'brand_kit',
        entityId: brandKit.id,
        changes: createChangeSnapshot(existing, body),
      },
      request
    )

    return NextResponse.json({ success: true, brandKit })
  } catch {
    return NextResponse.json({ error: 'Failed to save brand kit' }, { status: 500 })
  }
}
