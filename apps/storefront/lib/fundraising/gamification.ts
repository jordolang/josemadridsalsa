import prisma from '@/lib/prisma'
import { businessCalendarDate } from '@/lib/timeclock'

/** Points per gamification action. Only DAILY_LOGIN has a real trigger today. */
export const POINTS_AWARDS = {
  DAILY_LOGIN: 5,
  SHARED_ON_FB: 10,
  SHARED_ON_X: 10,
  TIKTOK_CHALLENGE: 50,
  YOUTUBE_VIDEO: 100,
} as const

export type GamificationActionType = keyof typeof POINTS_AWARDS

const MS_PER_DAY = 86_400_000

/** Whole calendar days since the epoch, counted in America/New_York. */
function easternDayNumber(date: Date): number {
  const { year, month, day } = businessCalendarDate(date)
  return Date.UTC(year, month - 1, day) / MS_PER_DAY
}

/**
 * The daily streak after a login at `now`, given the previous login. Returns
 * null for a second login on the same Eastern calendar day (no change); the
 * day after the previous login extends the streak; any longer gap restarts it.
 */
export function nextDailyStreak(previousLoginAt: Date | null, now: Date, currentStreak: number): number | null {
  if (!previousLoginAt) return 1
  const gap = easternDayNumber(now) - easternDayNumber(previousLoginAt)
  if (gap <= 0) return null
  return gap === 1 ? currentStreak + 1 : 1
}

/**
 * Record a gamification action for a fundraiser, awarding its points.
 * DAILY_LOGIN is recorded at most once per Eastern day and drives the streak;
 * a repeat on the same day returns `recorded: false` and changes nothing.
 */
export async function recordGamificationAction(
  fundraiserId: string,
  actionType: GamificationActionType,
  now: Date = new Date(),
) {
  const pointsAwarded = POINTS_AWARDS[actionType]

  // ponytail: read-then-write, so two simultaneous first visits of a day can
  // both record; needs a unique (fundraiserId, day) column to close fully.
  return prisma.$transaction(async (tx) => {
    const existing = await tx.fundraiserGamification.findUnique({ where: { fundraiserId } })
    let currentStreak = existing?.currentStreak ?? 0

    if (actionType === 'DAILY_LOGIN') {
      const previous = await tx.gamificationAction.findFirst({
        where: { fundraiserId, actionType: 'DAILY_LOGIN' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      const next = nextDailyStreak(previous?.createdAt ?? null, now, currentStreak)
      if (next === null) {
        return { recorded: false as const, gamification: existing }
      }
      currentStreak = next
    }

    await tx.gamificationAction.create({
      data: { fundraiserId, actionType, pointsAwarded, createdAt: now },
    })

    const longestStreak = Math.max(existing?.longestStreak ?? 0, currentStreak)
    const tiktok = actionType === 'TIKTOK_CHALLENGE' ? 1 : 0
    const gamification = await tx.fundraiserGamification.upsert({
      where: { fundraiserId },
      create: {
        fundraiserId,
        pointsBalance: pointsAwarded,
        tiktokChallengesCompleted: tiktok,
        currentStreak,
        longestStreak,
      },
      update: {
        pointsBalance: { increment: pointsAwarded },
        tiktokChallengesCompleted: { increment: tiktok },
        currentStreak,
        longestStreak,
      },
    })

    return { recorded: true as const, gamification }
  })
}
