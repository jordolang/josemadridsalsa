import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, parsePagination } from '@/lib/api'
import { z } from 'zod'

const filterSchema = z.object({
  status: z.enum(['SCRAPED', 'CONTACT_FOUND', 'EMAIL_SENT', 'EMAIL_FAILED']).optional(),
  search: z.string().optional(),
  hasEmail: z.enum(['true', 'false']).optional(),
}).strict()

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('messaging:read')

    const { id: campaignId } = await params
    const { page, limit, skip } = parsePagination(req)
    const { searchParams } = new URL(req.url)

    const campaign = await prisma.leadCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    })
    if (!campaign) {
      return fail('Campaign not found', 404)
    }

    const filters = filterSchema.parse({
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      hasEmail: searchParams.get('hasEmail') || undefined,
    })

    const where: Record<string, unknown> = { campaignId }

    if (filters.status) {
      where.status = filters.status
    }

    if (filters.hasEmail === 'true') {
      where.email = { not: null }
    } else if (filters.hasEmail === 'false') {
      where.email = null
    }

    if (filters.search) {
      where.OR = [
        { schoolName: { contains: filters.search, mode: 'insensitive' } },
        { businessName: { contains: filters.search, mode: 'insensitive' } },
        { contactName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ])

    return ok({
      leads,
      meta: { total, page, limit },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return fail('Invalid filter parameters', 400, error.issues)
    }
    console.error('[lead-generation/leads] Failed to fetch leads:', error)
    return fail('Failed to fetch leads', 500)
  }
}
