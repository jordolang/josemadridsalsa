/**
 * Shopping cart endpoints.
 * All cart endpoints require authentication.
 */

import { authGet, authPost, authPatch, authDelete } from './client';
import type {
  CartResponse,
  AddCartItemRequest,
  AddCartItemResponse,
  UpdateCartItemRequest,
} from './types';

/**
 * Fetch the authenticated user's server-side cart.
 *
 * @returns Cart with items, item count, total quantity, and subtotal (cents)
 * @throws {ApiError} With status 401 if not authenticated
 */
export async function getCart(): Promise<CartResponse> {
  return authGet<CartResponse>('/api/cart');
}

/**
 * Add a product to the cart (or increment quantity if already present).
 *
 * @param data - Product ID and quantity to add
 * @returns The created or updated cart item with product details
 * @throws {ApiError} With status 422 if product is out of stock
 */
export async function addToCart(data: AddCartItemRequest): Promise<AddCartItemResponse> {
  return authPost<AddCartItemResponse>('/api/cart', data);
}

/**
 * Update the quantity of a cart item.
 *
 * @param cartItemId - The cart item ID (not the product ID)
 * @param data - New quantity value
 * @returns Updated cart item
 */
export async function updateCartItem(
  cartItemId: string,
  data: UpdateCartItemRequest
): Promise<unknown> {
  return authPatch(`/api/cart/${cartItemId}`, data);
}

/**
 * Remove an item from the cart entirely.
 *
 * @param cartItemId - The cart item ID to remove
 * @returns Confirmation of removal
 */
export async function removeCartItem(cartItemId: string): Promise<unknown> {
  return authDelete(`/api/cart/${cartItemId}`);
}

/**
 * Recover an abandoned cart by recovery token (from email links).
 *
 * This endpoint is public -- no authentication required.
 *
 * @param token - The cart recovery token from the abandoned cart email
 * @returns Recovered cart data
 */
export async function recoverCart(token: string): Promise<unknown> {
  // This endpoint is public (recovery links from emails)
  const { post } = await import('./client');
  return post('/api/cart/recover', { token });
}
