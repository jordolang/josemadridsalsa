import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { ok, fail, unauthorized, serverError, tryCatch } from '@/lib/api'

export const runtime = 'nodejs'

/**
 * GET /api/wishlist
 * Fetch authenticated user's wishlist items with full product data
 * Returns empty array if not authenticated (to avoid console errors)
 */
export async function GET(request: NextRequest) {
  return tryCatch(async () => {
    const user = await getCurrentUser()

    if (!user) {
      // Return empty wishlist instead of 401 to prevent console errors
      return ok({ items: [] })
    }

    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { userId: user.id },
      include: {
        product: {
          include: {
            productTags: {
              include: {
                tag: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Format response with product data
    const formattedItems = wishlistItems.map((item) => ({
      id: item.id,
      productId: item.productId,
      userId: item.userId,
      createdAt: item.createdAt,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        description: item.product.description,
        price: parseFloat(String(item.product.price)),
        compareAtPrice: item.product.compareAtPrice
          ? parseFloat(String(item.product.compareAtPrice))
          : null,
        featuredImage: item.product.featuredImage,
        images: item.product.images || [],
        heatLevel: item.product.heatLevel,
        sku: item.product.sku,
        inventory: item.product.inventory,
        isFeatured: item.product.isFeatured,
        isActive: item.product.isActive,
        tags: item.product.productTags?.map(({ tag }) => tag.slug) || [],
      },
    }))

    return ok({ items: formattedItems })
  }, 'Failed to fetch wishlist')
}

/**
 * POST /api/wishlist
 * Add a product to the authenticated user's wishlist
 */
export async function POST(request: NextRequest) {
  return tryCatch(async () => {
    const user = await getCurrentUser()

    if (!user) {
      return unauthorized('Please sign in to add items to your wishlist')
    }

    const body = await request.json()
    const { productId } = body

    if (!productId) {
      return fail('Product ID is required')
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        productTags: {
          include: {
            tag: true,
          },
        },
      },
    })

    if (!product) {
      return fail('Product not found', 404)
    }

    // Check if already in wishlist
    const existing = await prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId: user.id,
          productId,
        },
      },
    })

    if (existing) {
      return fail('Product already in wishlist', 409)
    }

    // Add to wishlist
    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        userId: user.id,
        productId,
      },
      include: {
        product: {
          include: {
            productTags: {
              include: {
                tag: true,
              },
            },
          },
        },
      },
    })

    // Format response
    const formattedItem = {
      id: wishlistItem.id,
      productId: wishlistItem.productId,
      userId: wishlistItem.userId,
      createdAt: wishlistItem.createdAt,
      product: {
        id: wishlistItem.product.id,
        name: wishlistItem.product.name,
        slug: wishlistItem.product.slug,
        description: wishlistItem.product.description,
        price: parseFloat(String(wishlistItem.product.price)),
        compareAtPrice: wishlistItem.product.compareAtPrice
          ? parseFloat(String(wishlistItem.product.compareAtPrice))
          : null,
        featuredImage: wishlistItem.product.featuredImage,
        images: wishlistItem.product.images || [],
        heatLevel: wishlistItem.product.heatLevel,
        sku: wishlistItem.product.sku,
        inventory: wishlistItem.product.inventory,
        isFeatured: wishlistItem.product.isFeatured,
        isActive: wishlistItem.product.isActive,
        tags: wishlistItem.product.productTags?.map(({ tag }) => tag.slug) || [],
      },
    }

    return ok(formattedItem, 201)
  }, 'Failed to add item to wishlist')
}

/**
 * DELETE /api/wishlist
 * Remove a product from the authenticated user's wishlist
 */
export async function DELETE(request: NextRequest) {
  return tryCatch(async () => {
    const user = await getCurrentUser()

    if (!user) {
      return unauthorized('Please sign in to manage your wishlist')
    }

    const body = await request.json()
    const { productId } = body

    if (!productId) {
      return fail('Product ID is required')
    }

    // Check if item exists in wishlist
    const existing = await prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId: user.id,
          productId,
        },
      },
    })

    if (!existing) {
      return fail('Product not in wishlist', 404)
    }

    // Remove from wishlist
    await prisma.wishlistItem.delete({
      where: {
        userId_productId: {
          userId: user.id,
          productId,
        },
      },
    })

    return ok({ message: 'Item removed from wishlist' })
  }, 'Failed to remove item from wishlist')
}
