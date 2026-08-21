import { prisma } from '@/lib/prisma'

/**
 * Admin-configurable flat-rate shipping presets.
 *
 * These are the numbers the estimate/fallback path quotes when a live carrier rate is unavailable —
 * no API key, an unset warehouse origin, a PO Box with no USPS rate, or a carrier outage. Live
 * EasyPost rates, when available, still take precedence and are not driven by this config.
 *
 * They used to be the hardcoded `SHIPPING_RATES` constant inside `shipping-calculator.ts`; moving
 * them onto the `ShippingSettings` singleton lets an admin adjust them without a deploy. Every field
 * is optional in the database and falls back to the built-in default here, so a store that never
 * touches the settings quotes exactly what it did before.
 *
 * All money is whole cents; the pure helpers return dollars to match the calculator's existing
 * `number` (dollars) contract. This module is pure except for `getShippingRateConfig`, which reads
 * the singleton and never throws — a database problem must not be able to block a shipping quote.
 */
export interface ShippingRateConfig {
  /** Base flat rate for a domestic order, in cents. */
  flatRateCents: number
  /** Weight-surcharge base, in cents, once an order exceeds the threshold weight. */
  weightSurchargeBaseCents: number
  /** Weight-surcharge amount per pound over the threshold, in cents. */
  weightSurchargePerLbCents: number
  /** Weight (whole pounds) above which the weight surcharge replaces the flat rate. */
  weightSurchargeThresholdLb: number
  /** Flat international rate, in cents. */
  internationalRateCents: number
  /** Per-state cost multipliers for remote destinations, keyed by uppercase state code. */
  stateSurcharges: Record<string, number>
}

/**
 * The built-in defaults — identical to the values that were hardcoded in the calculator
 * (`$6.99` flat, `$4.99 + $0.50/lb` over 5 lb, `$24.99` international, AK/HI ×1.5, PR ×2.0).
 */
export const DEFAULT_RATE_CONFIG: ShippingRateConfig = {
  flatRateCents: 699,
  weightSurchargeBaseCents: 499,
  weightSurchargePerLbCents: 50,
  weightSurchargeThresholdLb: 5,
  internationalRateCents: 2499,
  stateSurcharges: { AK: 1.5, HI: 1.5, PR: 2.0 },
}

/** The nullable columns as stored on the `ShippingSettings` row. */
export interface StoredRateConfig {
  flatRateCents?: number | null
  weightSurchargeBaseCents?: number | null
  weightSurchargePerLbCents?: number | null
  weightSurchargeThresholdLb?: number | null
  internationalRateCents?: number | null
  stateSurcharges?: unknown
}

/** A non-negative integer stored value, or the default when the stored value is absent/invalid. */
function intOrDefault(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback
}

/**
 * Read a stored state-surcharge map, keeping only entries whose value is a finite multiplier > 0.
 *
 * The distinction that matters: an **absent** value (null/undefined — the store never configured
 * surcharges) falls back to the default map, but an **explicit object** the admin saved is honoured
 * as-is, *including an empty one*. That's how clearing every multiplier means "no surcharge (×1)"
 * rather than silently restoring the built-in AK/HI/PR defaults. A non-object/array blob is
 * malformed and also falls back rather than zeroing a rate.
 */
export function parseStateSurcharges(
  value: unknown,
  fallback: Record<string, number>
): Record<string, number> {
  if (value === null || value === undefined) return fallback
  if (typeof value !== 'object' || Array.isArray(value)) return fallback
  const out: Record<string, number> = {}
  for (const [state, multiplier] of Object.entries(value as Record<string, unknown>)) {
    if (typeof multiplier === 'number' && Number.isFinite(multiplier) && multiplier > 0) {
      out[state.toUpperCase()] = multiplier
    }
  }
  return out
}

/** Merge a stored (partially-null) row over the built-in defaults into a complete config. */
export function resolveRateConfig(stored: StoredRateConfig | null | undefined): ShippingRateConfig {
  if (!stored) return DEFAULT_RATE_CONFIG
  return {
    flatRateCents: intOrDefault(stored.flatRateCents, DEFAULT_RATE_CONFIG.flatRateCents),
    weightSurchargeBaseCents: intOrDefault(
      stored.weightSurchargeBaseCents,
      DEFAULT_RATE_CONFIG.weightSurchargeBaseCents
    ),
    weightSurchargePerLbCents: intOrDefault(
      stored.weightSurchargePerLbCents,
      DEFAULT_RATE_CONFIG.weightSurchargePerLbCents
    ),
    weightSurchargeThresholdLb: intOrDefault(
      stored.weightSurchargeThresholdLb,
      DEFAULT_RATE_CONFIG.weightSurchargeThresholdLb
    ),
    internationalRateCents: intOrDefault(
      stored.internationalRateCents,
      DEFAULT_RATE_CONFIG.internationalRateCents
    ),
    stateSurcharges: parseStateSurcharges(stored.stateSurcharges, DEFAULT_RATE_CONFIG.stateSurcharges),
  }
}

/** The multiplier for a destination state, defaulting to 1 (no surcharge). */
export function stateMultiplier(state: string, config: ShippingRateConfig): number {
  return config.stateSurcharges[state.trim().toUpperCase()] ?? 1
}

/**
 * Round a dollar amount to cents. Uses `toFixed(2)` to match the calculator's long-standing
 * rounding exactly (e.g. `6.99 * 1.5` → `10.48`, not `10.49`), so moving these numbers into config
 * doesn't shift a single existing quote.
 */
function toMoney(dollars: number): number {
  return parseFloat(dollars.toFixed(2))
}

/**
 * The domestic estimate cost, in dollars: the flat rate, bumped to the weight-based price once the
 * order is over the threshold, then scaled by the destination's state multiplier. Mirrors the math
 * the calculator has always used — only the numbers are now configurable.
 */
export function estimateDomesticCost(input: {
  pounds: number
  state: string
  config: ShippingRateConfig
}): number {
  const { pounds, state, config } = input
  const flat = config.flatRateCents / 100
  let base = flat
  if (pounds > config.weightSurchargeThresholdLb) {
    const weightBased =
      config.weightSurchargeBaseCents / 100 +
      (pounds - config.weightSurchargeThresholdLb) * (config.weightSurchargePerLbCents / 100)
    base = Math.max(base, weightBased)
  }
  return toMoney(base * stateMultiplier(state, config))
}

/** The flat frontend-preview cost, in dollars: the flat rate scaled by the state multiplier only. */
export function flatEstimateCost(state: string, config: ShippingRateConfig): number {
  return toMoney((config.flatRateCents / 100) * stateMultiplier(state, config))
}

/** The flat international cost, in dollars. */
export function internationalCost(config: ShippingRateConfig): number {
  return toMoney(config.internationalRateCents / 100)
}

/**
 * The rate config to use, read from the `ShippingSettings` singleton and merged over the defaults.
 * Never throws — a database problem falls through to the built-in defaults so a shipping quote is
 * always available (the same posture as `getShippingOrigin`).
 */
export async function getShippingRateConfig(): Promise<ShippingRateConfig> {
  try {
    const settings = await prisma.shippingSettings.findUnique({
      where: { singleton: 'singleton' },
      select: {
        flatRateCents: true,
        weightSurchargeBaseCents: true,
        weightSurchargePerLbCents: true,
        weightSurchargeThresholdLb: true,
        internationalRateCents: true,
        stateSurcharges: true,
      },
    })
    return resolveRateConfig(settings)
  } catch (error) {
    console.error('[Shipping Rate Config] Could not read shipping settings, using defaults:', error)
    return DEFAULT_RATE_CONFIG
  }
}
