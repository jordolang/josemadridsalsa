/**
 * Pirate Ship shipping automation
 * José Madrid Salsa E-commerce Platform
 *
 * Pirate Ship has no public API. Their supported automation path is a
 * spreadsheet import: you upload a CSV with a header row, map the columns once
 * (Pirate Ship remembers the mapping), then batch-buy and print labels at your
 * negotiated rates. This module produces that import file from orders and
 * matches Pirate Ship's tracking export back to orders to close the loop.
 *
 * It is intentionally framework-free (no Prisma / Next imports) so the mapping
 * and parcel logic can be unit-tested in isolation. Routes adapt Prisma models
 * to these plain inputs.
 *
 * @module lib/shipping/pirate-ship
 */

import { toCsv, detectMapping, mappedCell } from '@/lib/csv'

/**
 * Column headers for the Pirate Ship import file, in output order.
 *
 * Any header names work in Pirate Ship (it maps fields on first import), but
 * these match its own template wording so the initial mapping is one click.
 * Weight is split into whole pounds + remainder ounces because Pirate Ship's
 * importer maps a Pounds column and an Ounces column separately.
 */
export const PIRATE_SHIP_HEADERS = [
  'Order',
  'Name',
  'Company',
  'Email',
  'Phone',
  'Address 1',
  'Address 2',
  'City',
  'State',
  'Zip',
  'Country',
  'Weight (lb)',
  'Weight (oz)',
  'Length (in)',
  'Width (in)',
  'Height (in)',
  'Items',
] as const

/**
 * Fallback per-unit shipped weight (pounds) when a product has no weight set.
 * A retail jar of salsa with its glass and packaging runs a bit over a pound.
 */
export const DEFAULT_UNIT_WEIGHT_LB = 1.2

/** Box + dunnage tare added to every parcel (pounds). */
export const PACKAGING_TARE_LB = 0.5

/**
 * Standard outer-box sizes (inches, L x W x H), smallest first. Used when the
 * order's products don't carry their own dimensions — the box is chosen from
 * the total number of units so a typical salsa order lands in a sane box.
 */
const STANDARD_BOXES = [
  { maxUnits: 3, length: 8, width: 6, height: 4 },
  { maxUnits: 8, length: 11, width: 8.5, height: 5.5 },
  { maxUnits: 16, length: 16, width: 12, height: 8 },
  { maxUnits: Infinity, length: 18, width: 14, height: 12 },
] as const

/** A single order line as far as parcel math is concerned. */
export interface ParcelItemInput {
  quantity: number
  /** Per-unit weight in pounds. Null/undefined falls back to the default. */
  weightLb?: number | null
  lengthIn?: number | null
  widthIn?: number | null
  heightIn?: number | null
}

/** Computed parcel: total shipped weight (split lb/oz) and outer dimensions. */
export interface ComputedParcel {
  weightLb: number
  weightOz: number
  /** Total weight in whole ounces, for callers that prefer a single figure. */
  totalOunces: number
  lengthIn: number
  widthIn: number
  heightIn: number
  unitCount: number
}

const isPositive = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0

/**
 * Compute a shippable parcel for an order.
 *
 * Weight = sum(per-unit weight x quantity) + packaging tare, where a missing
 * per-unit weight falls back to {@link DEFAULT_UNIT_WEIGHT_LB}. Dimensions use
 * the largest per-product box among the line items when products carry their
 * own dimensions; otherwise a standard box is picked by total unit count.
 */
export function computeParcel(items: ParcelItemInput[]): ComputedParcel {
  let totalWeightLb = 0
  let unitCount = 0
  let maxL = 0
  let maxW = 0
  let maxH = 0
  let anyDims = false

  for (const item of items) {
    const qty = isPositive(item.quantity) ? Math.floor(item.quantity) : 0
    if (qty === 0) continue
    unitCount += qty

    const unitWeight = isPositive(item.weightLb)
      ? item.weightLb
      : DEFAULT_UNIT_WEIGHT_LB
    totalWeightLb += unitWeight * qty

    if (isPositive(item.lengthIn) || isPositive(item.widthIn) || isPositive(item.heightIn)) {
      anyDims = true
      maxL = Math.max(maxL, item.lengthIn ?? 0)
      maxW = Math.max(maxW, item.widthIn ?? 0)
      maxH = Math.max(maxH, item.heightIn ?? 0)
    }
  }

  totalWeightLb += PACKAGING_TARE_LB

  // Round total weight up to the nearest ounce; carriers bill by the ounce and
  // rounding down could underpay postage.
  const totalOunces = Math.max(1, Math.ceil(totalWeightLb * 16))
  const weightLb = Math.floor(totalOunces / 16)
  const weightOz = totalOunces - weightLb * 16

  const box = STANDARD_BOXES.find((b) => unitCount <= b.maxUnits) ?? STANDARD_BOXES[STANDARD_BOXES.length - 1]

  return {
    weightLb,
    weightOz,
    totalOunces,
    lengthIn: anyDims ? Math.max(maxL, 1) : box.length,
    widthIn: anyDims ? Math.max(maxW, 1) : box.width,
    heightIn: anyDims ? Math.max(maxH, 1) : box.height,
    unitCount,
  }
}

/** Recipient + reference fields for one shipment row. */
export interface PirateShipRecipient {
  /** Human order reference (e.g. order number) written to the "Order" column. */
  reference: string
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  address1: string
  address2?: string | null
  city: string
  state: string
  zip: string
  country?: string | null
  /** Optional short contents summary printed to the "Items" column. */
  itemsSummary?: string | null
}

const cell = (v: string | null | undefined): string => (v ?? '').toString().trim()

/**
 * Build one Pirate Ship import row (values aligned to {@link PIRATE_SHIP_HEADERS}).
 * Country defaults to US, the store's overwhelming case, when not supplied.
 */
export function buildPirateShipRow(
  recipient: PirateShipRecipient,
  parcel: ComputedParcel
): string[] {
  return [
    cell(recipient.reference),
    cell(recipient.name),
    cell(recipient.company),
    cell(recipient.email),
    cell(recipient.phone),
    cell(recipient.address1),
    cell(recipient.address2),
    cell(recipient.city),
    cell(recipient.state),
    cell(recipient.zip),
    cell(recipient.country) || 'US',
    String(parcel.weightLb),
    String(parcel.weightOz),
    String(parcel.lengthIn),
    String(parcel.widthIn),
    String(parcel.heightIn),
    cell(recipient.itemsSummary),
  ]
}

/** Serialize one or more shipments to a Pirate Ship import CSV. */
export function buildPirateShipCsv(
  shipments: Array<{ recipient: PirateShipRecipient; parcel: ComputedParcel }>
): string {
  const rows = shipments.map(({ recipient, parcel }) => buildPirateShipRow(recipient, parcel))
  return toCsv([...PIRATE_SHIP_HEADERS], rows)
}

/**
 * Header aliases for parsing Pirate Ship's tracking export back in. Pirate Ship
 * exports a "Ship To"/tracking spreadsheet after you buy labels; the exact
 * headers vary, so match loosely. We only need the order reference (to find the
 * order) and the tracking number; carrier is best-effort.
 */
const TRACKING_ALIASES = {
  reference: ['order', 'ordernumber', 'orderid', 'reference', 'referencenumber'],
  trackingNumber: ['tracking', 'trackingnumber', 'trackingcode', 'tracking'],
  carrier: ['carrier', 'provider', 'service'],
} as const

export type TrackingField = keyof typeof TRACKING_ALIASES

export interface ParsedTrackingRow {
  reference: string
  trackingNumber: string
  carrier: string | null
}

/**
 * Extract (order reference, tracking number, carrier) tuples from parsed rows
 * of a Pirate Ship tracking export. Rows missing a reference or tracking number
 * are skipped. Returns both the usable rows and the detected column mapping so
 * callers can report when a required column was absent.
 */
export function parseTrackingRows(
  headers: string[],
  rows: Record<string, string>[]
): { mapping: Partial<Record<TrackingField, string>>; parsed: ParsedTrackingRow[] } {
  const mapping = detectMapping<TrackingField>(headers, {
    reference: [...TRACKING_ALIASES.reference],
    trackingNumber: [...TRACKING_ALIASES.trackingNumber],
    carrier: [...TRACKING_ALIASES.carrier],
  })

  const parsed: ParsedTrackingRow[] = []
  for (const row of rows) {
    const reference = mappedCell(row, mapping.reference)
    const trackingNumber = mappedCell(row, mapping.trackingNumber)
    if (!reference || !trackingNumber) continue
    parsed.push({
      reference,
      trackingNumber,
      carrier: mappedCell(row, mapping.carrier),
    })
  }

  return { mapping, parsed }
}

/** Build a carrier tracking URL for the common carriers Pirate Ship sells. */
export function trackingUrlFor(carrier: string | null, trackingNumber: string): string | undefined {
  const c = (carrier ?? '').toLowerCase()
  const n = encodeURIComponent(trackingNumber)
  if (c.includes('usps') || /^(94|93|92|95|420)\d/.test(trackingNumber)) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`
  }
  if (c.includes('ups') || /^1Z/i.test(trackingNumber)) {
    return `https://www.ups.com/track?tracknum=${n}`
  }
  if (c.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${n}`
  }
  return undefined
}
