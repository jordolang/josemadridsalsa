import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, parsePagination, parseSearch } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { checkCredentialAccess, encryptCredentialPassword } from '@/lib/credentials'
import { z } from 'zod'

const credentialSchema = z.object({
  serviceName: z.string().min(1, 'Service name is required'),
  label: z.string().min(1, 'Label is required'),
  username: z.string().optional(),
  password: z.string().optional(),
  url: z.string().url().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const currentUser = await requirePermission('credentials:read')

    const accessLevel = await checkCredentialAccess(currentUser.email, currentUser.role)
    if (!accessLevel) {
      return fail('Forbidden - no credential access grant', 403)
    }

    const { page, limit, skip } = parsePagination(req)
    const search = parseSearch(req)

    const where: any = {}

    if (search) {
      where.OR = [
        { serviceName: { contains: search, mode: 'insensitive' } },
        { label: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [credentials, total] = await Promise.all([
      prisma.serviceCredential.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          serviceName: true,
          label: true,
          username: true,
          encValue: true,
          url: true,
          notes: true,
          createdById: true,
          updatedById: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.serviceCredential.count({ where }),
    ])

    const masked = credentials.map(({ encValue, ...c }) => ({
      ...c,
      password: '••••••••',
      hasPassword: encValue !== '',
      accessLevel,
    }))

    return ok({ credentials: masked, total })
  } catch (error: any) {
    return fail(error.message, error.status)
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requirePermission('credentials:write')

    const accessLevel = await checkCredentialAccess(currentUser.email, currentUser.role)
    if (accessLevel !== 'write') {
      return fail('Forbidden - write access required', 403)
    }

    const body = await req.json()
    const data = credentialSchema.parse(body)

    const encFields = data.password
      ? encryptCredentialPassword(data.password)
      : { encValue: '', encIv: '', encTag: '' }

    const credential = await prisma.serviceCredential.create({
      data: {
        serviceName: data.serviceName,
        label: data.label,
        username: data.username || null,
        encValue: encFields.encValue,
        encIv: encFields.encIv,
        encTag: encFields.encTag,
        url: data.url || null,
        notes: data.notes || null,
        createdById: currentUser.id,
      },
    })

    await logAudit({
      userId: currentUser.id,
      action: 'CREATE',
      entityType: 'ServiceCredential',
      entityId: credential.id,
      changes: {
        serviceName: data.serviceName,
        label: data.label,
        username: data.username || null,
        url: data.url || null,
        hasPassword: !!data.password,
      },
    })

    return ok(
      {
        credential: {
          id: credential.id,
          serviceName: credential.serviceName,
          label: credential.label,
          username: credential.username,
          password: '••••••••',
          url: credential.url,
          notes: credential.notes,
          createdAt: credential.createdAt,
          updatedAt: credential.updatedAt,
        },
      },
      201
    )
  } catch (error: any) {
    return fail(error.message, 400)
  }
}
