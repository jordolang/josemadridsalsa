import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { StructuredDataType } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

/**
 * Returns either a denial response to send back, or the acting user — the caller needs the
 * latter so mutations can be attributed in the audit log.
 */
async function requireSeoManage(): Promise<
  { denied: NextResponse; userId?: undefined } | { denied: null; userId: string }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { denied: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const permitted = await hasPermission(session.user as any, 'seo:manage')
  if (!permitted) {
    return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { denied: null, userId: (session.user as { id: string }).id }
}

const upsertSchema = z.object({
  entityType: z.enum(StructuredDataType),
  entityId: z.string().min(1),
  jsonLd: z
    .record(z.string(), z.unknown())
    .refine((v) => typeof v['@type'] === 'string', {
      message: 'JSON-LD must include an @type field',
    }),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await requireSeoManage()
  if (auth.denied) return auth.denied

  const entityType = request.nextUrl.searchParams.get('entityType')

  const entries = await prisma.structuredData.findMany({
    where: entityType ? { entityType: entityType as StructuredDataType } : undefined,
    orderBy: [{ entityType: 'asc' }, { updatedAt: 'desc' }],
  })

  return NextResponse.json({ entries })
}

export async function POST(request: NextRequest) {
  const auth = await requireSeoManage()
  if (auth.denied) return auth.denied

  try {
    const parsed = upsertSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid structured data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { entityType, entityId, jsonLd, isActive } = parsed.data
    const schemaType = String(jsonLd['@type'])

    const entry = await prisma.structuredData.upsert({
      where: { entityType_entityId: { entityType, entityId } },
      create: {
        entityType,
        entityId,
        schemaType,
        jsonLd: jsonLd as any,
        isActive: isActive ?? true,
      },
      update: {
        schemaType,
        jsonLd: jsonLd as any,
        ...(isActive === undefined ? {} : { isActive }),
      },
    })

    await logAuditWithRequest(
      {
        userId: auth.userId,
        action: 'update',
        entityType: 'structured_data',
        entityId: entry.id,
        changes: { entityType, entityId, schemaType, isActive: entry.isActive },
      },
      request
    )

    return NextResponse.json({ entry })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save structured data', details: String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSeoManage()
  if (auth.denied) return auth.denied

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
  }

  try {
    await prisma.structuredData.delete({ where: { id } })

    await logAuditWithRequest(
      { userId: auth.userId, action: 'delete', entityType: 'structured_data', entityId: id },
      request
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete structured data', details: String(error) },
      { status: 500 }
    )
  }
}
