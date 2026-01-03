import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { templatePayloadSchema } from '@/lib/forms/schema'
import { serializeTemplate } from '@/lib/forms/serialization'
import { requirePartner, logPartnerApiCall } from '@/lib/api/partner-keys'
import { logAudit } from '@/lib/audit'
import { slugify, ensureUniqueSlug } from '@/lib/forms/utils'
import { resolveTemplateOwner } from '@/lib/forms/ownership'
import { structureFromSections } from './_lib/helpers'

const MAX_PER_PAGE = 50

export async function GET(request: NextRequest) {
  const auth = await requirePartner(request, 'forms:read')
  if ('error' in auth) {
    return auth.error
  }
  const { partner } = auth

  const searchParams = request.nextUrl.searchParams
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1)
  const perPage = Math.min(Math.max(parseInt(searchParams.get('perPage') ?? '20', 10), 1), MAX_PER_PAGE)
  const status = searchParams.get('status') as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | null
  const category = searchParams.get('category')
  const search = searchParams.get('search')

  const where: any = {}
  if (status) where.status = status
  if (category) where.category = category
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [total, templates] = await Promise.all([
    prisma.formTemplate.count({ where }),
    prisma.formTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ])

  const body = {
    data: templates.map(serializeTemplate),
    meta: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  }

  const etag = createHash('sha1').update(JSON.stringify(body)).digest('hex')
  if (request.headers.get('if-none-match') === etag) {
    await logPartnerApiCall(partner, request, 304)
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
      },
    })
  }

  const response = NextResponse.json(body, {
    headers: {
      ETag: etag,
      'Cache-Control': 'private, max-age=0',
    },
  })
  await logPartnerApiCall(partner, request, 200, { count: templates.length })
  return response
}

export async function POST(request: NextRequest) {
  const auth = await requirePartner(request, 'forms:write')
  if ('error' in auth) {
    return auth.error
  }
  const { partner } = auth

  let payload
  try {
    const json = await request.json()
    const parsed = templatePayloadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    payload = parsed.data
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const baseSlug = payload.slug ? slugify(payload.slug) : slugify(payload.name)
  const slug = await ensureUniqueSlug(baseSlug)
  const structure = structureFromSections(payload.sections)
  const owner = await resolveTemplateOwner(partner.userId)

  const created = await prisma.$transaction(async (tx) => {
    const template = await tx.formTemplate.create({
      data: {
        slug,
        name: payload.name,
        description: payload.description,
        category: payload.categoryId,
        tags: payload.tags,
        estimatedCompletion: payload.estimatedCompletion,
        recommendedUses: payload.recommendedUses,
        status: payload.status,
        structure,
        createdById: owner.id,
        updatedById: owner.id,
        ...(payload.status === 'PUBLISHED' && { publishedAt: new Date() }),
      },
    })

    await tx.formTemplateVersion.create({
      data: {
        templateId: template.id,
        version: template.version,
        structure,
        createdById: owner.id,
        changelogNotes: payload.status === 'PUBLISHED' ? payload.changelogNotes ?? null : null,
      },
    })

    return template
  })

  // Audit log the form template creation
  await logAudit({
    userId: owner.id,
    action: 'CREATE',
    entityType: 'FormTemplate',
    entityId: created.id,
    changes: {
      slug,
      name: payload.name,
      description: payload.description,
      category: payload.categoryId,
      status: payload.status,
      partnerId: partner.id,
      partnerName: partner.name,
    },
  })

  revalidatePath('/forms')
  revalidatePath(`/forms/${slug}`)

  const response = NextResponse.json({ data: serializeTemplate(created) }, { status: 201 })
  await logPartnerApiCall(partner, request, 201, { slug })
  return response
}
