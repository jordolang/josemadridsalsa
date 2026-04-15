import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { ok, fail } from '@/lib/api'
import { z } from 'zod'

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
})

export async function POST(req: NextRequest) {
  try {
    await requirePermission('messaging:assign')

    const body: unknown = await req.json()
    const { ids } = bulkDeleteSchema.parse(body)

    await prisma.lead.deleteMany({
      where: { id: { in: ids } },
    })

    return ok({ success: true })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return fail('Invalid request: ids must be a non-empty array of strings (max 500)', 400)
    }
    console.error('[lead-generation/bulk-delete] Delete failed:', error)
    return fail('Delete failed', 500)
  }
}
