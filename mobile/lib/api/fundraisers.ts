/**
 * Fundraiser endpoints.
 * Public endpoints for browsing fundraisers.
 */

import { get, post } from './client';
import type { Fundraiser } from './types';

/**
 * Fetch all active fundraisers.
 *
 * @returns Array of active fundraisers with organization, goals, and revenue data
 */
export async function getFundraisers(): Promise<Fundraiser[]> {
  return get<Fundraiser[]>('/api/fundraisers');
}

/**
 * Fetch a single fundraiser by ID.
 *
 * @param fundraiserId - The fundraiser CUID
 * @returns Full fundraiser details including revenue and order totals
 * @throws {ApiError} With status 404 if not found
 */
export async function getFundraiser(fundraiserId: string): Promise<Fundraiser> {
  return get<Fundraiser>(`/api/fundraisers/${fundraiserId}`);
}

/**
 * Look up a fundraiser participant by their referral code.
 *
 * @param referralCode - The participant's unique referral code
 * @returns Participant name and associated fundraiser name
 */
export async function lookupParticipant(
  referralCode: string
): Promise<{ participantName: string; fundraiserName: string }> {
  return get(`/api/participants/lookup`, { referralCode });
}

/**
 * Subscribe an email address to the newsletter.
 *
 * @param email - The email address to subscribe
 * @returns `{ success: true }` on successful subscription
 */
export async function subscribeNewsletter(email: string): Promise<{ success: boolean }> {
  return post<{ success: boolean }>('/api/newsletter', { email });
}
