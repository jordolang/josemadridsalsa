/**
 * Order history endpoints.
 * All order endpoints require authentication.
 */

import { authGet } from './client';
import type { Order, OrderQueryParams } from './types';

/**
 * Fetch the authenticated user's orders with optional filters.
 *
 * @param params - Optional filters for status, payment status, pagination, and sort
 * @returns Array of orders with line items
 * @throws {ApiError} With status 401 if not authenticated
 *
 * @example
 * ```ts
 * const recent = await getOrders({ take: 5, sortOrder: 'desc' });
 * ```
 */
export async function getOrders(params?: OrderQueryParams): Promise<Order[]> {
  return authGet<Order[]>(
    '/api/orders',
    params as Record<string, string | number | boolean | undefined>
  );
}

/**
 * Fetch a single order by ID with full line item details.
 *
 * @param orderId - The order ID to fetch
 * @returns The full order object including items, totals, and tracking info
 * @throws {ApiError} With status 404 if the order does not exist
 */
export async function getOrder(orderId: string): Promise<Order> {
  return authGet<Order>(`/api/orders/${orderId}`);
}
