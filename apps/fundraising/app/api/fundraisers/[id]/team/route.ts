import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import prisma from '@/lib/prisma'

const TeamMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
})

// Helper to check if current user has access to this fundraiser
async function hasFundraiserAccess(userId: string, userEmail: string, fundraiserId: string) {
  // Check if they are system admin
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user && await hasPermission(user, 'orders:write')) return true

  // Check if they are the main account owner
  const mainAccount = await prisma.fundraiserAccount.findFirst({
    where: { userId, fundraiserId },
  })
  if (mainAccount) return true

  // Check if they are in the access list (team)
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
    const user = await getCurrentUser()
    const { id: fundraiserId } = await params

    if (!user || !(await hasFundraiserAccess(user.id, user.email, fundraiserId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const team = await prisma.fundraiserAccess.findMany({
      where: { fundraiserId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ team })
  } catch (error: any) {
    console.error('Error fetching team:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team', details: error.message },
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
    const parsed = TeamMemberSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { email } = parsed.data

    // Check 20 email limit
    const count = await prisma.fundraiserAccess.count({
      where: { fundraiserId },
    })

    if (count >= 20) {
      return NextResponse.json(
        { error: 'Maximum team size (20) reached. Please remove someone before adding a new email.' },
        { status: 400 }
      )
    }

    // Check if duplicate
    const existing = await prisma.fundraiserAccess.findUnique({
      where: {
        fundraiserId_email: { fundraiserId, email },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'This email is already on the team.' },
        { status: 400 }
      )
    }

    const newMember = await prisma.fundraiserAccess.create({
      data: {
        fundraiserId,
        email,
        addedBy: user.id,
      },
    })

    await logAudit({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Fundraiser',
      entityId: fundraiserId,
      changes: { addedTeamMember: email },
    })

    return NextResponse.json(newMember)
  } catch (error: any) {
    console.error('Error adding team member:', error)
    return NextResponse.json(
      { error: 'Failed to add team member', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    const { id: fundraiserId } = await params
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!user || !(await hasFundraiserAccess(user.id, user.email, fundraiserId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 })
    }

    // Ensure it exists
    const existing = await prisma.fundraiserAccess.findUnique({
      where: {
        fundraiserId_email: { fundraiserId, email },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    await prisma.fundraiserAccess.delete({
      where: {
        fundraiserId_email: { fundraiserId, email },
      },
    })

    await logAudit({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Fundraiser',
      entityId: fundraiserId,
      changes: { removedTeamMember: email },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error removing team member:', error)
    return NextResponse.json(
      { error: 'Failed to remove team member', details: error.message },
      { status: 500 }
    )
  }
}
