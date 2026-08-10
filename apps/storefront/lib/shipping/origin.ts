import { prisma } from '@/lib/prisma'
import type { ShippingAddress } from '@/lib/shipping-api'

/**
 * Where parcels ship from.
 *
 * There were three answers to this before, under two different environment variable names:
 *
 * - `lib/shipping-calculator.ts` quoted rates from `SHIPPING_ORIGIN_ADDRESS`/`_CITY`/`_STATE`/`_ZIP`,
 *   defaulting to **`123 Main St, San Francisco, CA 94111`** when unset.
 * - The label routes bought postage from `SHIP_FROM_STREET`/`_CITY`/`_STATE`/`_ZIP`/`_NAME`.
 * - `ShippingSettings.originAddress` held an admin-editable copy in the database.
 *
 * So the address a customer was quoted from and the address the parcel actually left from were
 * independently configured, and a half-configured deployment quoted every rate from the wrong
 * coast — silently, because the placeholder made the response look perfectly normal.
 *
 * One resolver, one precedence: **database, then environment.** It returns `null` rather than a
 * placeholder when the address is incomplete, because a made-up origin produces confident wrong
 * prices, which is worse than a missing one.
 */

export interface ShippingOrigin extends ShippingAddress {
  name: string
  street1: string
  city: string
  state: string
  zip: string
  country: string
}

export type OriginResolution =
  | { ok: true; origin: ShippingOrigin }
  | { ok: false; missing: string[] }

interface OriginParts {
  name?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  country?: string | null
}

const clean = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Validate and shape parts into an origin, naming what is absent. */
export function resolveOriginFrom(parts: OriginParts): OriginResolution {
  const street = clean(parts.street)
  const city = clean(parts.city)
  const state = clean(parts.state)
  const zip = clean(parts.zipCode)

  const missing: string[] = []
  if (!street) missing.push('street')
  if (!city) missing.push('city')
  if (!state) missing.push('state')
  if (!zip) missing.push('postal code')

  if (missing.length > 0) {
    return { ok: false, missing }
  }

  return {
    ok: true,
    origin: {
      name: clean(parts.name) ?? 'Jose Madrid Salsa',
      street1: street!,
      city: city!,
      state: state!,
      zip: zip!,
      country: clean(parts.country) ?? 'US',
    },
  }
}

/**
 * Origin from the environment.
 *
 * Reads both historical prefixes so an existing deployment configured either way keeps working.
 * `SHIPPING_ORIGIN_*` wins because it was the one the rate quoting used, and quotes are the thing
 * customers see.
 */
export function originFromEnv(): OriginResolution {
  return resolveOriginFrom({
    name: process.env.SHIP_FROM_NAME,
    street: process.env.SHIPPING_ORIGIN_ADDRESS || process.env.SHIP_FROM_STREET,
    city: process.env.SHIPPING_ORIGIN_CITY || process.env.SHIP_FROM_CITY,
    state: process.env.SHIPPING_ORIGIN_STATE || process.env.SHIP_FROM_STATE,
    zipCode: process.env.SHIPPING_ORIGIN_ZIP || process.env.SHIP_FROM_ZIP,
    country: process.env.SHIPPING_ORIGIN_COUNTRY || process.env.SHIP_FROM_COUNTRY,
  })
}

/**
 * The origin to use, database first.
 *
 * Never throws — a database that is unreachable falls through to the environment, because
 * failing to quote shipping should not be able to take checkout down.
 */
export async function getShippingOrigin(): Promise<OriginResolution> {
  try {
    const settings = await prisma.shippingSettings.findUnique({
      where: { singleton: 'singleton' },
      select: { originAddress: true },
    })

    const stored = settings?.originAddress as OriginParts | null
    if (stored) {
      const resolved = resolveOriginFrom({
        name: stored.name ?? process.env.SHIP_FROM_NAME,
        street: stored.street,
        city: stored.city,
        state: stored.state,
        zipCode: stored.zipCode,
        country: stored.country,
      })
      if (resolved.ok) return resolved
    }
  } catch (error) {
    console.error('[Shipping Origin] Could not read shipping settings:', error)
  }

  return originFromEnv()
}

/** One-line explanation for a log or an error shown to staff. */
export function describeMissingOrigin(missing: string[]): string {
  return `The warehouse address is incomplete (missing ${missing.join(', ')}). Set it under Settings → Shipping, or via the SHIPPING_ORIGIN_* environment variables.`
}
