import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { logAudit, logAuditWithRequest } from '@/lib/audit'
import { z } from 'zod'

const compositionSchema = z.object({
  blocks: z.array(z.any()), // Array of email blocks
  globalStyles: z.record(z.string(), z.any()).optional(), // Global styling configuration
})

// GET - Fetch composition for a template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()

    if (!user || !(await hasAnyPermission(user, ['content:read']))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const composition = await prisma.emailTemplateComposition.findUnique({
      where: { templateId: id },
      include: {
        template: {
          select: {
            id: true,
            key: true,
            name: true,
            subject: true,
          },
        },
      },
    })

    if (!composition) {
      return NextResponse.json(
        { error: 'Composition not found' },
        { status: 404 }
      )
    }

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'email_template_composition',
        entityId: composition.id,
        changes: { templateId: id },
      },
      request
    )

    return NextResponse.json({ composition })
  } catch (error) {
    console.error('Error fetching composition:', error)
    return NextResponse.json(
      { error: 'Failed to fetch composition' },
      { status: 500 }
    )
  }
}

// POST - Create composition for a template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()

    if (!user || !(await hasAnyPermission(user, ['content:write']))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = compositionSchema.parse(body)

    // Check if composition already exists
    const existingComposition = await prisma.emailTemplateComposition.findUnique({
      where: { templateId: id },
    })

    if (existingComposition) {
      return NextResponse.json(
        { error: 'Composition already exists for this template' },
        { status: 409 }
      )
    }

    // Create new composition
    const composition = await prisma.emailTemplateComposition.create({
      data: {
        templateId: id,
        blocks: validatedData.blocks,
        globalStyles: validatedData.globalStyles || {},
        version: 1,
      },
      include: {
        template: {
          select: {
            id: true,
            key: true,
            name: true,
            subject: true,
          },
        },
      },
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'create',
        entityType: 'email_template_composition',
        entityId: composition.id,
        changes: { templateId: id },
      },
      request
    )

    return NextResponse.json({ composition }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid composition data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating composition:', error)
    return NextResponse.json(
      { error: 'Failed to create composition' },
      { status: 500 }
    )
  }
}

// PUT - Update composition for a template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()

    if (!user || !(await hasAnyPermission(user, ['content:write']))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = compositionSchema.parse(body)

    // Update composition
    const composition = await prisma.emailTemplateComposition.update({
      where: { templateId: id },
      data: {
        blocks: validatedData.blocks,
        globalStyles: validatedData.globalStyles || {},
        version: {
          increment: 1,
        },
        updatedAt: new Date(),
      },
      include: {
        template: {
          select: {
            id: true,
            key: true,
            name: true,
            subject: true,
          },
        },
      },
    })

    return NextResponse.json({ composition })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid composition data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating composition:', error)
    return NextResponse.json(
      { error: 'Failed to update composition' },
      { status: 500 }
    )
  }
}

// DELETE - Remove composition for a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()

    if (!user || !(await hasAnyPermission(user, ['content:write']))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.emailTemplateComposition.delete({
      where: { templateId: id },
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'delete',
        entityType: 'email_template_composition',
        entityId: id,
      },
      request
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting composition:', error)
    return NextResponse.json(
      { error: 'Failed to delete composition' },
      { status: 500 }
    )
  }
}
