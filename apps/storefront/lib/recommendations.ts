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
 * Get "Frequently Bought Together" recommendations for a product.
 *
 * Analyses the last 100 orders containing the target product and ranks
 * co-purchased products by occurrence frequency. Out-of-stock and inactive
 * products are excluded from results.
 *
 * @param {string} productId - The ID of the product to find companions for.
 * @param {number} [limit=4] - Maximum number of recommendations to return.
 * @returns {Promise<RecommendedProduct[]>} Ranked array of recommended products with normalised scores (0–1).
 */
export async function getFrequentlyBoughtTogether(
  productId: string,
  limit: number = 4
): Promise<RecommendedProduct[]> {
  const isDev = process.env.NODE_ENV === 'development'
  try {
    const startTime = isDev ? Date.now() : 0
    if (isDev) {
      console.log('[Recommendations] getFrequentlyBoughtTogether: Starting query for productId:', productId)
    }

    const results = await prisma.$queryRaw<
      Array<{
        id: string
        name: string
        slug: string
        price: number
        featuredImage: string | null
        heatLevel: string | null
        sku: string
        inventory: number
        co_occurrence_count: number
        max_count: number
      }>
    >`
      WITH orders_with_product AS (
        SELECT DISTINCT "orderId"
        FROM order_items
        WHERE "productId" = ${productId}
        ORDER BY "orderId" DESC
        LIMIT 100
      ),
      co_occurrences AS (
        SELECT
          oi."productId",
          COUNT(DISTINCT oi."orderId")::int AS co_occurrence_count
        FROM order_items oi
        INNER JOIN orders_with_product owp ON owp."orderId" = oi."orderId"
        WHERE oi."productId" != ${productId}
        GROUP BY oi."productId"
        ORDER BY co_occurrence_count DESC
        LIMIT ${limit * 2}
      ),
      co_occurrences_with_max AS (
        SELECT
          "productId",
          co_occurrence_count,
          MAX(co_occurrence_count) OVER ()::int AS max_count
        FROM co_occurrences
      )
      SELECT
        p.id,
        p.name,
        p.slug,
        p.price::float AS price,
        p."featuredImage",
        p."heatLevel",
        p.sku,
        p.inventory,
        co.co_occurrence_count,
        co.max_count
      FROM co_occurrences_with_max co
      INNER JOIN products p ON p.id = co."productId"
      WHERE p."isActive" = true AND p.inventory > 0
      ORDER BY co.co_occurrence_count DESC
      LIMIT ${limit}
    `

    if (isDev) {
      const duration = Date.now() - startTime
      console.log(`[Recommendations] getFrequentlyBoughtTogether: Query completed in ${duration}ms (${results.length} results)`)
    }

    // Calculate normalized scores
    return results.map(product => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: Number(product.price),
      featuredImage: product.featuredImage,
      heatLevel: product.heatLevel,
      sku: product.sku,
      inventory: product.inventory,
      score: product.max_count > 0 ? product.co_occurrence_count / product.max_count : 0,
    }))
  } catch (error) {
    console.error('Error getting frequently bought together:', error)
    return []
  }
}

/**
 * Get "You May Also Like" recommendations based on product similarity.
 *
 * Scores candidates by:
 * - Same heat level (+0.4)
 * - Same category (+0.4)
 * - Price within 30% of the source product (+0.2)
 *
 * @param {string} productId - The ID of the source product.
 * @param {number} [limit=8] - Maximum number of recommendations to return.
 * @returns {Promise<RecommendedProduct[]>} Similarity-scored recommendations, sorted descending.
 */
export async function getYouMayAlsoLike(
  productId: string,
  limit: number = 8
): Promise<RecommendedProduct[]> {
  const isDev = process.env.NODE_ENV === 'development'
  try {
    const startTime = isDev ? Date.now() : 0
    if (isDev) {
      console.log('[Recommendations] getYouMayAlsoLike: Starting query for productId:', productId)
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        categoryId: true,
        heatLevel: true,
        price: true,
      },
    })

    if (isDev) {
      const duration = Date.now() - startTime
      console.log(`[Recommendations] getYouMayAlsoLike: Product lookup completed in ${duration}ms`)
    }

    if (!product) {
      return []
    }

    // Find similar products
    const similarStartTime = isDev ? Date.now() : 0
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

    if (isDev) {
      const similarDuration = Date.now() - similarStartTime
      const totalDuration = Date.now() - startTime
      console.log(`[Recommendations] getYouMayAlsoLike: Similar products query completed in ${similarDuration}ms (${similarProducts.length} results)`)
      console.log(`[Recommendations] getYouMayAlsoLike: Total execution time ${totalDuration}ms`)
    }

    // Calculate similarity scores
    return similarProducts
      .map(p => {
        let score = 0

        // Same heat level = +0.4 (prioritized for better recommendations)
        if (p.heatLevel === product.heatLevel) score += 0.4

        // Same category = +0.4 (flavor profile matching)
        if (p.categoryId === product.categoryId) score += 0.4

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

export interface PersonalizedRecommendationsOptions {
  limit?: number
  heatLevels?: string[]
  categoryIds?: string[]
}

/**
 * Get personalised product recommendations for an authenticated user.
 *
 * Derives the user's top category and heat-level preferences from their
 * last 10 paid orders, then surfaces in-stock products matching those
 * preferences that the user has not yet purchased.
 *
 * Optionally accepts browsing behavior filters (heatLevels, categoryIds) which
 * override purchase history preferences to support real-time personalization.
 *
 * @param {string} userId - The authenticated user's ID.
 * @param {number | PersonalizedRecommendationsOptions} [limitOrOptions=8] - Maximum number of recommendations or options object.
 * @returns {Promise<RecommendedProduct[]>} Personalised recommendations with a fixed confidence score of 0.8.
 */
export async function getPersonalizedRecommendations(
  userId: string,
  limitOrOptions: number | PersonalizedRecommendationsOptions = 8
): Promise<RecommendedProduct[]> {
  // Parse options for backwards compatibility
  const options: PersonalizedRecommendationsOptions =
    typeof limitOrOptions === 'number'
      ? { limit: limitOrOptions }
      : limitOrOptions

  const limit = options.limit ?? 8
  const browsingHeatLevels = options.heatLevels
  const browsingCategoryIds = options.categoryIds
  const isDev = process.env.NODE_ENV === 'development'
  try {
    const startTime = isDev ? Date.now() : 0
    if (isDev) {
      console.log('[Recommendations] getPersonalizedRecommendations: Starting query for userId:', userId)
    }

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

    if (isDev) {
      const duration = Date.now() - startTime
      console.log(`[Recommendations] getPersonalizedRecommendations: Order history query completed in ${duration}ms (${userOrders.length} orders)`)
    }

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

    // Determine preferences: use browsing behavior if provided, otherwise use purchase history
    let targetCategories: string[] | undefined
    let targetHeatLevels: string[] | undefined

    if (browsingCategoryIds && browsingCategoryIds.length > 0) {
      targetCategories = browsingCategoryIds
    } else {
      const topCategory = Array.from(categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
      if (topCategory) {
        targetCategories = [topCategory]
      }
    }

    if (browsingHeatLevels && browsingHeatLevels.length > 0) {
      targetHeatLevels = browsingHeatLevels
    } else {
      const topHeatLevel = Array.from(heatLevels.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
      if (topHeatLevel) {
        targetHeatLevels = [topHeatLevel]
      }
    }

    // Build OR conditions based on available preferences
    const orConditions = []
    if (targetCategories && targetCategories.length > 0) {
      orConditions.push({ categoryId: { in: targetCategories } })
    }
    if (targetHeatLevels && targetHeatLevels.length > 0) {
      orConditions.push({ heatLevel: { in: targetHeatLevels as any } })
    }

    // If no preferences available, return empty array
    if (orConditions.length === 0) {
      return []
    }

    // Find products matching preferences
    const recommendationsStartTime = isDev ? Date.now() : 0
    const recommendations = await prisma.product.findMany({
      where: {
        id: { notIn: Array.from(purchasedProductIds) }, // Exclude already purchased
        isActive: true,
        inventory: { gt: 0 },
        OR: orConditions,
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

    if (isDev) {
      const recommendationsDuration = Date.now() - recommendationsStartTime
      const totalDuration = Date.now() - startTime
      console.log(`[Recommendations] getPersonalizedRecommendations: Products query completed in ${recommendationsDuration}ms (${recommendations.length} results)`)
      console.log(`[Recommendations] getPersonalizedRecommendations: Total execution time ${totalDuration}ms`)
    }

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

/**
 * Get complementary product recommendations for post-purchase emails.
 *
 * Suggests products with different heat levels but similar categories to expand
 * the customer's flavor exploration while staying within familiar categories.
 *
 * Scores candidates by:
 * - Different heat level (+0.5)
 * - Same category as purchased products (+0.5)
 *
 * @param {string[]} productIds - Array of purchased product IDs.
 * @param {number} [limit=4] - Maximum number of recommendations to return.
 * @returns {Promise<RecommendedProduct[]>} Complementary recommendations, sorted by score descending.
 */
export async function getComplementaryRecommendations(
  productIds: string[],
  limit: number = 4
): Promise<RecommendedProduct[]> {
  const isDev = process.env.NODE_ENV === 'development'
  try {
    // Return early if no products provided
    if (productIds.length === 0) {
      return []
    }

    const startTime = isDev ? Date.now() : 0
    if (isDev) {
      console.log('[Recommendations] getComplementaryRecommendations: Starting query for productIds:', productIds)
    }

    // Fetch purchased products to analyze their attributes
    const purchasedProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        categoryId: true,
        heatLevel: true,
      },
    })

    if (isDev) {
      const duration = Date.now() - startTime
      console.log(`[Recommendations] getComplementaryRecommendations: Purchased products query completed in ${duration}ms (${purchasedProducts.length} products)`)
    }

    // Extract categories and heat levels from purchased products
    const purchasedCategories = new Set<string>()
    const purchasedHeatLevels = new Set<string>()

    purchasedProducts.forEach(product => {
      if (product.categoryId) {
        purchasedCategories.add(product.categoryId)
      }
      if (product.heatLevel) {
        purchasedHeatLevels.add(product.heatLevel)
      }
    })

    // Return early if no valid categories or heat levels
    if (purchasedCategories.size === 0 && purchasedHeatLevels.size === 0) {
      return []
    }

    // Find complementary products
    const complementaryStartTime = isDev ? Date.now() : 0
    const complementaryProducts = await prisma.product.findMany({
      where: {
        id: { notIn: productIds }, // Exclude already purchased
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
        categoryId: true,
      },
      take: limit * 3, // Fetch more to allow filtering
    })

    if (isDev) {
      const complementaryDuration = Date.now() - complementaryStartTime
      const totalDuration = Date.now() - startTime
      console.log(`[Recommendations] getComplementaryRecommendations: Complementary products query completed in ${complementaryDuration}ms (${complementaryProducts.length} results)`)
      console.log(`[Recommendations] getComplementaryRecommendations: Total execution time ${totalDuration}ms`)
    }

    // Score and filter complementary products
    const scoredProducts = complementaryProducts
      .map(p => {
        let score = 0

        // Only recommend products with DIFFERENT heat levels (complementary variety)
        if (p.heatLevel && purchasedHeatLevels.has(p.heatLevel)) {
          return null // Filter out same heat levels
        }

        // Different heat level = +0.5 (core requirement for complementary)
        if (p.heatLevel) {
          score += 0.5
        }

        // Same category = +0.5 (familiar flavor profile)
        if (p.categoryId && purchasedCategories.has(p.categoryId)) {
          score += 0.5
        }

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          featuredImage: p.featuredImage,
          heatLevel: p.heatLevel as string | null,
          sku: p.sku,
          inventory: p.inventory,
          score,
        }
      })
      .filter(
        (
          p,
        ): p is {
          id: string
          name: string
          slug: string
          price: number
          featuredImage: string | null
          heatLevel: string | null
          sku: string
          inventory: number
          score: number
        } => p !== null,
      ) // Remove filtered products
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return scoredProducts as RecommendedProduct[]
  } catch (error) {
    console.error('Error getting complementary recommendations:', error)
    return []
  }
}
