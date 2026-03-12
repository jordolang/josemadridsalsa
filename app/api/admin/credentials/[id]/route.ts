import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { checkCredentialAccess, encryptCredentialPassword } from '@/lib/credentials'
import { z } from 'zod'

const credentialUpdateSchema = z.object({
  serviceName: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  username: z.string().nullable().optional(),
  password: z.string().optional(),
  url: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requirePermission('credentials:read')

    const accessLevel = await checkCredentialAccess(currentUser.email, currentUser.role)
    if (!accessLevel) {
      return fail('Forbidden - no credential access grant', 403)
    }

    const { id } = await params

    const credential = await prisma.serviceCredential.findUnique({
      where: { id },
      select: {
        id: true,
        serviceName: true,
        label: true,
        username: true,
        url: true,
        notes: true,
        createdById: true,
        updatedById: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!credential) return fail('Credential not found', 404)

    return ok({
      credential: {
        ...credential,
        password: '••••••••',
        accessLevel,
      },
    })
  } catch (error: any) {
    return fail(error.message, error.status)
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requirePermission('credentials:write')

    const accessLevel = await checkCredentialAccess(currentUser.email, currentUser.role)
    if (accessLevel !== 'write') {
      return fail('Forbidden - write access required', 403)
    }

    const { id } = await params
    const body = await req.json()
    const data = credentialUpdateSchema.parse(body)

    const existing = await prisma.serviceCredential.findUnique({ where: { id } })
    if (!existing) return fail('Credential not found', 404)

    // Optimistic locking: check updatedAt matches
    if (data.updatedAt) {
      const clientUpdatedAt = new Date(data.updatedAt).getTime()
      const serverUpdatedAt = existing.updatedAt.getTime()
      if (clientUpdatedAt !== serverUpdatedAt) {
        return fail('Credential was modified by another user. Please refresh and try again.', 409)
      }
    }

    const updateData: any = {
      updatedById: currentUser.id,
    }

    if (data.serviceName !== undefined) updateData.serviceName = data.serviceName
    if (data.label !== undefined) updateData.label = data.label
    if (data.username !== undefined) updateData.username = data.username
    if (data.url !== undefined) updateData.url = data.url
    if (data.notes !== undefined) updateData.notes = data.notes

    // Re-encrypt password only if provided
    if (data.password) {
      const encFields = encryptCredentialPassword(data.password)
      updateData.encValue = encFields.encValue
      updateData.encIv = encFields.encIv
      updateData.encTag = encFields.encTag
    }

    const credential = await prisma.serviceCredential.update({
      where: { id },
      data: updateData,
    })

    await logAudit({
      userId: currentUser.id,
      action: 'UPDATE',
      entityType: 'ServiceCredential',
      entityId: credential.id,
      changes: {
        serviceName: data.serviceName,
        label: data.label,
        username: data.username,
        url: data.url,
        hasPasswordChange: !!data.password,
      },
    })

    return ok({
      credential: {
        id: credential.id,
        serviceName: credential.serviceName,
        label: credential.label,
        username: credential.username,
        password: '••••••••',
        url: credential.url,
        notes: credential.notes,
        createdById: credential.createdById,
        updatedById: credential.updatedById,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      },
    })
  } catch (error: any) {
    return fail(error.message, 400)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requirePermission('credentials:write')

    const accessLevel = await checkCredentialAccess(currentUser.email, currentUser.role)
    if (accessLevel !== 'write') {
      return fail('Forbidden - write access required', 403)
    }

    const { id } = await params

    const existing = await prisma.serviceCredential.findUnique({ where: { id } })
    if (!existing) return fail('Credential not found', 404)

    await prisma.serviceCredential.delete({ where: { id } })

    await logAudit({
      userId: currentUser.id,
      action: 'DELETE',
      entityType: 'ServiceCredential',
      entityId: id,
      changes: {
        serviceName: existing.serviceName,
        label: existing.label,
      },
    })

    return ok({ message: 'Credential deleted' })
  } catch (error: any) {
    return fail(error.message, 400)
  }
}
