import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const automations = await prisma.emailAutomation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        steps: { orderBy: { order: 'asc' } },
        _count: { select: { enrollments: true, logs: true } },
      },
    })

    return NextResponse.json({ automations })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, trigger, conditions, stopConditions, steps } = body

    if (!name || !trigger) {
      return NextResponse.json({ error: 'Name and trigger are required' }, { status: 400 })
    }

    const automation = await prisma.emailAutomation.create({
      data: {
        name,
        description,
        trigger,
        conditions: conditions ?? null,
        stopConditions: stopConditions ?? null,
        createdById: user.id,
        steps: steps
          ? {
              create: (steps as { templateId?: string; delayHours?: number; subject?: string; previewText?: string }[]).map(
                (step, index) => ({
                  order: index,
                  templateId: step.templateId ?? null,
                  delayHours: step.delayHours ?? 0,
                  subject: step.subject ?? null,
                  previewText: step.previewText ?? null,
                })
              ),
            }
          : undefined,
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json({ success: true, automation }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create automation' }, { status: 500 })
  }
}
