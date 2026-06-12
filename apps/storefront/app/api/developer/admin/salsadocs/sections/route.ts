import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { developerApiErrorResponse } from '@/lib/developer/api-errors'
import { logAuditWithRequest } from '@/lib/audit'
import { createSalsadocsSection } from '@/lib/developer/salsadocs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const sectionSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .max(100),
  title: z.string().trim().min(1).max(120),
})

/**
 * POST /api/developer/admin/salsadocs/sections
 * Developer-only — create a new documentation section in salsadocs.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('developer:salsadocs')

    const body = await req.json()
    const parsed = sectionSchema.safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }

    const result = await createSalsadocsSection(parsed.data.slug, parsed.data.title)

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'developer.salsadocs.section.create',
        entityType: 'salsadocs_section',
        entityId: parsed.data.slug,
      },
      req,
    )

    return ok(result, 201)
  } catch (error: unknown) {
    return developerApiErrorResponse(error) ?? serverError('Failed to create the section', error)
  }
}
