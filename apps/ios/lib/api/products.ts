/**
 * Product catalog endpoints.
 * All product endpoints are public (no auth required).
 */

import { get } from './client';
import type { Product, ProductQueryParams } from './types';

/**
 * Fetch products with optional filters.
 *
 * @param params - Optional query filters (heat level, search, pagination, sort, etc.)
 * @returns Array of products matching the filter criteria
 * @throws {ApiError} On backend errors
 * @throws {NetworkError} On network failures
 *
 * @example
 * ```ts
 * const hotSalsas = await getProducts({ heatLevel: 'HOT', inStock: 'true' });
 * ```
 */
export async function getProducts(params?: ProductQueryParams): Promise<Product[]> {
  return get<Product[]>('/api/products', params as Record<string, string | number | boolean | undefined>);
}

/**
 * Fetch featured products (curated homepage selection).
 *
 * @returns Array of products marked as featured by admins
 */
export async function getFeaturedProducts(): Promise<Product[]> {
  return get<Product[]>('/api/products/featured');
}

/**
 * Search products by text query against name, description, and keywords.
 *
 * @param query - Free-text search string
 * @returns Array of products matching the search query
 */
export async function searchProducts(query: string): Promise<Product[]> {
  return get<Product[]>('/api/products/search', { q: query });
}

/**
 * Fetch a single product by ID.
 *
 * Note: The backend route is `/api/products/[id]` (by CUID, not slug).
 *
 * @param productId - The CUID of the product to fetch
 * @returns The full product object including nutritional info and ingredients
 * @throws {ApiError} With status 404 if the product does not exist
 */
export async function getProduct(productId: string): Promise<Product> {
  return get<Product>(`/api/products/${productId}`);
}

/**
 * Fetch product recommendations for a given product.
 *
 * @param productId - The CUID of the product to get recommendations for
 * @returns Array of related/similar products
 */
export async function getProductRecommendations(productId: string): Promise<Product[]> {
  return get<Product[]>(`/api/products/${productId}/recommendations`);
}

/**
 * Fetch salsas (alias for products endpoint used by the storefront).
 */
export async function getSalsas(): Promise<Product[]> {
  return get<Product[]>('/api/salsas');
}

/**
 * Fetch featured salsas.
 */
export async function getFeaturedSalsas(): Promise<Product[]> {
  return get<Product[]>('/api/salsas/featured');
}
