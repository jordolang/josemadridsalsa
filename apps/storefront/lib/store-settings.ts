import { cache } from 'react'

import { prisma } from '@/lib/prisma'
import { isMissingTableError } from '@/lib/prisma-errors'

/**
 * Store-wide settings, read from the single `store_settings` row and merged over safe defaults.
 *
 * The row is created lazily by the admin save, so before anyone has saved (or if the table has not
 * migrated yet) every reader gets the defaults — the store behaves exactly as it did before this
 * feature. Each field is wired to real behaviour; see the callers listed on the model.
 */
export interface StoreSettings {
  allowGuestCheckout: boolean
  /** Minimum order subtotal in whole cents; 0 means no minimum. */
  minimumOrderCents: number
  businessName: string | null
  supportEmail: string | null
  supportPhone: string | null
  businessAddress: string | null
  defaultLowStockThreshold: number
  termsContent: string | null
  privacyContent: string | null
  returnsContent: string | null
}

export const STORE_SETTINGS_DEFAULTS: StoreSettings = {
  allowGuestCheckout: true,
  minimumOrderCents: 0,
  businessName: null,
  supportEmail: null,
  supportPhone: null,
  businessAddress: null,
  defaultLowStockThreshold: 5,
  termsContent: null,
  privacyContent: null,
  returnsContent: null,
}

/**
 * Read the store settings, falling back to defaults when unset or the table is missing. Wrapped in
 * React `cache` so the many callers in one request (checkout, contact page, product create, …)
 * share a single query.
 */
export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  try {
    const row = await prisma.storeSettings.findUnique({ where: { singleton: 'singleton' } })
    if (!row) return STORE_SETTINGS_DEFAULTS
    return {
      allowGuestCheckout: row.allowGuestCheckout,
      minimumOrderCents: row.minimumOrderCents,
      businessName: row.businessName,
      supportEmail: row.supportEmail,
      supportPhone: row.supportPhone,
      businessAddress: row.businessAddress,
      defaultLowStockThreshold: row.defaultLowStockThreshold,
      termsContent: row.termsContent,
      privacyContent: row.privacyContent,
      returnsContent: row.returnsContent,
    }
  } catch (error) {
    // Before the migration runs, callers should still work on defaults rather than 500.
    if (isMissingTableError(error)) return STORE_SETTINGS_DEFAULTS
    throw error
  }
})

/** Whether an order subtotal (in cents) is under the configured minimum. 0 = no minimum. */
export function isBelowMinimumOrder(subtotalCents: number, minimumOrderCents: number): boolean {
  return minimumOrderCents > 0 && subtotalCents < minimumOrderCents
}

/** "$25.00" for a cents amount — for the minimum-order message shown to a shopper. */
export function formatMinimumOrder(minimumOrderCents: number): string {
  return `$${(minimumOrderCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
