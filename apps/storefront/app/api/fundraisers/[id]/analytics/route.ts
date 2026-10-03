import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import prisma from '@/lib/prisma'
import { normalizeSeoKeywords } from '@/lib/fundraising/seo-keywords'
import { normalizeGaMeasurementId } from '@/lib/fundraising/public-page-settings'

// The portal form sends '' for a cleared field; store that as null.
const emptyToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)

const AnalyticsUpdateSchema = z.object({
  googleMeasurementId: z
    .preprocess(
      emptyToNull,
      z
        .string()
        .transform((id, ctx) => {
          const normalized = normalizeGaMeasurementId(id)
          if (!normalized) {
            ctx.addIssue({ code: 'custom', message: 'Use a Google Analytics ID like G-XXXXXXXXXX' })
            return z.NEVER
          }
          return normalized
        })
        .nullable(),
    )
    .optional(),
  googleMyBusinessId: z.preprocess(emptyToNull, z.string().trim().max(200).nullable()).optional(),
  seoKeywords: z
    .array(z.string().max(200))
    .max(100, 'Too many keywords')
    .transform(normalizeSeoKeywords)
    .optional(),
})

async function hasFundraiserAccess(userId: string, userEmail: string, fundraiserId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user && await hasPermission(user, 'orders:write')) return true

  const mainAccount = await prisma.fundraiserAccount.findFirst({
    where: { userId, fundraiserId },
  })
  if (mainAccount) return true

  const teamAccess = await prisma.fundraiserAccess.findFirst({
    where: { email: userEmail, fundraiserId },
  })
  if (teamAccess) return true

  return false
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    const { id: fundraiserId } = await params

    if (!user || !(await hasFundraiserAccess(user.id, user.email, fundraiserId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const analytics = await prisma.fundraiserAnalytics.findUnique({
      where: { fundraiserId },
    })

    if (!analytics) {
      return NextResponse.json({
        googleMeasurementId: null,
        googleMyBusinessId: null,
        seoKeywords: [],
      })
    }

    return NextResponse.json(analytics)
  } catch (error: any) {
    console.error('Error fetching analytics config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics config', details: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    const { id: fundraiserId } = await params

    if (!user || !(await hasFundraiserAccess(user.id, user.email, fundraiserId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const payload = await request.json()
    const parsed = AnalyticsUpdateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { googleMeasurementId, googleMyBusinessId, seoKeywords } = parsed.data

    const updateData: any = {}
    if (googleMeasurementId !== undefined) updateData.googleMeasurementId = googleMeasurementId
    if (googleMyBusinessId !== undefined) updateData.googleMyBusinessId = googleMyBusinessId
    if (seoKeywords !== undefined) updateData.seoKeywords = seoKeywords

    const analytics = await prisma.fundraiserAnalytics.upsert({
      where: { fundraiserId },
      create: {
        fundraiserId,
        ...updateData,
      },
      update: updateData,
    })

    await logAudit({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Fundraiser',
      entityId: fundraiserId,
      changes: { analyticsUpdates: updateData },
    })

    return NextResponse.json(analytics)
  } catch (error: any) {
    console.error('Error updating analytics config:', error)
    return NextResponse.json(
      { error: 'Failed to update analytics config', details: error.message },
      { status: 500 }
    )
  }
}
