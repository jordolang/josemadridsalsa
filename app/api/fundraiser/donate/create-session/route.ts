import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma as db } from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'
import { getStripe } from '@/lib/stripe'

const DonatePayload = z.object({
  teamId: z.string().min(1).max(40),
  amount: z
    .number()
    .positive()
    .max(100_000, 'Donation capped at $100,000 per transaction'),
  frequency: z.enum(['one_time', 'monthly']).default('one_time'),
  fundId: z.string().max(40).nullish(),
  /**
   * Optional teammate attribution — when the donor arrives via a specific
   * character's share link. Validated server-side against the target team
   * so a malicious client can't attribute to a character on another team.
   */
  characterId: z.string().min(1).max(40).nullish(),
  donor: z
    .object({
      name: z.string().max(120).nullish(),
      email: z.string().email().nullish(),
      comment: z.string().max(500).nullish(),
      isAnonymous: z.boolean().optional(),
    })
    .optional(),
  successPath: z.string().startsWith('/').max(500).optional(),
  cancelPath: z.string().startsWith('/').max(500).optional(),
})

/**
 * POST /api/fundraiser/donate/create-session
 *
 * Creates a Stripe Checkout Session for a direct fundraiser donation.
 * Unlike the product-cart checkout path, this flow doesn't create an Order
 * row — the entire purchase is a single "Donation to {team}" line item
 * whose metadata drives `applyPurchaseDamage` from the Stripe webhook's
 * `checkout.session.completed` handler.
 *
 * Auth: optional NextAuth session (used to link the sale event to a User
 * and pre-fill receipt email). Donor identity survives anonymity: when
 * `donor.isAnonymous === true`, the name/avatar are suppressed but the
 * email is still captured for the receipt.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`fundraiser-donate:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const parsed = DonatePayload.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 422 },
    )
  }

  const team = await db.fundraiserTeam.findUnique({
    where: { id: parsed.data.teamId, status: 'ACTIVE' },
    select: {
      id: true,
      slug: true,
      name: true,
      school: true,
      seasonId: true,
      activePeriod: true,
    },
  })
  if (!team) {
    return NextResponse.json(
      { success: false, error: 'Team not found or inactive' },
      { status: 404 },
    )
  }

  // Resolve optional teammate attribution. We validate scope here so the
  // metadata stored on Stripe always reflects a character that genuinely
  // belongs to this team — damage.ts re-checks at settlement time as
  // defense-in-depth, but catching it early gives a clear 422 to the
  // caller instead of silently swallowing the attribution later.
  let attributedCharacterId: string | null = null
  if (parsed.data.characterId) {
    const char = await db.fundraiserCharacter.findUnique({
      where: { id: parsed.data.characterId },
      select: { id: true, teamId: true },
    })
    if (!char || char.teamId !== team.id) {
      return NextResponse.json(
        { success: false, error: 'characterId does not belong to this team' },
        { status: 422 },
      )
    }
    attributedCharacterId = char.id
  }

  const session = await getServerSession(authOptions)
  const viewerUserId = session?.user?.id ?? null
  const viewerEmail = session?.user?.email ?? null

  const amountCents = Math.round(parsed.data.amount * 100)
  const origin =
    process.env.APP_URL ??
    req.headers.get('origin') ??
    new URL(req.url).origin

  const successPath =
    parsed.data.successPath ??
    `/fundraise/${team.slug}/success?amount=${parsed.data.amount}`
  const cancelPath = parsed.data.cancelPath ?? `/fundraise/${team.slug}`

  const donorJSON = JSON.stringify({
    userId: viewerUserId,
    name: parsed.data.donor?.isAnonymous
      ? null
      : (parsed.data.donor?.name ?? null),
    email: parsed.data.donor?.email ?? viewerEmail ?? null,
    comment: parsed.data.donor?.comment ?? null,
    isAnonymous: parsed.data.donor?.isAnonymous ?? false,
  })

  const isSubscription = parsed.data.frequency === 'monthly'

  try {
    const stripe = getStripe()
    // Season linkage: the webhook verifies `fundraiserSeasonId` matches the
    // team's current season at settlement time, so we pin it at checkout
    // creation to prevent attacks that mutate the team's season mid-flight.
    const sharedMetadata = {
      fundraiserTeamId: team.id,
      fundraiserTeamSlug: team.slug,
      fundraiserSeasonId: team.seasonId ?? '',
      fundraiserSeasonPeriod: team.activePeriod,
      fundraiserCharacterId: attributedCharacterId ?? '',
      fundraiserDonor: donorJSON,
      fundraiserFundId: parsed.data.fundId ?? '',
      fundraiserFrequency: parsed.data.frequency,
    }
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: isSubscription
                ? `Monthly donation to ${team.name}`
                : `Donation to ${team.name}`,
              description: `Powers ${team.name} in the Jose Madrid Salsa Fundraiser.`,
            },
            unit_amount: amountCents,
            ...(isSubscription
              ? { recurring: { interval: 'month' as const } }
              : {}),
          },
          quantity: 1,
        },
      ],
      customer_email: parsed.data.donor?.email ?? viewerEmail ?? undefined,
      success_url: `${origin}${successPath}`,
      cancel_url: `${origin}${cancelPath}`,
      allow_promotion_codes: false,
      metadata: sharedMetadata,
      ...(isSubscription
        ? { subscription_data: { metadata: sharedMetadata } }
        : { payment_intent_data: { metadata: sharedMetadata } }),
    })

    return NextResponse.json({
      success: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      subscription: isSubscription,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Fundraiser donate session creation failed:', message)
    return NextResponse.json(
      { success: false, error: 'Unable to start checkout' },
      { status: 500 },
    )
  }
}
