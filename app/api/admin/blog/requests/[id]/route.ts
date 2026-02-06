import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'

/**
 * PATCH /api/admin/blog/requests/[id]
 * Approve or reject a blog access request
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('content:write')
    const { id } = await params
    const body = await req.json()
    const { status, reviewNotes } = body

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return fail('Status must be APPROVED or REJECTED', 400)
    }

    const existing = await prisma.blogAccessRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return fail('Blog access request not found', 404)
    }

    const updated = await prisma.blogAccessRequest.update({
      where: { id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy: user.id,
        reviewNotes: reviewNotes || null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    await logAudit({
      userId: user.id,
      action: status === 'APPROVED' ? 'blog_access.approve' : 'blog_access.reject',
      entityType: 'BlogAccessRequest',
      entityId: id,
      changes: { status, reviewNotes, applicantEmail: updated.user.email },
    })

    return ok({ request: updated })
  } catch (error: any) {
    return fail(error.message, error.status || 500)
  }
}
