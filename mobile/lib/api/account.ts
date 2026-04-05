/**
 * Account management endpoints.
 * All account endpoints require authentication.
 *
 * NOTE: The backend currently only has /api/account/payment-methods.
 * Address management is handled through the Order model (inline addresses).
 * A dedicated /api/account/addresses endpoint does not yet exist.
 * Profile updates go through /api/admin/settings/profile (admin only).
 */

import { authGet } from './client';
import type { SavedPaymentMethod } from './types';

/**
 * Fetch saved payment methods for the authenticated user.
 *
 * Returns Stripe saved cards via the user's `stripeCustomerId`.
 *
 * @returns Array of saved cards with brand, last4, expiry, and default status
 * @throws {ApiError} With status 401 if not authenticated
 */
export async function getPaymentMethods(): Promise<SavedPaymentMethod[]> {
  return authGet<SavedPaymentMethod[]>('/api/account/payment-methods');
}

// TODO: The following endpoints do not exist in the backend yet.
// They would need to be created if we want to support:
// - GET/POST/PUT/DELETE /api/account/addresses (address book management)
// - GET/PUT /api/account/profile (profile updates for non-admin users)
// - PUT /api/account/password (password change for authenticated users)
