import type { Experiment, Result } from '@growthbook/growthbook-react'

import { trackEvent } from '@/lib/analytics/amplitude'

/**
 * Forwards GrowthBook experiment exposures to Amplitude using the conventional
 * `Experiment Viewed` event name so experiment dashboards line up with
 * downstream conversion events. Skips users that didn't actually land in the
 * experiment so exposure counts reflect real assignments.
 */
export function amplitudeTrackingCallback<T>(
  experiment: Experiment<T>,
  result: Result<T>,
): void {
  if (!result.inExperiment) return
  trackEvent('Experiment Viewed', {
    experiment_id: experiment.key,
    variation_id: result.variationId,
    variation_key: result.key,
    hash_attribute: result.hashAttribute,
    hash_value: result.hashValue,
  })
}

/**
 * Location where a recommendation was displayed or interacted with.
 */
export type RecommendationContext = 'homepage' | 'pdp' | 'email' | 'cart' | 'checkout'

interface RecommendationProduct {
  id: string
  name: string
  slug: string
  price: number
  heatLevel?: string
  score?: number
}

/**
 * Track when recommendations are displayed to a user.
 * Call this when recommendation results are successfully loaded and shown.
 *
 * @param context - Where the recommendations are shown (homepage, pdp, email, etc.)
 * @param products - Array of recommended products being displayed
 * @param sourceProductId - Optional ID of the product that triggered these recommendations (for PDP context)
 */
export function trackRecommendationViewed(
  context: RecommendationContext,
  products: RecommendationProduct[],
  sourceProductId?: string,
): void {
  trackEvent('Recommendation Viewed', {
    context,
    recommendation_count: products.length,
    product_ids: products.map((p) => p.id),
    source_product_id: sourceProductId,
  })
}

/**
 * Track when a user clicks on a recommended product.
 * Call this when a recommendation link/card is clicked.
 *
 * @param context - Where the click occurred (homepage, pdp, email, etc.)
 * @param product - The recommended product that was clicked
 * @param position - Zero-based position of the product in the recommendation list
 * @param sourceProductId - Optional ID of the product that triggered this recommendation (for PDP context)
 */
export function trackRecommendationClicked(
  context: RecommendationContext,
  product: RecommendationProduct,
  position: number,
  sourceProductId?: string,
): void {
  trackEvent('Recommendation Clicked', {
    context,
    product_id: product.id,
    product_name: product.name,
    product_slug: product.slug,
    product_price: product.price,
    product_heat_level: product.heatLevel,
    recommendation_score: product.score,
    position,
    source_product_id: sourceProductId,
  })
}

/**
 * Track when a recommended product is purchased.
 * Call this from order confirmation flow when an item in the order was previously recommended.
 *
 * @param context - Where the recommendation that led to purchase was shown
 * @param product - The recommended product that was purchased
 * @param quantity - Number of units purchased
 * @param orderId - The order ID containing this purchase
 */
export function trackRecommendationPurchased(
  context: RecommendationContext,
  product: RecommendationProduct,
  quantity: number,
  orderId: string,
): void {
  trackEvent('Recommendation Purchased', {
    context,
    product_id: product.id,
    product_name: product.name,
    product_price: product.price,
    quantity,
    revenue: product.price * quantity,
    order_id: orderId,
  })
}
