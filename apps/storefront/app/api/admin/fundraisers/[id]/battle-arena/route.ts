import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

async function authorize() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'orders:write'))) {
    return null
  }
  return user
}

/**
 * GET returns the Battle Arena team linked to this fundraiser by slug match
 * (or null), plus the current active season (if any).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await authorize()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const fundraiser = await prisma.fundraiser.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true, organizationName: true, contactEmail: true, contactPhone: true, goal: true },
  })
  if (!fundraiser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [team, activeSeason] = await Promise.all([
    prisma.fundraiserTeam.findUnique({
      where: { slug: fundraiser.slug },
      select: {
        id: true, slug: true, name: true, school: true, status: true,
        teamColor: true, teamColorDark: true, goalAmount: true, salesCount: true,
        hpCurrent: true, pricePerUnit: true, activePeriod: true, seasonId: true,
      },
    }),
    prisma.fundraiserSeason.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startsAt: 'desc' },
      select: { id: true, period: true, startsAt: true, endsAt: true },
    }),
  ])

  return NextResponse.json({ fundraiser, team, activeSeason })
}

/**
 * POST links (creating if needed) a FundraiserTeam row mirroring this
 * fundraiser's identity into the Battle Arena. Idempotent — if the team
 * already exists it is returned as-is.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await authorize()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const fundraiser = await prisma.fundraiser.findUnique({
    where: { id },
    select: {
      id: true, slug: true, name: true, organizationName: true,
      contactEmail: true, contactPhone: true, goal: true, pageConfig: true,
    },
  })
  if (!fundraiser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = await prisma.fundraiserTeam.findUnique({ where: { slug: fundraiser.slug } })
  if (existing) {
    return NextResponse.json({ team: existing, created: false })
  }

  const cfg = (fundraiser.pageConfig ?? {}) as Record<string, unknown>
  const primary = typeof cfg.primaryColor === 'string' ? cfg.primaryColor : '#9B7FFF'
  const secondary = typeof cfg.secondaryColor === 'string' ? cfg.secondaryColor : '#452E7F'
  const goalAmount = fundraiser.goal ? Math.max(100, Math.round(Number(fundraiser.goal))) : 1000

  const team = await prisma.fundraiserTeam.create({
    data: {
      slug: fundraiser.slug,
      name: fundraiser.name,
      school: fundraiser.organizationName,
      activePeriod: currentPeriod(),
      // Admin-initiated promotion skips the PENDING gate — the admin IS the
      // approver, so the arena page at /fundraise/[slug] should render
      // immediately (that page filters by status: 'ACTIVE').
      status: 'ACTIVE',
      teamColor: primary,
      teamColorDark: secondary,
      goalAmount,
      contactName: fundraiser.organizationName,
      contactEmail: fundraiser.contactEmail,
      contactPhone: fundraiser.contactPhone,
    },
  })

  return NextResponse.json({ team, created: true })
}

/**
 * DELETE unlinks the FundraiserTeam from Battle Arena. Kept separate from the
 * hard-delete on /admin/arena/seasons endpoints — this just removes the team
 * row mirroring the fundraiser.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await authorize()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const fundraiser = await prisma.fundraiser.findUnique({ where: { id }, select: { slug: true } })
  if (!fundraiser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = await prisma.fundraiserTeam.findUnique({ where: { slug: fundraiser.slug } })
  if (!existing) return NextResponse.json({ success: true, removed: false })

  await prisma.fundraiserTeam.delete({ where: { slug: fundraiser.slug } })
  return NextResponse.json({ success: true, removed: true })
}
