import { NextResponse } from 'next/server'
import type { ShopPlatform } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { syncShopListing, bulkSyncToShop } from '@/lib/social/shops'
import { logAudit } from '@/lib/audit'

/**
 * GET /api/social/shops - List all shop listings
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:compose'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform') as ShopPlatform | null

  const listings = await prisma.shopListing.findMany({
    where: platform ? { shopPlatform: platform } : {},
    include: {
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

  const formatted = listings.map((l) => ({
    id: l.id,
    productId: l.productId,
    productName: l.product.name,
    productSku: l.product.sku,
    productPrice: l.product.price.toString(),
    productImage: l.product.featuredImage || l.product.images[0] || null,
    productInventory: l.product.inventory,
    shopPlatform: l.shopPlatform,
    externalId: l.externalId,
    externalUrl: l.externalUrl,
    catalogId: l.catalogId,
    status: l.status,
    syncError: l.syncError,
    titleOverride: l.titleOverride,
    descriptionOverride: l.descriptionOverride,
    priceOverride: l.priceOverride?.toString() ?? null,
    condition: l.condition,
    availability: l.availability,
    marketplaceCategory: l.marketplaceCategory,
    lastSyncedAt: l.lastSyncedAt?.toISOString() ?? null,
    publishedAt: l.publishedAt?.toISOString() ?? null,
  }))

  return NextResponse.json({ listings: formatted })
}

/**
 * POST /api/social/shops - Create listings or sync
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:publish'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body

  switch (action) {
    case 'create_listing': {
      const { productId, shopPlatform, catalogId, titleOverride, descriptionOverride, priceOverride, marketplaceCategory } = body

      if (!productId || !shopPlatform) {
        return NextResponse.json({ error: 'productId and shopPlatform are required' }, { status: 400 })
      }

      const validPlatforms: ShopPlatform[] = ['FACEBOOK_SHOP', 'FACEBOOK_MARKETPLACE', 'TIKTOK_SHOP']
      if (!validPlatforms.includes(shopPlatform)) {
        return NextResponse.json({ error: 'Invalid shop platform' }, { status: 400 })
      }

      const product = await prisma.product.findUnique({ where: { id: productId } })
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }

      const listing = await prisma.shopListing.upsert({
        where: { productId_shopPlatform: { productId, shopPlatform } },
        create: {
          productId,
          shopPlatform,
          catalogId: catalogId || null,
          titleOverride: titleOverride || null,
          descriptionOverride: descriptionOverride || null,
          priceOverride: priceOverride ? parseFloat(priceOverride) : null,
          marketplaceCategory: marketplaceCategory || null,
          status: 'PENDING',
        },
        update: {
          catalogId: catalogId || undefined,
          titleOverride: titleOverride ?? undefined,
          descriptionOverride: descriptionOverride ?? undefined,
          priceOverride: priceOverride ? parseFloat(priceOverride) : undefined,
          marketplaceCategory: marketplaceCategory ?? undefined,
        },
      })

      await logAudit({
        userId: user.id,
        action: 'shop_listing.create',
        entityType: 'ShopListing',
        entityId: listing.id,
        changes: { productId, shopPlatform },
      })

      return NextResponse.json({ listing })
    }

    case 'sync_listing': {
      const { listingId } = body
      if (!listingId) {
        return NextResponse.json({ error: 'listingId is required' }, { status: 400 })
      }

      const result = await syncShopListing(listingId)

      await logAudit({
        userId: user.id,
        action: 'shop_listing.sync',
        entityType: 'ShopListing',
        entityId: listingId,
        changes: { success: result.success, error: result.error ?? null },
      })

      return NextResponse.json(result)
    }

    case 'bulk_sync': {
      const { shopPlatform } = body
      if (!shopPlatform) {
        return NextResponse.json({ error: 'shopPlatform is required' }, { status: 400 })
      }

      const result = await bulkSyncToShop(shopPlatform)

      await logAudit({
        userId: user.id,
        action: 'shop_listing.bulk_sync',
        entityType: 'ShopListing',
        changes: { shopPlatform, ...result },
      })

      return NextResponse.json(result)
    }

    case 'bulk_create': {
      const { productIds, shopPlatform, catalogId } = body
      if (!productIds?.length || !shopPlatform) {
        return NextResponse.json({ error: 'productIds and shopPlatform are required' }, { status: 400 })
      }

      const created: string[] = []
      for (const productId of productIds) {
        const listing = await prisma.shopListing.upsert({
          where: { productId_shopPlatform: { productId, shopPlatform } },
          create: {
            productId,
            shopPlatform,
            catalogId: catalogId || null,
            status: 'PENDING',
          },
          update: {},
        })
        created.push(listing.id)
      }

      await logAudit({
        userId: user.id,
        action: 'shop_listing.bulk_create',
        entityType: 'ShopListing',
        changes: { shopPlatform, count: created.length },
      })

      return NextResponse.json({ created: created.length })
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}

/**
 * DELETE /api/social/shops?id=xxx - Remove a listing
 */
export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:publish'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Listing ID required' }, { status: 400 })
  }

  await prisma.shopListing.delete({ where: { id } })

  await logAudit({
    userId: user.id,
    action: 'shop_listing.delete',
    entityType: 'ShopListing',
    entityId: id,
  })

  return NextResponse.json({ success: true })
}
