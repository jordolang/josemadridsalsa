/**
 * Wishlist endpoints.
 * GET returns empty array for unauthenticated users.
 * POST/DELETE require authentication.
 */

import { authGet, authPost, authDelete } from './client';
import type { WishlistResponse, WishlistItem } from './types';

/**
 * Fetch the user's wishlist.
 *
 * @returns Wishlist with product items, or empty items array if not authenticated
 */
export async function getWishlist(): Promise<WishlistResponse> {
  return authGet<WishlistResponse>('/api/wishlist');
}

/**
 * Add a product to the wishlist.
 *
 * @param productId - The product ID to add
 * @returns The created wishlist item with full product details
 * @throws {ApiError} With status 401 if not authenticated
 */
export async function addToWishlist(productId: string): Promise<WishlistItem> {
  return authPost<WishlistItem>('/api/wishlist', { productId });
}

/**
 * Remove a product from the wishlist.
 *
 * @param productId - The product ID to remove
 * @returns Confirmation message
 */
export async function removeFromWishlist(productId: string): Promise<{ message: string }> {
  return authDelete<{ message: string }>('/api/wishlist', { productId });
}
