import { NextResponse } from 'next/server'
import { Prisma, ShopPlatform } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import {
  bulkSyncToShop,
  createFacebookCatalog,
  syncShopListing,
  validateShopExportConfiguration,
} from '@/lib/social/shops'
import { getExpectedAccountPlatformForShop } from '@/lib/social/platforms'
import { logAudit } from '@/lib/audit'

const createListingSchema = z.object({
  productId: z.string().min(1),
  shopPlatform: z.nativeEnum(ShopPlatform),
  socialAccountId: z.string().min(1),
  catalogId: z.string().trim().optional(),
  titleOverride: z.string().trim().optional(),
  descriptionOverride: z.string().trim().optional(),
  priceOverride: z.union([z.string(), z.number()]).optional(),
  marketplaceCategory: z.string().trim().optional(),
})

const syncListingSchema = z.object({
  listingId: z.string().min(1),
})

const bulkSyncSchema = z.object({
  shopPlatform: z.nativeEnum(ShopPlatform),
})

const bulkCreateSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1),
  shopPlatform: z.nativeEnum(ShopPlatform),
  socialAccountId: z.string().min(1),
  catalogId: z.string().trim().optional(),
})

const createFacebookCatalogSchema = z.object({
  socialAccountId: z.string().min(1),
  businessId: z.string().trim().min(1),
  name: z.string().trim().min(3).max(100),
})

async function requireSocialPublisher() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:publish'))) {
    return null
  }
  return user
}

async function requireSocialViewer() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:compose'))) {
    return null
  }
  return user
}

async function getValidatedSocialAccount(socialAccountId: string, shopPlatform: ShopPlatform) {
  const account = await prisma.socialAccount.findUnique({
    where: { id: socialAccountId },
    select: {
      id: true,
      platform: true,
      isActive: true,
      accountName: true,
    },
  })

  if (!account || !account.isActive) {
    return { error: 'Selected social account is not available.' as const }
  }

  const expectedPlatform = getExpectedAccountPlatformForShop(shopPlatform)
  if (account.platform !== expectedPlatform) {
    return {
      error:
        expectedPlatform === 'FACEBOOK'
          ? 'Select a connected Facebook Page for this export.'
          : 'Select a connected TikTok account for this export.',
    }
  }

  return { account }
}

/**
 * GET /api/social/shops - List all shop listings
 */
export async function GET(request: Request) {
  const user = await requireSocialViewer()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform') as ShopPlatform | null

  const listings = await prisma.shopListing.findMany({
    where: platform ? { shopPlatform: platform } : {},
    include: {
      socialAccount: {
        select: {
          id: true,
          platform: true,
          accountName: true,
          accountHandle: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          featuredImage: true,
          images: true,
          inventory: true,
          isActive: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({
    listings: listings.map((listing) => ({
      id: listing.id,
      productId: listing.productId,
      productName: listing.product.name,
      productSku: listing.product.sku,
      productPrice: listing.product.price.toString(),
      productImage: listing.product.featuredImage || listing.product.images[0] || null,
      productInventory: listing.product.inventory,
      shopPlatform: listing.shopPlatform,
      socialAccountId: listing.socialAccountId,
      targetAccountName: listing.socialAccount?.accountName ?? null,
      targetAccountHandle: listing.socialAccount?.accountHandle ?? null,
      targetAccountPlatform: listing.socialAccount?.platform ?? null,
      externalId: listing.externalId,
      externalUrl: listing.externalUrl,
      catalogId: listing.catalogId,
      status: listing.status,
      syncError: listing.syncError,
      titleOverride: listing.titleOverride,
      descriptionOverride: listing.descriptionOverride,
      priceOverride: listing.priceOverride?.toString() ?? null,
      condition: listing.condition,
      availability: listing.availability,
      marketplaceCategory: listing.marketplaceCategory,
      lastSyncedAt: listing.lastSyncedAt?.toISOString() ?? null,
      publishedAt: listing.publishedAt?.toISOString() ?? null,
    })),
  })
}

/**
 * POST /api/social/shops - Create listings, create catalogs, or sync
 */
export async function POST(request: Request) {
  const user = await requireSocialPublisher()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const action = body?.action

  switch (action) {
    case 'create_listing': {
      const parsed = createListingSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid listing payload' }, { status: 400 })
      }

      const data = parsed.data
      const product = await prisma.product.findUnique({ where: { id: data.productId } })
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }

      const accountResult = await getValidatedSocialAccount(data.socialAccountId, data.shopPlatform)
      if ('error' in accountResult) {
        return NextResponse.json({ error: accountResult.error }, { status: 400 })
      }

      const configValidation = validateShopExportConfiguration({
        shopPlatform: data.shopPlatform,
        socialAccountId: data.socialAccountId,
        socialAccountPlatform: accountResult.account.platform,
        catalogId: data.catalogId,
      })
      if (!configValidation.valid) {
        return NextResponse.json({ error: configValidation.error }, { status: 400 })
      }

      const listing = await prisma.shopListing.upsert({
        where: {
          productId_shopPlatform: {
            productId: data.productId,
            shopPlatform: data.shopPlatform,
          },
        },
        create: {
          productId: data.productId,
          shopPlatform: data.shopPlatform,
          socialAccountId: data.socialAccountId,
          catalogId: data.catalogId?.trim() || null,
          titleOverride: data.titleOverride || null,
          descriptionOverride: data.descriptionOverride || null,
          priceOverride:
            data.priceOverride !== undefined && `${data.priceOverride}`.length > 0
              ? Number(data.priceOverride)
              : null,
          marketplaceCategory: data.marketplaceCategory || null,
          status: 'PENDING',
        },
        update: {
          socialAccountId: data.socialAccountId,
          catalogId: data.catalogId?.trim() || null,
          titleOverride: data.titleOverride || null,
          descriptionOverride: data.descriptionOverride || null,
          priceOverride:
            data.priceOverride !== undefined && `${data.priceOverride}`.length > 0
              ? Number(data.priceOverride)
              : null,
          marketplaceCategory: data.marketplaceCategory || null,
        },
      })

      await logAudit({
        userId: user.id,
        action: 'shop_listing.create',
        entityType: 'ShopListing',
        entityId: listing.id,
        changes: {
          productId: data.productId,
          shopPlatform: data.shopPlatform,
          socialAccountId: data.socialAccountId,
        },
      })

      return NextResponse.json({ listing })
    }

    case 'sync_listing': {
      const parsed = syncListingSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'listingId is required' }, { status: 400 })
      }

      const result = await syncShopListing(parsed.data.listingId)

      await logAudit({
        userId: user.id,
        action: 'shop_listing.sync',
        entityType: 'ShopListing',
        entityId: parsed.data.listingId,
        changes: { success: result.success, error: result.error ?? null },
      })

      return NextResponse.json(result)
    }

    case 'bulk_sync': {
      const parsed = bulkSyncSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'shopPlatform is required' }, { status: 400 })
      }

      const result = await bulkSyncToShop(parsed.data.shopPlatform)

      await logAudit({
        userId: user.id,
        action: 'shop_listing.bulk_sync',
        entityType: 'ShopListing',
        changes: { shopPlatform: parsed.data.shopPlatform, ...result },
      })

      return NextResponse.json(result)
    }

    case 'bulk_create': {
      const parsed = bulkCreateSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid bulk-create payload' }, { status: 400 })
      }

      const data = parsed.data
      const accountResult = await getValidatedSocialAccount(data.socialAccountId, data.shopPlatform)
      if ('error' in accountResult) {
        return NextResponse.json({ error: accountResult.error }, { status: 400 })
      }

      const configValidation = validateShopExportConfiguration({
        shopPlatform: data.shopPlatform,
        socialAccountId: data.socialAccountId,
        socialAccountPlatform: accountResult.account.platform,
        catalogId: data.catalogId,
      })
      if (!configValidation.valid) {
        return NextResponse.json({ error: configValidation.error }, { status: 400 })
      }

      const created: string[] = []
      for (const productId of data.productIds) {
        const listing = await prisma.shopListing.upsert({
          where: {
            productId_shopPlatform: {
              productId,
              shopPlatform: data.shopPlatform,
            },
          },
          create: {
            productId,
            shopPlatform: data.shopPlatform,
            socialAccountId: data.socialAccountId,
            catalogId: data.catalogId?.trim() || null,
            status: 'PENDING',
          },
          update: {
            socialAccountId: data.socialAccountId,
            catalogId: data.catalogId?.trim() || null,
          },
        })
        created.push(listing.id)
      }

      await logAudit({
        userId: user.id,
        action: 'shop_listing.bulk_create',
        entityType: 'ShopListing',
        changes: {
          shopPlatform: data.shopPlatform,
          socialAccountId: data.socialAccountId,
          count: created.length,
        },
      })

      return NextResponse.json({ created: created.length })
    }

    case 'create_facebook_catalog': {
      const parsed = createFacebookCatalogSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid catalog payload' }, { status: 400 })
      }

      const result = await createFacebookCatalog(parsed.data)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      await logAudit({
        userId: user.id,
        action: 'shop_catalog.create',
        entityType: 'SocialAccount',
        entityId: parsed.data.socialAccountId,
        changes: {
          businessId: parsed.data.businessId,
          catalogId: result.catalogId,
          name: parsed.data.name,
        },
      })

      return NextResponse.json(result)
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}

/**
 * DELETE /api/social/shops?id=xxx - Remove a listing
 */
export async function DELETE(request: Request) {
  const user = await requireSocialPublisher()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Listing ID required' }, { status: 400 })
  }

  try {
    await prisma.shopListing.delete({ where: { id } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    throw error
  }

  await logAudit({
    userId: user.id,
    action: 'shop_listing.delete',
    entityType: 'ShopListing',
    entityId: id,
  })

  return NextResponse.json({ success: true })
}
