import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { templateUpdateSchema } from '@/lib/forms/schema'
import { serializeTemplate, serializeTemplateVersion } from '@/lib/forms/serialization'
import { requirePartner, logPartnerApiCall } from '@/lib/api/partner-keys'
import { slugify, ensureUniqueSlug } from '@/lib/forms/utils'
import { resolveTemplateOwner } from '@/lib/forms/ownership'
import { structureFromSections, templateHistoryInclude } from '../_lib/helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const auth = await requirePartner(request, 'forms:read')
  if ('error' in auth) {
    return auth.error
  }
  const { partner } = auth
  const template = await prisma.formTemplate.findUnique({
    where: { slug },
    include: templateHistoryInclude,
  })

  if (!template) {
    await logPartnerApiCall(partner, request, 404, { slug })
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const body = {
    data: {
      ...serializeTemplate(template),
      versions: template.versions.map(serializeTemplateVersion),
    },
  }

  const etag = createHash('sha1').update(JSON.stringify(body)).digest('hex')
  if (request.headers.get('if-none-match') === etag) {
    await logPartnerApiCall(partner, request, 304, { slug })
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag },
    })
  }

  const response = NextResponse.json(body, {
    headers: {
      ETag: etag,
      'Cache-Control': 'private, max-age=0',
    },
  })
  await logPartnerApiCall(partner, request, 200, { slug })
  return response
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const auth = await requirePartner(request, 'forms:write')
  if ('error' in auth) {
    return auth.error
  }
  const { partner } = auth

  let payload
  try {
    const json = await request.json()
    const parsed = templateUpdateSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    payload = parsed.data
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  if (!payload || Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'Provide at least one field to update' }, { status: 400 })
  }
  const existing = await prisma.formTemplate.findUnique({ where: { slug } })
  if (!existing) {
    await logPartnerApiCall(partner, request, 404, { slug })
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const nextSlugBase = payload.slug ? slugify(payload.slug) : payload.name ? slugify(payload.name) : existing.slug
  const slugHasChanged = nextSlugBase !== existing.slug
  const nextSlug = slugHasChanged ? await ensureUniqueSlug(nextSlugBase, existing.id) : existing.slug
  const owner = await resolveTemplateOwner(partner.userId)
  const structurePayload = payload.sections ? structureFromSections(payload.sections) : (existing.structure as any)
  const nextVersion = existing.version + 1

  const updated = await prisma.$transaction(async (tx) => {
    const template = await tx.formTemplate.update({
      where: { id: existing.id },
      data: {
        slug: nextSlug,
        name: payload.name ?? existing.name,
        description: payload.description ?? existing.description,
        category: payload.categoryId ?? existing.category,
        tags: payload.tags ?? existing.tags,
        estimatedCompletion: payload.estimatedCompletion ?? existing.estimatedCompletion,
        recommendedUses: payload.recommendedUses ?? existing.recommendedUses,
        status: payload.status ?? existing.status,
        structure: structurePayload,
        version: nextVersion,
        updatedById: owner.id,
        ...(payload.status === 'PUBLISHED' && { publishedAt: new Date() }),
      },
    })

    await tx.formTemplateVersion.create({
      data: {
        templateId: template.id,
        version: nextVersion,
        structure: structurePayload,
        createdById: owner.id,
        changelogNotes: payload.changelogNotes ?? null,
      },
    })

    return tx.formTemplate.findUnique({
      where: { id: template.id },
      include: templateHistoryInclude,
    })
  })

  if (!updated) {
    return NextResponse.json({ error: 'Unable to update template' }, { status: 500 })
  }

  revalidatePath('/forms')
  revalidatePath(`/forms/${nextSlug}`)
  if (slugHasChanged) {
    revalidatePath(`/forms/${existing.slug}`)
  }

  const response = NextResponse.json({
    data: {
      ...serializeTemplate(updated),
      versions: updated.versions.map(serializeTemplateVersion),
    },
  })
  await logPartnerApiCall(partner, request, 200, { slug: nextSlug })
  return response
}
