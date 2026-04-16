import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyFundraiserApiKey } from '@/lib/fundraiser-auth'
import { rateLimit } from '@/lib/rateLimit'
import { applyPurchaseDamage } from '@/lib/arena/damage'

const SaleSchema = z.object({
  apiKey: z.string().min(32),
  amount: z.number().positive(),
  orderId: z.string().optional(),
})

/**
 * POST /api/fundraiser/sale
 *
 * Machine-to-machine endpoint for external order systems to record a sale
 * against a fundraiser team. Damage to every opponent in the same period
 * is resolved atomically inside `applyPurchaseDamage`.
 *
 * Auth: API key HMAC — `lib/fundraiser-auth.ts`.
 * Idempotency: `orderId` unique on FundraiserSaleEvent.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`sale-post:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const parsed = SaleSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 422 },
    )
  }

  const team = await verifyFundraiserApiKey(parsed.data.apiKey)
  if (!team) {
    return NextResponse.json(
      { success: false, error: 'Invalid or inactive API key' },
      { status: 401 },
    )
  }

  try {
    const result = await applyPurchaseDamage({
      sellingTeamId: team.id,
      saleAmount: parsed.data.amount,
      orderId: parsed.data.orderId,
    })

    if (result.idempotentHit) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order already processed',
          saleEventId: result.saleEventId,
        },
        { status: 409 },
      )
    }

    return NextResponse.json({
      success: true,
      saleEventId: result.saleEventId,
      teamId: team.id,
      teamName: team.name,
      totalDamageDealt: result.totalDamageDealt,
      damagedTeams: result.damagedTeams,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
