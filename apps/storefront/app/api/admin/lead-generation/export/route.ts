import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { fail } from '@/lib/api'
import { z } from 'zod'

const MAX_EXPORT_LEADS = 10_000

const exportParamsSchema = z.object({
  campaignId: z.string().min(1),
  format: z.enum(['csv', 'json']).default('csv'),
  ids: z.string().optional(),
})

const CSV_INJECTION_CHARS = ['=', '+', '-', '@', '\t', '\r']

function escapeCsv(value: string): string {
  let safe = value
  const firstNonWs = safe.match(/\S/)?.[0]
  if (firstNonWs && CSV_INJECTION_CHARS.includes(firstNonWs)) {
    safe = `'${safe}`
  }
  if (
    safe.includes(',') ||
    safe.includes('"') ||
    safe.includes('\n') ||
    safe.includes('\r')
  ) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

const EXPORT_LEAD_SELECT = {
  id: true,
  campaignId: true,
  schoolName: true,
  businessName: true,
  businessCategory: true,
  address: true,
  city: true,
  state: true,
  district: true,
  rating: true,
  reviewCount: true,
  website: true,
  schoolUrl: true,
  googleMapsUrl: true,
  contactName: true,
  title: true,
  sport: true,
  email: true,
  phone: true,
  status: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function GET(req: NextRequest) {
  try {
    await requirePermission('messaging:read')

    const { searchParams } = new URL(req.url)

    const params = exportParamsSchema.parse({
      campaignId: searchParams.get('campaignId') || '',
      format: searchParams.get('format') || 'csv',
      ids: searchParams.get('ids') || undefined,
    })

    const where: Record<string, unknown> = { campaignId: params.campaignId }
    if (params.ids) {
      const idList = params.ids.split(',').filter(Boolean)
      if (idList.length > MAX_EXPORT_LEADS) {
        return fail(`Cannot export more than ${MAX_EXPORT_LEADS} leads at once`, 400)
      }
      where.id = { in: idList }
    }

    const leads = await prisma.lead.findMany({
      where,
      take: MAX_EXPORT_LEADS,
      orderBy: { createdAt: 'desc' },
      select: EXPORT_LEAD_SELECT,
    })

    if (params.format === 'json') {
      return NextResponse.json(
        { success: true, data: leads, meta: { total: leads.length } },
        {
          headers: {
            'Content-Disposition': `attachment; filename="leads-${params.campaignId}.json"`,
          },
        }
      )
    }

    const headers = [
      'School/Business Name',
      'Business Name',
      'Address',
      'Rating',
      'Review Count',
      'Website',
      'Contact Name',
      'Title',
      'Sport',
      'Email',
      'Phone',
      'Status',
    ]

    const rows = leads.map((lead) => [
      lead.schoolName,
      lead.businessName ?? '',
      lead.address ?? '',
      lead.rating != null ? String(lead.rating) : '',
      lead.reviewCount != null ? String(lead.reviewCount) : '',
      lead.website ?? lead.schoolUrl ?? '',
      lead.contactName ?? '',
      lead.title ?? '',
      lead.sport ?? '',
      lead.email ?? '',
      lead.phone ?? '',
      lead.status,
    ])

    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-${params.campaignId}.csv"`,
      },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return fail('Invalid export parameters', 400)
    }
    console.error('[lead-generation/export] Export failed:', error)
    return fail('Export failed', 500)
  }
}
