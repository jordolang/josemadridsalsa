import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { ok, fail } from '@/lib/api'
import { z } from 'zod'

const bulkDeleteSchema = z.object({
  campaignId: z.string().min(1),
  ids: z.array(z.string().min(1)).min(1).max(500),
})

export async function POST(req: NextRequest) {
  try {
    await requirePermission('messaging:assign')

    const body: unknown = await req.json()
    const { campaignId, ids } = bulkDeleteSchema.parse(body)

    const { count } = await prisma.lead.deleteMany({
      where: { id: { in: ids }, campaignId },
    })

    return ok({ success: true, deleted: count })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return fail(
        'Invalid request: campaignId and ids (non-empty string array, max 500) are required',
        400,
        error.issues,
      )
    }
    console.error('[lead-generation/bulk-delete] Delete failed:', error)
    return fail('Delete failed', 500)
  }
}
