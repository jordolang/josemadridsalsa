import { prisma as db } from '@/lib/prisma'
import { checkShareAllowed, newShield, resolveRules } from './rules'

export type ShieldActivationInput = {
  teamId: string
  userId: string
  platform?: string
}

export type ShieldActivationResult =
  | {
      activated: true
      extended: false
      shieldId: string
      expiresAt: Date
      remainingHP: number
    }
  | {
      activated: false
      extended: true
      shieldId: string
      expiresAt: Date
      remainingHP: number
      reason: 'already_active'
    }
  | {
      activated: false
      extended: false
      reason: 'consecutive_limit'
    }

/**
 * User-initiated share that activates a shield.
 *
 * Behavior:
 *   - If the same user has already activated the previous N shields in a row
 *     (Phase-1 `MAX_CONSECUTIVE_SHARES`), the call is rejected with
 *     `consecutive_limit`. A different user resets the counter.
 *   - If the team already has an active shield, returns it unchanged with
 *     `already_active` — does not stack.
 *   - Otherwise creates a new FundraiserShield and records the share in
 *     FundraiserShareEvent.
 */
export async function activateShieldForUser(
  input: ShieldActivationInput,
): Promise<ShieldActivationResult> {
  return db.$transaction(async (tx) => {
    const team = await tx.fundraiserTeam.findUnique({
      where: { id: input.teamId },
      select: {
        id: true,
        status: true,
        lastShareUserId: true,
        consecutiveShares: true,
        season: { select: { rulesJson: true } },
      },
    })
    if (!team || team.status !== 'ACTIVE') {
      throw new Error('team not found or not ACTIVE')
    }

    // Per-season tunables. Falls back to built-in defaults when the team has
    // no season (back-compat) or when rulesJson is missing fields.
    const rules = resolveRules(team.season?.rulesJson ?? null)

    const gate = checkShareAllowed({
      lastShareUserId: team.lastShareUserId,
      consecutiveShares: team.consecutiveShares,
      incomingUserId: input.userId,
      rules,
    })
    if (!gate.allowed) {
      return {
        activated: false,
        extended: false,
        reason: 'consecutive_limit' as const,
      }
    }

    const existing = await tx.fundraiserShield.findFirst({
      where: {
        teamId: team.id,
        expiresAt: { gt: new Date() },
        remainingHP: { gt: 0 },
      },
      orderBy: { expiresAt: 'desc' },
    })

    if (existing) {
      await tx.fundraiserShareEvent.create({
        data: {
          teamId: team.id,
          userId: input.userId,
          platform: input.platform ?? 'facebook',
        },
      })
      await tx.fundraiserTeam.update({
        where: { id: team.id },
        data: {
          lastShareUserId: input.userId,
          consecutiveShares: gate.newConsecutive,
        },
      })
      return {
        activated: false,
        extended: true,
        shieldId: existing.id,
        expiresAt: existing.expiresAt,
        remainingHP: existing.remainingHP,
        reason: 'already_active' as const,
      }
    }

    const seed = newShield(new Date(), rules)
    const shield = await tx.fundraiserShield.create({
      data: {
        teamId: team.id,
        activatedAt: seed.activatedAt,
        expiresAt: seed.expiresAt,
        remainingHP: seed.remainingHP,
        userId: input.userId,
      },
    })
    await tx.fundraiserShareEvent.create({
      data: {
        teamId: team.id,
        userId: input.userId,
        platform: input.platform ?? 'facebook',
      },
    })
    await tx.fundraiserTeam.update({
      where: { id: team.id },
      data: {
        lastShareUserId: input.userId,
        consecutiveShares: gate.newConsecutive,
      },
    })

    return {
      activated: true,
      extended: false,
      shieldId: shield.id,
      expiresAt: shield.expiresAt,
      remainingHP: shield.remainingHP,
    }
  })
}
