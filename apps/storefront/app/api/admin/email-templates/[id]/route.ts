import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'

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
    const { name, subject, html, text, isActive } = body

    const template = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name,
        subject,
        html,
        text,
        isActive,
      },
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'email_template',
        entityId: id,
        changes: { name, subject, isActive },
      },
      request
    )

    return NextResponse.json({ success: true, template })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

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

    await prisma.emailTemplate.delete({
      where: { id },
    })

    // Logged after the delete commits, so a failed delete leaves no entry claiming the
    // template is gone.
    await logAuditWithRequest(
      { userId: user.id, action: 'delete', entityType: 'email_template', entityId: id },
      request
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
