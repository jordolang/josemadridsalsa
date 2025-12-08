import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { templateVersionInputSchema } from '@/lib/forms/schema'
import { serializeTemplate, serializeTemplateVersion } from '@/lib/forms/serialization'
import { requirePartner, logPartnerApiCall } from '@/lib/api/partner-keys'
import { resolveTemplateOwner } from '@/lib/forms/ownership'
import { structureFromSections, templateHistoryInclude } from '../../_lib/helpers'

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
<<<<<<< HEAD
  const { slug } = await params
=======
>>>>>>> a914b70e48c74fb30ffafd6a685d5d84da8bcb1d
  const auth = await requirePartner(request, 'forms:write')
  if ('error' in auth) {
    return auth.error
  }
  const { partner } = auth

  let payload
  try {
    const json = await request.json()
    const parsed = templateVersionInputSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    payload = parsed.data
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

<<<<<<< HEAD
=======
  const { slug } = await params
>>>>>>> a914b70e48c74fb30ffafd6a685d5d84da8bcb1d
  const existing = await prisma.formTemplate.findUnique({ where: { slug } })
  if (!existing) {
    await logPartnerApiCall(partner, request, 404, { slug })
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const owner = await resolveTemplateOwner(partner.userId)
  const structure = structureFromSections(payload.sections)
  const nextVersion = existing.version + 1
  const nextStatus = payload.status ?? existing.status

  const updated = await prisma.$transaction(async (tx) => {
    const template = await tx.formTemplate.update({
      where: { id: existing.id },
      data: {
        structure,
        version: nextVersion,
        status: nextStatus,
        updatedById: owner.id,
        ...(nextStatus === 'PUBLISHED' && { publishedAt: new Date() }),
      },
    })

    await tx.formTemplateVersion.create({
      data: {
        templateId: template.id,
        version: nextVersion,
        structure,
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
    return NextResponse.json({ error: 'Unable to create version' }, { status: 500 })
  }

  revalidatePath('/forms')
  revalidatePath(`/forms/${updated.slug}`)

  const response = NextResponse.json({
    data: {
      ...serializeTemplate(updated),
      versions: updated.versions.map(serializeTemplateVersion),
    },
  })
  await logPartnerApiCall(partner, request, 201, { slug: updated.slug, version: updated.version })
  return response
}
