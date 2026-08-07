import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { SuppressionReason } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const reason = searchParams.get('reason') || undefined

    const where = {
      ...(search ? { email: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(reason ? { reason: reason as SuppressionReason } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.emailSuppression.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailSuppression.count({ where }),
    ])

    return NextResponse.json({ items, total, page, limit })
  } catch (error) {
    console.error('Suppression list error:', error)
    return NextResponse.json({ error: 'Failed to fetch suppressions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as { email: string; reason: SuppressionReason; notes?: string }
    const { email, reason, notes } = body

    if (!email || !reason) {
      return NextResponse.json({ error: 'Email and reason are required' }, { status: 400 })
    }

    const suppression = await prisma.emailSuppression.upsert({
      where: { email: email.toLowerCase().trim() },
      create: {
        email: email.toLowerCase().trim(),
        reason,
        notes,
        source: 'manual',
      },
      update: { reason, notes },
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'create',
        entityType: 'email_suppression',
        entityId: suppression.id,
        changes: { email: suppression.email, reason, notes },
      },
      request
    )

    return NextResponse.json({ success: true, suppression })
  } catch (error) {
    console.error('Add suppression error:', error)
    return NextResponse.json({ error: 'Failed to add suppression' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    await prisma.emailSuppression.delete({ where: { email } })

    // Removing a suppression makes a previously blocked address mailable again, so it is
    // recorded against the admin who lifted it.
    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'delete',
        entityType: 'email_suppression',
        entityId: email,
        changes: { email },
      },
      request
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete suppression error:', error)
    return NextResponse.json({ error: 'Failed to delete suppression' }, { status: 500 })
  }
}
