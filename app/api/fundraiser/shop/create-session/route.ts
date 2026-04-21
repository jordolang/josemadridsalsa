import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma as db } from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'
import { getStripe } from '@/lib/stripe'

const ShopPayload = z.object({
  teamId: z.string().min(1).max(40),
  items: z
    .array(
      z.object({
        teamProductId: z.string().min(1).max(40),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .min(1)
    .max(20),
  /** Optional teammate attribution — same contract as /donate/create-session. */
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
 * POST /api/fundraiser/shop/create-session
 *
 * Creates a Stripe Checkout Session for purchasing products from a
 * FundraiserTeam's catalog. Stripe `session.metadata.fundraiserTeamId` is
 * what makes the existing `checkout.session.completed` webhook fire
 * `applyPurchaseDamage` — that's the arena trigger. No Order row is
 * created here; fulfillment is handled at the team level.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`fundraiser-shop:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const parsed = ShopPayload.safeParse(await req.json().catch(() => ({})))
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

  // Resolve team-scoped products. Price precedence: team override → product
  // base price. Missing/inactive rows are filtered out; if nothing survives,
  // the request is invalid.
  const teamProductIds = parsed.data.items.map((i) => i.teamProductId)
  const teamProducts = await db.fundraiserTeamProduct.findMany({
    where: {
      id: { in: teamProductIds },
      teamId: team.id,
      isActive: true,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          featuredImage: true,
          isActive: true,
        },
      },
    },
  })

  const byId = new Map(teamProducts.map((tp) => [tp.id, tp]))
  const origin =
    process.env.APP_URL ??
    req.headers.get('origin') ??
    new URL(req.url).origin

  type LineItem = {
    price_data: {
      currency: 'usd'
      product_data: { name: string; description?: string; images?: string[] }
      unit_amount: number
    }
    quantity: number
  }

  const lineItems: LineItem[] = []
  let totalCents = 0
  for (const reqItem of parsed.data.items) {
    const tp = byId.get(reqItem.teamProductId)
    if (!tp || !tp.product.isActive) continue
    const unitCents = Math.round(
      Number(tp.price ?? tp.product.price) * 100,
    )
    if (unitCents <= 0) continue
    totalCents += unitCents * reqItem.quantity
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: tp.product.name,
          description: `Fundraiser purchase — ${team.name}`,
          ...(tp.product.featuredImage
            ? { images: [tp.product.featuredImage] }
            : {}),
        },
        unit_amount: unitCents,
      },
      quantity: reqItem.quantity,
    })
  }

  if (lineItems.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No purchasable items in request' },
      { status: 422 },
    )
  }

  const session = await getServerSession(authOptions)
  const viewerUserId = session?.user?.id ?? null
  const viewerEmail = session?.user?.email ?? null

  const donorJSON = JSON.stringify({
    userId: viewerUserId,
    name: parsed.data.donor?.isAnonymous
      ? null
      : (parsed.data.donor?.name ?? null),
    email: parsed.data.donor?.email ?? viewerEmail ?? null,
    comment: parsed.data.donor?.comment ?? null,
    isAnonymous: parsed.data.donor?.isAnonymous ?? false,
  })

  const amountDollars = totalCents / 100
  const successPath =
    parsed.data.successPath ??
    `/fundraise/${team.slug}/success?amount=${amountDollars}&kind=shop`
  const cancelPath = parsed.data.cancelPath ?? `/fundraise/${team.slug}`

  try {
    const stripe = getStripe()
    // Metadata contract is identical to /donate/create-session so the
    // existing webhook handler treats shop purchases and donations the same
    // way for the damage engine.
    const metadata = {
      fundraiserTeamId: team.id,
      fundraiserTeamSlug: team.slug,
      fundraiserSeasonId: team.seasonId ?? '',
      fundraiserSeasonPeriod: team.activePeriod,
      fundraiserCharacterId: attributedCharacterId ?? '',
      fundraiserDonor: donorJSON,
      fundraiserFrequency: 'one_time',
      fundraiserKind: 'shop',
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      customer_email: parsed.data.donor?.email ?? viewerEmail ?? undefined,
      success_url: `${origin}${successPath}`,
      cancel_url: `${origin}${cancelPath}`,
      allow_promotion_codes: false,
      metadata,
      payment_intent_data: { metadata },
    })

    return NextResponse.json({
      success: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Fundraiser shop session creation failed:', message)
    return NextResponse.json(
      { success: false, error: 'Unable to start checkout' },
      { status: 500 },
    )
  }
}
