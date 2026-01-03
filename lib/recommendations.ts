import { prisma } from '@/lib/prisma'

export interface RecommendedProduct {
  id: string
  name: string
  slug: string
  price: number
  featuredImage: string | null
  heatLevel: string | null
  sku: string
  inventory: number
  score: number // Recommendation confidence score
}

/**
 * Get "Frequently Bought Together" recommendations
 * Based on orders that contain the target product
 */
export async function getFrequentlyBoughtTogether(
  productId: string,
  limit: number = 4
): Promise<RecommendedProduct[]> {
  try {
    // Find orders containing this product
    const ordersWithProduct = await prisma.orderItem.findMany({
      where: { productId },
      select: { orderId: true },
      distinct: ['orderId'],
      take: 100, // Analyze last 100 orders
    })

    const orderIds = ordersWithProduct.map(item => item.orderId)

    if (orderIds.length === 0) {
      return []
    }

    // Find other products in those orders
    const coOccurrences = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        orderId: { in: orderIds },
        productId: { not: productId }, // Exclude the target product
      },
      _count: {
        orderId: true,
      },
      orderBy: {
        _count: {
          orderId: 'desc',
        },
      },
      take: limit * 2, // Get more than needed in case some are out of stock
    })

    // Get product details
    const productIds = coOccurrences.map(item => item.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
        inventory: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        featuredImage: true,
        heatLevel: true,
        sku: true,
        inventory: true,
      },
      take: limit,
    })

    // Calculate recommendation scores
    const maxCount = coOccurrences[0]?._count.orderId || 1
    return products.map(product => {
      const occurrence = coOccurrences.find(co => co.productId === product.id)
      const count = occurrence?._count.orderId || 0
      const score = count / maxCount // Normalized score 0-1

      return {
        ...product,
        price: Number(product.price),
        score,
      }
    })
  } catch (error) {
    console.error('Error getting frequently bought together:', error)
    return []
  }
}

/**
 * Get "You May Also Like" recommendations
 * Based on similar products (same category, similar heat level)
 */
export async function getYouMayAlsoLike(
  productId: string,
  limit: number = 8
): Promise<RecommendedProduct[]> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        categoryId: true,
        heatLevel: true,
        price: true,
      },
    })

    if (!product) {
      return []
    }

    // Find similar products
    const similarProducts = await prisma.product.findMany({
      where: {
        id: { not: productId },
        isActive: true,
        inventory: { gt: 0 },
        OR: [
          { categoryId: product.categoryId }, // Same category
          { heatLevel: product.heatLevel }, // Same heat level
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        featuredImage: true,
        heatLevel: true,
        sku: true,
        inventory: true,
        categoryId: true,
      },
      take: limit * 2,
    })

    // Calculate similarity scores
    return similarProducts
      .map(p => {
        let score = 0

        // Same category = +0.5
        if (p.categoryId === product.categoryId) score += 0.5

        // Same heat level = +0.3
        if (p.heatLevel === product.heatLevel) score += 0.3

        // Similar price range (within 30%) = +0.2
        const priceDiff = Math.abs(Number(p.price) - Number(product.price))
        const priceRange = Number(product.price) * 0.3
        if (priceDiff <= priceRange) score += 0.2

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          featuredImage: p.featuredImage,
          heatLevel: p.heatLevel,
          sku: p.sku,
          inventory: p.inventory,
          score,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  } catch (error) {
    console.error('Error getting you may also like:', error)
    return []
  }
}

/**
 * Get personalized recommendations for a user
 * Based on their order history and browsing patterns
 */
export async function getPersonalizedRecommendations(
  userId: string,
  limit: number = 8
): Promise<RecommendedProduct[]> {
  try {
    // Get user's order history
    const userOrders = await prisma.order.findMany({
      where: {
        userId,
        paymentStatus: 'PAID',
      },
      include: {
        items: {
          select: {
            productId: true,
            product: {
              select: {
                categoryId: true,
                heatLevel: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10, // Last 10 orders
    })

    // Extract user preferences
    const purchasedProductIds = new Set<string>()
    const categories = new Map<string, number>()
    const heatLevels = new Map<string, number>()

    userOrders.forEach(order => {
      order.items.forEach(item => {
        purchasedProductIds.add(item.productId)

        if (item.product.categoryId) {
          categories.set(
            item.product.categoryId,
            (categories.get(item.product.categoryId) || 0) + 1
          )
        }

        if (item.product.heatLevel) {
          heatLevels.set(
            item.product.heatLevel,
            (heatLevels.get(item.product.heatLevel) || 0) + 1
          )
        }
      })
    })

    // Get top preferences
    const topCategory = Array.from(categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
    const topHeatLevel = Array.from(heatLevels.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]

    // Find products matching preferences
    const recommendations = await prisma.product.findMany({
      where: {
        id: { notIn: Array.from(purchasedProductIds) }, // Exclude already purchased
        isActive: true,
        inventory: { gt: 0 },
        OR: [
          { categoryId: topCategory },
          { heatLevel: topHeatLevel as any },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        featuredImage: true,
        heatLevel: true,
        sku: true,
        inventory: true,
        categoryId: true,
      },
      take: limit,
    })

    return recommendations.map(p => ({
      ...p,
      price: Number(p.price),
      score: 0.8, // High confidence since based on purchase history
    }))
  } catch (error) {
    console.error('Error getting personalized recommendations:', error)
    return []
  }
}
