import type { PaymentChannel, SalesChannel } from '@prisma/client'

/**
 * The order facts that determine where a sale came from. All optional because
 * different creation paths know different subsets.
 */
export interface SalesChannelSignals {
  fundraiserId?: string | null
  participantId?: string | null
  paymentChannel?: PaymentChannel | null
  importSource?: string | null
  /** Set explicitly by paths that already know the answer (manual entry, phone orders). */
  explicitChannel?: SalesChannel | null
}

/**
 * Derive an order's sales channel.
 *
 * The conditions genuinely overlap — a fundraiser sale can be rung up on the POS
 * terminal — so the precedence below is a business decision, not an accident of
 * ordering.
 *
 *   1. explicit   — the caller already knows (manual, phone, marketplace)
 *   2. fundraiser — campaign attribution outranks the terminal the sale was taken on
 *   3. POS        — in-person
 *   4. import     — historical/migrated rows
 *   5. website    — the default
 */
export function deriveSalesChannel(signals: SalesChannelSignals): SalesChannel {
  if (signals.explicitChannel) return signals.explicitChannel
  if (signals.fundraiserId || signals.participantId) return 'FUNDRAISER'
  if (signals.paymentChannel === 'POS') return 'POS'
  if (signals.importSource) return 'IMPORT'
  return 'WEBSITE'
}

/** Human labels for admin filters and reports. */
export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  WEBSITE: 'Website',
  POS: 'Point of Sale',
  FUNDRAISER: 'Fundraiser',
  WHOLESALE: 'Wholesale',
  EVENT: 'Event',
  MANUAL: 'Manual',
  MARKETPLACE: 'Marketplace',
  PHONE: 'Phone',
  IMPORT: 'Imported',
}
