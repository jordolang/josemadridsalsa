import { NextRequest } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { footerSettingsSchema } from '@/lib/cms/schemas'

/** Footer settings are a singleton; the first row is the live one. */
export async function GET() {
  try {
    await requirePermission('content:read')
    const settings = await prisma.footerSettings.findFirst({ orderBy: { updatedAt: 'desc' } })
    return ok({ settings })
  } catch (error) {
    const err = error as { message?: string; status?: number }
    return fail(err.message ?? 'Failed to load footer settings', err.status ?? 500)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission('content:write')
    const body = await req.json()
    const data = footerSettingsSchema.parse(body)

    const existing = await prisma.footerSettings.findFirst({ orderBy: { updatedAt: 'desc' } })
    const settings = existing
      ? await prisma.footerSettings.update({
          where: { id: existing.id },
          data: { ...data, socialLinks: data.socialLinks ?? undefined },
        })
      : await prisma.footerSettings.create({
          data: { ...data, socialLinks: data.socialLinks ?? undefined },
        })

    await logAudit({
      userId: user.id,
      action: 'cms.footer.update',
      entityType: 'cms.footer',
      entityId: settings.id,
      changes: data,
    })

    return ok({ settings })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(
        error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        422
      )
    }
    const err = error as { message?: string; status?: number }
    return fail(err.message ?? 'Failed to save footer settings', err.status ?? 500)
  }
}
