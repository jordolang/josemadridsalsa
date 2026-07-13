import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { developerApiErrorResponse } from '@/lib/developer/api-errors'
import { readRepoMarkdownFile } from '@/lib/developer/repo-docs'
import { convertMarkdownToFumadocs, slugifyDocName } from '@/lib/developer/salsadocs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const convertSchema = z.object({
  path: z.string().min(1).max(500),
})

/**
 * POST /api/developer/admin/salsadocs/convert
 * Developer-only — read a Markdown file from this repository and convert it
 * to Fumadocs-compatible MDX, ready to publish to Salsadocs.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePermission('developer:salsadocs')

    const body = await req.json()
    const parsed = convertSchema.safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }

    const fileName = parsed.data.path.split('/').pop() ?? parsed.data.path
    let markdown: string
    try {
      markdown = await readRepoMarkdownFile(parsed.data.path)
    } catch (readError) {
      return fail(readError instanceof Error ? readError.message : 'Unable to read file', 404)
    }

    const conversion = convertMarkdownToFumadocs(markdown, {
      fallbackTitle: fileName.replace(/\.mdx?$/i, '').replace(/[-_]+/g, ' '),
      mdxInput: /\.mdx$/i.test(fileName),
    })

    return ok({
      ...conversion,
      sourcePath: parsed.data.path,
      suggestedSlug: slugifyDocName(fileName),
    })
  } catch (error: unknown) {
    return developerApiErrorResponse(error) ?? serverError('Failed to convert markdown file', error)
  }
}
