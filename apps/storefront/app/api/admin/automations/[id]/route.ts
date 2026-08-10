import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const automation = await prisma.emailAutomation.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: 'asc' } },
        _count: { select: { enrollments: true, logs: true } },
      },
    })

    if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ automation })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch automation' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, isActive, conditions, stopConditions, steps } = body

    await prisma.$transaction(async (tx) => {
      await tx.emailAutomation.update({
        where: { id },
        data: { name, description, isActive, conditions, stopConditions },
      })

      if (steps !== undefined) {
        await tx.automationStep.deleteMany({ where: { automationId: id } })
        if ((steps as unknown[]).length > 0) {
          await tx.automationStep.createMany({
            data: (steps as { templateId?: string; delayHours?: number; subject?: string; previewText?: string }[]).map(
              (step, index) => ({
                automationId: id,
                order: index,
                templateId: step.templateId ?? null,
                delayHours: step.delayHours ?? 0,
                subject: step.subject ?? null,
                previewText: step.previewText ?? null,
              })
            ),
          })
        }
      }
    })

    const updated = await prisma.emailAutomation.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: 'asc' } } },
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'email_automation',
        entityId: id,
        changes: { name: updated?.name, isActive: updated?.isActive, trigger: updated?.trigger },
      },
      request
    )

    return NextResponse.json({ success: true, automation: updated })
  } catch {
    return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.emailAutomation.delete({ where: { id } })

    await logAuditWithRequest(
      { userId: user.id, action: 'delete', entityType: 'email_automation', entityId: id },
      request
    )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 })
  }
}
