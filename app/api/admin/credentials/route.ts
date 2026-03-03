import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireCredentialAccess } from '@/lib/credentials-access'
import { encryptValue, decryptValue } from '@/lib/credentials-crypto'
import { ok, fail, forbidden, unauthorized, serverError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const credentialSchema = z.object({
  serviceName: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
  username: z.string().max(500).nullable().optional(),
  value: z.string().min(1), // plaintext — will be encrypted before storage
  url: z.string().url().max(2000).nullable().optional().or(z.literal('')),
  notes: z.string().max(5000).nullable().optional(),
})

export async function GET() {
  try {
    const user = await requireCredentialAccess()
    if (!user) return forbidden('Not Permitted')

    const credentials = await prisma.serviceCredential.findMany({
      orderBy: [{ serviceName: 'asc' }, { label: 'asc' }],
    })

    const decrypted = credentials.map((c) => {
      try {
        return {
          id: c.id,
          serviceName: c.serviceName,
          label: c.label,
          username: c.username,
          value: decryptValue(c.encValue, c.encIv, c.encTag),
          url: c.url,
          notes: c.notes,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }
      } catch {
        return {
          id: c.id,
          serviceName: c.serviceName,
          label: c.label,
          username: c.username,
          value: '[DECRYPTION ERROR]',
          url: c.url,
          notes: c.notes,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }
      }
    })

    return ok({ credentials: decrypted })
  } catch (error: any) {
    console.error('[Credentials API] GET error:', error)
    return serverError('Failed to load credentials')
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCredentialAccess()
    if (!user) return forbidden('Not Permitted')

    const body = await req.json()
    const data = credentialSchema.parse(body)

    const { encValue, encIv, encTag } = encryptValue(data.value)

    const credential = await prisma.serviceCredential.create({
      data: {
        serviceName: data.serviceName,
        label: data.label,
        username: data.username ?? null,
        encValue,
        encIv,
        encTag,
        url: data.url || null,
        notes: data.notes ?? null,
        createdById: user.id,
      },
    })

    await logAudit({
      userId: user.id,
      action: 'CREATE',
      entityType: 'ServiceCredential',
      entityId: credential.id,
      changes: { serviceName: data.serviceName, label: data.label },
    })

    return ok(
      {
        credential: {
          id: credential.id,
          serviceName: credential.serviceName,
          label: credential.label,
          username: credential.username,
          value: data.value,
          url: credential.url,
          notes: credential.notes,
          createdAt: credential.createdAt,
          updatedAt: credential.updatedAt,
        },
      },
      201
    )
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail('Validation error: ' + error.errors.map((e: any) => e.message).join(', '), 400)
    }
    console.error('[Credentials API] POST error:', error)
    return serverError('Failed to create credential')
  }
}
