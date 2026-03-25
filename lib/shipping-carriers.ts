export const ALLOWED_CARRIERS = ['usps', 'ups', 'fedex'] as const

export type AllowedCarrier = (typeof ALLOWED_CARRIERS)[number]

export const CARRIER_LABELS: Record<AllowedCarrier, string> = {
  usps: 'USPS',
  ups: 'UPS',
  fedex: 'FedEx',
}
