import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireCredentialAccess } from '@/lib/credentials-access'
import { encryptValue, decryptValue } from '@/lib/credentials-crypto'
import { ok, fail, forbidden, notFound, serverError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const updateSchema = z.object({
  serviceName: z.string().min(1).max(200).optional(),
  label: z.string().min(1).max(200).optional(),
  username: z.string().max(500).nullable().optional(),
  value: z.string().min(1).optional(), // if provided, re-encrypt
  url: z.string().url().max(2000).nullable().optional().or(z.literal('')),
  notes: z.string().max(5000).nullable().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireCredentialAccess()
    if (!user) return forbidden('Not Permitted')

    const { id } = params
    const credential = await prisma.serviceCredential.findUnique({ where: { id } })
    if (!credential) return notFound('Credential not found')

    let value: string
    try {
      value = decryptValue(credential.encValue, credential.encIv, credential.encTag)
    } catch {
      value = '[DECRYPTION ERROR]'
    }

    return ok({
      credential: {
        id: credential.id,
        serviceName: credential.serviceName,
        label: credential.label,
        username: credential.username,
        value,
        url: credential.url,
        notes: credential.notes,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      },
    })
  } catch (error: any) {
    console.error('[Credentials API] GET [id] error:', error)
    return serverError('Failed to load credential')
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireCredentialAccess()
    if (!user) return forbidden('Not Permitted')

    const { id } = params
    const existing = await prisma.serviceCredential.findUnique({ where: { id } })
    if (!existing) return notFound('Credential not found')

    const body = await req.json()
    const data = updateSchema.parse(body)

    const updateData: any = {
      updatedById: user.id,
    }

    if (data.serviceName !== undefined) updateData.serviceName = data.serviceName
    if (data.label !== undefined) updateData.label = data.label
    if (data.username !== undefined) updateData.username = data.username
    if (data.url !== undefined) updateData.url = data.url || null
    if (data.notes !== undefined) updateData.notes = data.notes

    if (data.value) {
      const { encValue, encIv, encTag } = encryptValue(data.value)
      updateData.encValue = encValue
      updateData.encIv = encIv
      updateData.encTag = encTag
    }

    const updated = await prisma.serviceCredential.update({
      where: { id },
      data: updateData,
    })

    await logAudit({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'ServiceCredential',
      entityId: id,
      changes: { fields: Object.keys(data).filter((k) => k !== 'value') },
    })

    let value: string
    try {
      value = decryptValue(updated.encValue, updated.encIv, updated.encTag)
    } catch {
      value = '[DECRYPTION ERROR]'
    }

    return ok({
      credential: {
        id: updated.id,
        serviceName: updated.serviceName,
        label: updated.label,
        username: updated.username,
        value,
        url: updated.url,
        notes: updated.notes,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail('Validation error: ' + error.errors.map((e: any) => e.message).join(', '), 400)
    }
    console.error('[Credentials API] PUT error:', error)
    return serverError('Failed to update credential')
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireCredentialAccess()
    if (!user) return forbidden('Not Permitted')

    const { id } = params
    const existing = await prisma.serviceCredential.findUnique({ where: { id } })
    if (!existing) return notFound('Credential not found')

    await prisma.serviceCredential.delete({ where: { id } })

    await logAudit({
      userId: user.id,
      action: 'DELETE',
      entityType: 'ServiceCredential',
      entityId: id,
      changes: { serviceName: existing.serviceName, label: existing.label },
    })

    return ok({ success: true })
  } catch (error: any) {
    console.error('[Credentials API] DELETE error:', error)
    return serverError('Failed to delete credential')
  }
}
