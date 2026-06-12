import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { getSalsadocsConfig, putSalsadocsFile, SalsadocsError } from '@/lib/developer/salsadocs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const publishSchema = z.object({
  section: z.string().regex(slugPattern).max(100).nullable(),
  slug: z.string().regex(slugPattern, 'Slug must be lowercase alphanumeric with hyphens').max(100),
  mdx: z.string().min(1).max(500_000),
  message: z.string().trim().max(200).optional(),
})

/**
 * POST /api/developer/admin/salsadocs/publish
 * Developer-only — create or update a documentation page in the salsadocs
 * repository. Pushing the commit triggers a Vercel redeploy of the docs site.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('developer:salsadocs')

    const body = await req.json()
    const parsed = publishSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return fail(`Validation error: ${issue.path.join('.')} — ${issue.message}`)
    }

    const { section, slug, mdx, message } = parsed.data
    const config = getSalsadocsConfig()
    const path = section
      ? `${config.contentDir}/${section}/${slug}.mdx`
      : `${config.contentDir}/${slug}.mdx`

    const result = await putSalsadocsFile(
      path,
      mdx,
      message?.trim() || `Docs: update ${slug} via developer console`,
    )

    await logAuditWithRequest(
      {
        userId: user.id,
        action: result.created ? 'developer.salsadocs.create' : 'developer.salsadocs.update',
        entityType: 'salsadocs_doc',
        entityId: result.path,
      },
      req,
    )

    return ok(result, result.created ? 201 : 200)
  } catch (error: unknown) {
    if (error instanceof SalsadocsError) {
      return fail(error.message, error.status)
    }
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return fail('Forbidden', 403)
    }
    return serverError('Failed to publish the document', error)
  }
}
