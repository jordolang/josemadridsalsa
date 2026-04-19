import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma as db } from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'

/**
 * POST /api/fundraiser/sale-events/[id]/love
 *
 * NextAuth-gated "love" reaction on a supporter-feed sale event.
 * Idempotent: the `(saleEventId, userId)` unique constraint means a
 * second POST from the same user is a no-op; we still return the
 * current aggregate count. Returns 404 if the sale event doesn't
 * exist.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`sale-love:${ip}`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: saleEventId } = await params

  const saleEvent = await db.fundraiserSaleEvent.findUnique({
    where: { id: saleEventId },
    select: { id: true },
  })
  if (!saleEvent) {
    return NextResponse.json(
      { success: false, error: 'Sale event not found' },
      { status: 404 },
    )
  }

  // Upsert on the compound unique constraint so duplicate POSTs
  // naturally resolve to "already loved" without throwing.
  await db.fundraiserSaleEventReaction.upsert({
    where: {
      saleEventId_userId: { saleEventId, userId: session.user.id },
    },
    create: { saleEventId, userId: session.user.id },
    update: {},
  })

  const lovesCount = await db.fundraiserSaleEventReaction.count({
    where: { saleEventId },
  })

  return NextResponse.json({ success: true, lovesCount, loved: true })
}

/**
 * DELETE /api/fundraiser/sale-events/[id]/love
 *
 * Removes the caller's reaction. Idempotent — deletes by the
 * compound unique; missing rows don't error.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`sale-unlove:${ip}`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: saleEventId } = await params

  await db.fundraiserSaleEventReaction.deleteMany({
    where: { saleEventId, userId: session.user.id },
  })

  const lovesCount = await db.fundraiserSaleEventReaction.count({
    where: { saleEventId },
  })

  return NextResponse.json({ success: true, lovesCount, loved: false })
}
