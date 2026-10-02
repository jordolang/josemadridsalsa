import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import prisma from '@/lib/prisma'
import {
  POINTS_AWARDS,
  recordGamificationAction,
  type GamificationActionType,
} from '@/lib/fundraising/gamification'

const ActionSchema = z.object({
  actionType: z.enum(Object.keys(POINTS_AWARDS) as [GamificationActionType, ...GamificationActionType[]]),
})

async function hasFundraiserAccess(userId: string, userEmail: string, fundraiserId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user && await hasPermission(user, 'orders:write')) return true

  const mainAccount = await prisma.fundraiserAccount.findFirst({
    where: { userId, fundraiserId },
  })
  if (mainAccount) return true

  const teamAccess = await prisma.fundraiserAccess.findFirst({
    where: { email: userEmail, fundraiserId },
  })
  if (teamAccess) return true

  return false
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fundraiserId } = await params

    const gamification = await prisma.fundraiserGamification.findUnique({
      where: { fundraiserId },
    })

    if (!gamification) {
      return NextResponse.json({
        pointsBalance: 0,
        currentStreak: 0,
        longestStreak: 0,
        tiktokChallengesCompleted: 0,
      })
    }

    return NextResponse.json(gamification)
  } catch (error: any) {
    console.error('Error fetching gamification data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch gamification data', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    const { id: fundraiserId } = await params

    if (!user || !(await hasFundraiserAccess(user.id, user.email, fundraiserId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const payload = await request.json()
    const parsed = ActionSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { recorded, gamification } = await recordGamificationAction(fundraiserId, parsed.data.actionType)

    if (!recorded) {
      return NextResponse.json(
        { error: 'Daily login already recorded for today' },
        { status: 400 }
      )
    }

    return NextResponse.json(gamification)
  } catch (error: any) {
    console.error('Error recording gamification action:', error)
    return NextResponse.json(
      { error: 'Failed to record gamification action', details: error.message },
      { status: 500 }
    )
  }
}
