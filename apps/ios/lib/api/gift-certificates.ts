/**
 * Gift certificate endpoints.
 * All gift certificate endpoints are public.
 */

import { post } from './client';
import type {
  GiftCertificateBalanceResponse,
  GiftCertificatePurchaseRequest,
} from './types';

/**
 * Check the balance of a gift certificate.
 *
 * @param code - The gift certificate code (e.g., "GC-ABCD-1234")
 * @returns Balance info including remaining balance, original amount, recipient, and theme
 * @throws {ApiError} With status 404 if the code is invalid
 */
export async function checkBalance(code: string): Promise<GiftCertificateBalanceResponse> {
  return post<GiftCertificateBalanceResponse>('/api/gift-certificates/balance', { code });
}

/**
 * Purchase a new gift certificate.
 *
 * @param data - Purchase details: amount, purchaser/recipient info, theme, and optional message
 * @returns The generated gift certificate code
 */
export async function purchaseGiftCertificate(
  data: GiftCertificatePurchaseRequest
): Promise<{ code: string }> {
  return post<{ code: string }>('/api/gift-certificates/purchase', data);
}
