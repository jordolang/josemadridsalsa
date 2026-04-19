import { prisma as db } from '@/lib/prisma'
import {
  applyDamage,
  classifyEmote,
  computeDamage,
  DEFAULT_RULES,
  resolveRules,
  type EmoteClass,
  type ResolvedRules,
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
      select: {
        id: true,
        activePeriod: true,
        status: true,
        season: { select: { rulesJson: true } },
      },
    })
    if (!seller || seller.status !== 'ACTIVE') {
      throw new Error('selling team not found or not ACTIVE')
    }

    const period = input.period ?? seller.activePeriod
    // Per-season tunables. `resolveRules(null)` returns DEFAULT_RULES, so
    // teams without a season (back-compat rows) behave exactly as before.
    const rules: ResolvedRules = resolveRules(
      seller.season?.rulesJson ?? null,
    )

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

    const isAnonymous = input.donor?.isAnonymous ?? false

    let saleEvent: { id: string }
    try {
      saleEvent = await tx.fundraiserSaleEvent.create({
        data: {
          teamId: seller.id,
          orderId: input.orderId ?? null,
          amount: input.saleAmount,
          donorUserId: input.donor?.userId ?? null,
          donorName: isAnonymous ? null : (input.donor?.name ?? null),
          donorAvatarUrl: isAnonymous
            ? null
            : (input.donor?.avatarUrl ?? null),
          donorEmail: isAnonymous ? null : (input.donor?.email ?? null),
          donorComment: input.donor?.comment ?? null,
          isAnonymous,
        },
      })
    } catch (err) {
      // Concurrent race on the same orderId: both callers passed the
      // findUnique check, but the unique index rejected the loser. Re-query
      // and treat it as the idempotent replay it actually is.
      const isUniqueViolation =
        input.orderId &&
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      if (isUniqueViolation) {
        const existing = await tx.fundraiserSaleEvent.findUnique({
          where: { orderId: input.orderId! },
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
      throw err
    }

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
        const nextShieldHP = Math.max(
          0,
          shield.remainingHP - damage.shieldAbsorbed,
        )
        await tx.fundraiserShield.update({
          where: { id: shield.id },
          data: { remainingHP: nextShieldHP },
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
          rules,
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

/**
 * Season-scoped HP reset. Re-seeds every ACTIVE team linked to the given
 * season back to its `goalAmount`. Admin-only surface — callers must gate.
 *
 * Returns the number of teams reset. Intended to be called by the admin
 * reset-hp endpoint and (later) a monthly cron when a season rolls over.
 */
export async function resetSeasonHP(seasonId: string): Promise<number> {
  const now = new Date()
  const teams = await db.fundraiserTeam.findMany({
    where: { status: 'ACTIVE', seasonId },
    select: { id: true, goalAmount: true },
  })
  if (teams.length === 0) return 0
  await db.$transaction(
    teams.map((t) =>
      db.fundraiserTeam.update({
        where: { id: t.id },
        data: { hpCurrent: t.goalAmount, hpResetAt: now },
      }),
    ),
  )
  return teams.length
}
