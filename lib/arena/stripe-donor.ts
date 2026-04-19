/**
 * Resolves donor identity from a Stripe Checkout Session for
 * `applyPurchaseDamage`.
 *
 * Pure function — no Stripe SDK, no Prisma. Takes only the fields of
 * `Stripe.Checkout.Session` we care about so it's trivially testable and
 * re-usable from other event sources (e.g., a future PaymentIntent
 * handler).
 */

export type MinimalStripeSession = {
  metadata: Record<string, string | undefined | null> | null
  customer_details?:
    | {
        email?: string | null
        name?: string | null
      }
    | null
}

export type ResolvedDonor = {
  userId: string | null
  name: string | null
  email: string | null
  comment: string | null
  isAnonymous: boolean
}

/**
 * Returns null when the session isn't tied to a fundraiser (no
 * `fundraiserTeamId` on metadata). The webhook uses that signal to skip
 * the damage path entirely.
 */
export function extractFundraiserTeamId(
  session: MinimalStripeSession,
): string | null {
  const raw = session.metadata?.fundraiserTeamId
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Returns the Season id pinned onto the Stripe session metadata at
 * checkout creation, or null if the checkout predates Season linkage
 * (in which case the webhook falls back to the team's current seasonId).
 */
export function extractFundraiserSeasonId(
  session: MinimalStripeSession,
): string | null {
  const raw = session.metadata?.fundraiserSeasonId
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Parses `metadata.fundraiserDonor` (JSON) and falls back to Stripe's
 * `customer_details` when individual fields are missing.
 *
 * Behavior:
 *   - Missing or malformed JSON → returns a donor built solely from
 *     `customer_details` (name + email may still be useful for receipts).
 *   - `isAnonymous: true` in JSON → suppresses name; email still kept.
 *   - Empty strings → normalized to null.
 */
export function resolveDonorFromStripeSession(
  session: MinimalStripeSession,
): ResolvedDonor {
  const customerEmail = nonEmpty(session.customer_details?.email)
  const customerName = nonEmpty(session.customer_details?.name)

  const raw = session.metadata?.fundraiserDonor
  if (typeof raw !== 'string' || raw.length === 0) {
    return {
      userId: null,
      name: customerName,
      email: customerEmail,
      comment: null,
      isAnonymous: false,
    }
  }

  let parsed: Partial<ResolvedDonor> | null = null
  try {
    const value: unknown = JSON.parse(raw)
    if (value && typeof value === 'object') {
      parsed = value as Partial<ResolvedDonor>
    }
  } catch {
    parsed = null
  }

  if (!parsed) {
    return {
      userId: null,
      name: customerName,
      email: customerEmail,
      comment: null,
      isAnonymous: false,
    }
  }

  const isAnonymous = parsed.isAnonymous === true
  return {
    userId: nonEmpty(parsed.userId),
    name: isAnonymous ? null : (nonEmpty(parsed.name) ?? customerName),
    email: nonEmpty(parsed.email) ?? customerEmail,
    comment: nonEmpty(parsed.comment),
    isAnonymous,
  }
}

function nonEmpty(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : null
}
