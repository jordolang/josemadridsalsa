import { NextRequest } from 'next/server'
import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { developerApiErrorResponse } from '@/lib/developer/api-errors'
import prisma from '@/lib/prisma'
import {
  DEFAULT_DEVELOPER_PAGE_CONTENT,
  developerPageContentSchema,
  getDeveloperPageContent,
} from '@/lib/developer/page-content'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/developer/admin/content
 * Developer-only — current developer page content plus the defaults.
 */
export async function GET() {
  try {
    await requirePermission('developer:content')
    const content = await getDeveloperPageContent()
    return ok({ content, defaults: DEFAULT_DEVELOPER_PAGE_CONTENT })
  } catch (error: unknown) {
    return developerApiErrorResponse(error) ?? serverError('Failed to load developer page content', error)
  }
}

/**
 * PUT /api/developer/admin/content
 * Developer-only — save developer page content overrides.
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission('developer:content')

    const body = await req.json()
    const parsed = developerPageContentSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return fail(`Validation error: ${issue.path.join('.')} — ${issue.message}`)
    }

    const saved = await prisma.developerPageContent.upsert({
      where: { singleton: 'singleton' },
      update: { content: parsed.data },
      create: { content: parsed.data },
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'developer.content.update',
        entityType: 'developer_page_content',
        entityId: saved.id,
      },
      req,
    )

    return ok({ content: parsed.data })
  } catch (error: unknown) {
    return developerApiErrorResponse(error) ?? serverError('Failed to save developer page content', error)
  }
}

/**
 * DELETE /api/developer/admin/content
 * Developer-only — reset the developer page back to the default content.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission('developer:content')

    await prisma.developerPageContent.deleteMany({ where: { singleton: 'singleton' } })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'developer.content.reset',
        entityType: 'developer_page_content',
      },
      req,
    )

    return ok({ content: DEFAULT_DEVELOPER_PAGE_CONTENT })
  } catch (error: unknown) {
    return developerApiErrorResponse(error) ?? serverError('Failed to reset developer page content', error)
  }
}
