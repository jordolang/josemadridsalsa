import { prisma as db } from '@/lib/prisma'
import {
  applyDamage,
  classifyEmote,
  computeDamage,
  type EmoteClass,
} from './rules'

export type PurchaseDamageInput = {
  sellingTeamId: string
  saleAmount: number
  orderId?: string | null
  /**
   * Period is required to scope "opponents" to the same cohort. If omitted,
   * uses the selling team's activePeriod.
   */
  period?: string
  /** Optional donor identity — surfaced in the supporter feed. */
  donor?: {
    userId?: string | null
    name?: string | null
    avatarUrl?: string | null
    email?: string | null
    comment?: string | null
    isAnonymous?: boolean
  }
}

export type PurchaseDamageResult = {
  saleEventId: string | null
  sellingTeamId: string
  totalDamageDealt: number
  damagedTeams: Array<{
    teamId: string
    damageToHP: number
    shieldAbsorbed: number
    hpAfter: number
    emote: EmoteClass
  }>
  idempotentHit?: boolean
}

/**
 * Server-authoritative combat resolution. Runs inside a single Prisma
 * transaction — a sale either applies atomically to every opponent or not
 * at all.
 *
 * Contract:
 *   - `orderId` is the Stripe/external idempotency key. Two calls with the
 *     same `orderId` succeed once; the second returns `idempotentHit: true`.
 *   - The selling team's `salesCount` increments by 1.
 *   - Every OPPONENT in the same `activePeriod` with status ACTIVE takes
 *     damage per `lib/arena/rules.computeDamage` (shield absorbs first).
 *   - Team `hpCurrent` is floored at zero.
 */
export async function applyPurchaseDamage(
  input: PurchaseDamageInput,
): Promise<PurchaseDamageResult> {
  return db.$transaction(async (tx) => {
    const seller = await tx.fundraiserTeam.findUnique({
      where: { id: input.sellingTeamId },
      select: { id: true, activePeriod: true, status: true },
    })
    if (!seller || seller.status !== 'ACTIVE') {
      throw new Error('selling team not found or not ACTIVE')
    }

    const period = input.period ?? seller.activePeriod

    if (input.orderId) {
      const existing = await tx.fundraiserSaleEvent.findUnique({
        where: { orderId: input.orderId },
      })
      if (existing) {
        return {
          saleEventId: existing.id,
          sellingTeamId: seller.id,
          totalDamageDealt: 0,
          damagedTeams: [],
          idempotentHit: true,
        }
      }
    }

    const saleEvent = await tx.fundraiserSaleEvent.create({
      data: {
        teamId: seller.id,
        orderId: input.orderId ?? null,
        amount: input.saleAmount,
        donorUserId: input.donor?.userId ?? null,
        donorName: input.donor?.isAnonymous
          ? null
          : (input.donor?.name ?? null),
        donorAvatarUrl: input.donor?.isAnonymous
          ? null
          : (input.donor?.avatarUrl ?? null),
        donorEmail: input.donor?.email ?? null,
        donorComment: input.donor?.comment ?? null,
        isAnonymous: input.donor?.isAnonymous ?? false,
      },
    })

    await tx.fundraiserTeam.update({
      where: { id: seller.id },
      data: { salesCount: { increment: 1 } },
    })

    const opponents = await tx.fundraiserTeam.findMany({
      where: {
        status: 'ACTIVE',
        activePeriod: period,
        id: { not: seller.id },
      },
      select: {
        id: true,
        hpCurrent: true,
        shields: {
          where: { expiresAt: { gt: new Date() }, remainingHP: { gt: 0 } },
          orderBy: { expiresAt: 'desc' },
          take: 1,
          select: { id: true, expiresAt: true, remainingHP: true },
        },
      },
    })

    const damagedTeams: PurchaseDamageResult['damagedTeams'] = []
    let totalDamage = 0

    for (const opp of opponents) {
      const shield = opp.shields[0] ?? null
      const damage = computeDamage({
        saleAmount: input.saleAmount,
        targetShield: shield
          ? { expiresAt: shield.expiresAt, remainingHP: shield.remainingHP }
          : null,
      })
      const hpAfter = applyDamage(opp.hpCurrent, damage.damageToHP)
      totalDamage += damage.damageToHP

      await tx.fundraiserTeam.update({
        where: { id: opp.id },
        data: { hpCurrent: hpAfter },
      })
      if (shield && damage.shieldAbsorbed > 0) {
        await tx.fundraiserShield.update({
          where: { id: shield.id },
          data: { remainingHP: { decrement: damage.shieldAbsorbed } },
        })
      }

      damagedTeams.push({
        teamId: opp.id,
        damageToHP: damage.damageToHP,
        shieldAbsorbed: damage.shieldAbsorbed,
        hpAfter,
        emote: classifyEmote({
          saleAmount: input.saleAmount,
          damageToHP: damage.damageToHP,
          shieldAbsorbed: damage.shieldAbsorbed,
        }),
      })
    }

    return {
      saleEventId: saleEvent.id,
      sellingTeamId: seller.id,
      totalDamageDealt: totalDamage,
      damagedTeams,
    }
  })
}

/**
 * Resets every ACTIVE team in a period to full HP. Admin-only surface —
 * callers must gate on RBAC before invoking.
 */
export async function resetPeriodHP(period: string): Promise<number> {
  const result = await db.fundraiserTeam.updateMany({
    where: { status: 'ACTIVE', activePeriod: period },
    data: { hpCurrent: 0, hpResetAt: new Date() },
  })
  // After zeroing, seed each team's hpCurrent to its goalAmount.
  const teams = await db.fundraiserTeam.findMany({
    where: { status: 'ACTIVE', activePeriod: period },
    select: { id: true, goalAmount: true },
  })
  await db.$transaction(
    teams.map((t) =>
      db.fundraiserTeam.update({
        where: { id: t.id },
        data: { hpCurrent: t.goalAmount },
      }),
    ),
  )
  return result.count
}
