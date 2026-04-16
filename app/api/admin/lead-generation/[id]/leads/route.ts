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

const createCustomSchema = z.object({
  schoolName: z.string().trim().min(1).max(200),
  url: z.string().trim().url().max(2000),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('messaging:read')

    const { id: campaignId } = await params
    const campaign = await prisma.leadCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, leadType: true },
    })
    if (!campaign) return fail('Campaign not found', 404)

    const body = await req.json().catch(() => null)
    const parsed = createCustomSchema.safeParse(body)
    if (!parsed.success) {
      return fail('Invalid input', 400, parsed.error.issues)
    }

    const { schoolName, url } = parsed.data
    const isBusiness = campaign.leadType === 'LOCAL_BUSINESS'

    const lead = await prisma.lead.create({
      data: {
        campaignId,
        schoolName,
        schoolUrl: isBusiness ? null : url,
        businessName: isBusiness ? schoolName : null,
        website: isBusiness ? url : null,
        status: 'SCRAPED',
      },
    })

    return ok({ lead })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return fail('Invalid input', 400, error.issues)
    }
    console.error('[lead-generation/leads] Failed to create custom lead:', error)
    return fail('Failed to create lead', 500)
  }
}
