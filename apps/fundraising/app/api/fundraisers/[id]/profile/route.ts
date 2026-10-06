import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import prisma from '@/lib/prisma'
import { CUSTOM_CSS_MAX_LENGTH } from '@/lib/fundraising/custom-css'
import { toLiveStream, toTikTokProfileUrl, toYouTubeEmbedUrl } from '@/lib/fundraising/public-page-settings'

// The portal form sends '' for a cleared field; store that as null.
const emptyToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)

// Reject at save time what the public page would silently drop at render time.
const supportedUrl = (isSupported: (url: string) => boolean, message: string) =>
  z.preprocess(emptyToNull, z.string().trim().max(2048).refine(isSupported, message).nullable()).optional()

const ProfileUpdateSchema = z.object({
  customCss: z.preprocess(emptyToNull, z.string().max(CUSTOM_CSS_MAX_LENGTH).nullable()).optional(),
  liveStreamUrl: supportedUrl(
    (url) => toLiveStream(url, 'localhost') !== null,
    'Use an https YouTube, Twitch, Facebook video or Kick channel URL',
  ),
  youtubeVideoUrl: supportedUrl(
    (url) => toYouTubeEmbedUrl(url) !== null,
    'Use an https YouTube video, short, live or playlist URL',
  ),
  tiktokFeedUrl: supportedUrl(
    (url) => toTikTokProfileUrl(url) !== null,
    'Use an https TikTok profile URL (https://www.tiktok.com/@name)',
  ),
  isAdvancedMode: z.boolean().optional(),
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
    const { id: fundraiserId } = await params

    const profile = await prisma.fundraiserProfile.findUnique({
      where: { fundraiserId },
    })

    if (!profile) {
      return NextResponse.json({ customCss: null, liveStreamUrl: null, youtubeVideoUrl: null, tiktokFeedUrl: null, isAdvancedMode: false })
    }

    return NextResponse.json(profile)
  } catch (error: any) {
    console.error('Error fetching advanced profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch advanced profile', details: error.message },
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
    const parsed = ProfileUpdateSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { customCss, liveStreamUrl, youtubeVideoUrl, tiktokFeedUrl, isAdvancedMode } = parsed.data

    const updateData: any = {}
    if (customCss !== undefined) updateData.customCss = customCss
    if (liveStreamUrl !== undefined) updateData.liveStreamUrl = liveStreamUrl
    if (youtubeVideoUrl !== undefined) updateData.youtubeVideoUrl = youtubeVideoUrl
    if (tiktokFeedUrl !== undefined) updateData.tiktokFeedUrl = tiktokFeedUrl
    if (isAdvancedMode !== undefined) updateData.isAdvancedMode = isAdvancedMode

    const profile = await prisma.fundraiserProfile.upsert({
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
      changes: { profileUpdates: updateData },
    })

    return NextResponse.json(profile)
  } catch (error: any) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile', details: error.message },
      { status: 500 }
    )
  }
}
