import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import prisma from '@/lib/prisma'

const ActionSchema = z.object({
  actionType: z.string().min(1, 'Action type is required'),
})

// Points dictionary
const POINTS_AWARDS: Record<string, number> = {
  'DAILY_LOGIN': 5,
  'SHARED_ON_FB': 10,
  'SHARED_ON_X': 10,
  'TIKTOK_CHALLENGE': 50,
  'YOUTUBE_VIDEO': 100,
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

    // Only logged in users (or the mobile app providing auth) can perform actions
    if (!user) {
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

    const { actionType } = parsed.data
    const pointsAwarded = POINTS_AWARDS[actionType] || 0

    // Only allow once per day for things like DAILY_LOGIN
    if (actionType === 'DAILY_LOGIN') {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      
      const existingLogin = await prisma.gamificationAction.findFirst({
        where: {
          fundraiserId,
          actionType: 'DAILY_LOGIN',
          createdAt: {
            gte: startOfDay,
          },
        },
      })

      if (existingLogin) {
        return NextResponse.json(
          { error: 'Daily login already recorded for today' },
          { status: 400 }
        )
      }
    }

    // Record the action
    await prisma.gamificationAction.create({
      data: {
        fundraiserId,
        actionType,
        pointsAwarded,
      },
    })

    // Update the master gamification totals
    const gamification = await prisma.fundraiserGamification.upsert({
      where: { fundraiserId },
      create: {
        fundraiserId,
        pointsBalance: pointsAwarded,
        tiktokChallengesCompleted: actionType === 'TIKTOK_CHALLENGE' ? 1 : 0,
        currentStreak: actionType === 'DAILY_LOGIN' ? 1 : 0,
        longestStreak: actionType === 'DAILY_LOGIN' ? 1 : 0,
      },
      update: {
        pointsBalance: {
          increment: pointsAwarded,
        },
        tiktokChallengesCompleted: {
          increment: actionType === 'TIKTOK_CHALLENGE' ? 1 : 0,
        },
        // Naive streak update for demonstration. In reality, check if previous login was exactly yesterday.
        currentStreak: actionType === 'DAILY_LOGIN' ? { increment: 1 } : undefined,
      },
    })

    // If streak exceeded longest streak, we need an extra query since upsert can't easily do Math.max inside Prisma directly
    if (gamification.currentStreak > gamification.longestStreak) {
      await prisma.fundraiserGamification.update({
        where: { fundraiserId },
        data: { longestStreak: gamification.currentStreak },
      })
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
