import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireFundraiserAccess, getCurrentFundraiserAccount } from '@/lib/rbac'
import type { FundraiserPageConfig, GalleryBlock } from '@/lib/fundraiser-page-config'

export async function GET() {
  try {
    await requireFundraiserAccess()
    const account = await getCurrentFundraiserAccount()
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Extract gallery URLs from pageConfig if present
    const pageConfig = account.fundraiser.pageConfig as FundraiserPageConfig | null
    const galleryBlock = pageConfig?.blocks?.find(
      (b): b is GalleryBlock => b.type === 'gallery'
    )

    return NextResponse.json({
      logoUrl: account.fundraiser.logoUrl,
      coverPhotoUrl: account.fundraiser.coverPhotoUrl,
      galleryUrls: galleryBlock?.imageUrls || [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

const UpdateAssetsSchema = z.object({
  logoUrl: z.string().url().optional(),
  coverPhotoUrl: z.string().url().optional(),
  galleryUrls: z.array(z.string().url()).max(20).optional(),
})

export async function PATCH(request: Request) {
  try {
    await requireFundraiserAccess()
    const account = await getCurrentFundraiserAccount()
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = UpdateAssetsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {}
    if (parsed.data.logoUrl !== undefined) {
      data.logoUrl = parsed.data.logoUrl
    }
    if (parsed.data.coverPhotoUrl !== undefined) {
      data.coverPhotoUrl = parsed.data.coverPhotoUrl
    }

    // If gallery URLs are provided, update the gallery block in pageConfig
    if (parsed.data.galleryUrls !== undefined) {
      const currentConfig = (account.fundraiser.pageConfig as FundraiserPageConfig | null) || {
        version: 1 as const,
        theme: 'default' as const,
        blocks: [],
      }

      const updatedBlocks = (currentConfig.blocks ?? []).map((block) => {
        if (block.type === 'gallery') {
          return { ...block, imageUrls: parsed.data.galleryUrls! }
        }
        return block
      })

      // If no gallery block exists, add one
      const hasGallery = updatedBlocks.some((b) => b.type === 'gallery')
      if (!hasGallery && parsed.data.galleryUrls.length > 0) {
        updatedBlocks.push({
          type: 'gallery' as const,
          imageUrls: parsed.data.galleryUrls,
          columns: 3 as const,
        })
      }

      data.pageConfig = { ...currentConfig, blocks: updatedBlocks }
    }

    if (Object.keys(data).length > 0) {
      await prisma.fundraiser.update({
        where: { id: account.fundraiserId },
        data,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
