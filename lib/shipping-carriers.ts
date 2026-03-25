/**
 * Shipping carrier constants
 *
 * Centralizes carrier identifiers and labels used across
 * admin settings, API validation, and rate calculation.
 */

export const ALLOWED_CARRIERS = ['usps', 'ups', 'fedex'] as const

export type CarrierId = (typeof ALLOWED_CARRIERS)[number]

export const CARRIER_LABELS: Record<CarrierId, string> = {
  usps: 'USPS',
  ups: 'UPS',
  fedex: 'FedEx',
}
