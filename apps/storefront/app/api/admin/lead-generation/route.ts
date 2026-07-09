import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, parsePagination } from '@/lib/api'
import { z } from 'zod'

const filterSchema = z.object({
  leadType: z.enum(['SCHOOL_ATHLETICS', 'LOCAL_BUSINESS', 'LOCAL_SCHOOL', 'FUNDRAISER_ORG']).optional(),
  status: z.enum([
    'DRAFT', 'SCRAPING', 'SCRAPE_COMPLETED', 'PARSING_CONTACTS',
    'PARSING_COMPLETED', 'SENDING_EMAILS', 'COMPLETED', 'FAILED',
  ]).optional(),
  search: z.string().optional(),
}).strict()

export async function GET(req: NextRequest) {
  try {
    await requirePermission('messaging:read')

    const { page, limit, skip } = parsePagination(req)
    const { searchParams } = new URL(req.url)

    const filters = filterSchema.parse({
      leadType: searchParams.get('leadType') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
    })

    const where: Record<string, unknown> = {}

    if (filters.leadType) {
      where.leadType = filters.leadType
    }

    if (filters.status) {
      where.status = filters.status
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
        { state: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const [campaigns, total] = await Promise.all([
      prisma.leadCampaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { leads: true } },
          template: { select: { id: true, name: true } },
        },
      }),
      prisma.leadCampaign.count({ where }),
    ])

    return ok({
      campaigns,
      meta: { total, page, limit },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return fail('Invalid filter parameters', 400, error.issues)
    }
    console.error('[lead-generation] Failed to fetch campaigns:', error)
    return fail('Failed to fetch campaigns', 500)
  }
}
