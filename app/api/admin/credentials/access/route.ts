import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { isSuperAdmin } from '@/lib/credentials'
import { z } from 'zod'

const grantSchema = z.object({
  email: z.string().email('Valid email required'),
  canView: z.boolean().default(true),
  canAdd: z.boolean().default(false),
  canEdit: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canUpload: z.boolean().default(false),
})

const revokeSchema = z.object({
  email: z.string().email('Valid email required'),
})

export async function GET(req: NextRequest) {
  try {
    const currentUser = await requirePermission('credentials:read')

    if (!isSuperAdmin(currentUser.email)) {
      return fail('Forbidden - super admin only', 403)
    }

    const grants = await prisma.credentialAccessGrant.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return ok({ grants })
  } catch (error: any) {
    return fail(error.message, error.status)
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requirePermission('credentials:write')

    if (!isSuperAdmin(currentUser.email)) {
      return fail('Forbidden - super admin only', 403)
    }

    const body = await req.json()
    const data = grantSchema.parse(body)

    // Check if grant already exists
    const existing = await prisma.credentialAccessGrant.findUnique({
      where: { email: data.email },
    })

    let grant
    if (existing) {
      // Update existing grant (reactivate if revoked)
      grant = await prisma.credentialAccessGrant.update({
        where: { email: data.email },
        data: {
          canView: data.canView,
          canAdd: data.canAdd,
          canEdit: data.canEdit,
          canDelete: data.canDelete,
          canUpload: data.canUpload,
          revokedAt: null,
          grantedByEmail: currentUser.email,
        },
      })
    } else {
      grant = await prisma.credentialAccessGrant.create({
        data: {
          email: data.email,
          grantedByEmail: currentUser.email,
          canView: data.canView,
          canAdd: data.canAdd,
          canEdit: data.canEdit,
          canDelete: data.canDelete,
          canUpload: data.canUpload,
        },
      })
    }

    await logAudit({
      userId: currentUser.id,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'CredentialAccessGrant',
      entityId: grant.id,
      changes: {
        email: data.email,
        canView: data.canView,
        canAdd: data.canAdd,
        canEdit: data.canEdit,
        canDelete: data.canDelete,
        canUpload: data.canUpload,
      },
    })

    return ok({ grant }, existing ? 200 : 201)
  } catch (error: any) {
    return fail(error.message, 400)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await requirePermission('credentials:write')

    if (!isSuperAdmin(currentUser.email)) {
      return fail('Forbidden - super admin only', 403)
    }

    const body = await req.json()
    const data = revokeSchema.parse(body)

    const existing = await prisma.credentialAccessGrant.findUnique({
      where: { email: data.email },
    })

    if (!existing) {
      return fail('Grant not found', 404)
    }

    const grant = await prisma.credentialAccessGrant.update({
      where: { email: data.email },
      data: { revokedAt: new Date() },
    })

    await logAudit({
      userId: currentUser.id,
      action: 'REVOKE',
      entityType: 'CredentialAccessGrant',
      entityId: grant.id,
      changes: { email: data.email },
    })

    return ok({ grant })
  } catch (error: any) {
    return fail(error.message, 400)
  }
}
