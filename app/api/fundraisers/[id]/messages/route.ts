import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Simple in-memory rate limiter: max 3 messages per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 3) return false
  entry.count++
  return true
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const pageSize = 20

    const fundraiser = await prisma.fundraiser.findUnique({
      where: { slug: id },
      select: { id: true },
    })

    if (!fundraiser) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    const [messages, total] = await Promise.all([
      prisma.fundraiserMessage.findMany({
        where: {
          fundraiserId: fundraiser.id,
          isApproved: true,
          isHidden: false,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          authorName: true,
          authorAvatar: true,
          content: true,
          createdAt: true,
        },
      }),
      prisma.fundraiserMessage.count({
        where: {
          fundraiserId: fundraiser.id,
          isApproved: true,
          isHidden: false,
        },
      }),
    ])

    return NextResponse.json({
      messages,
      total,
      page,
      pageSize,
      hasMore: total > page * pageSize,
    })
  } catch (error) {
    console.error('[Fundraiser Messages GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Rate limit by IP
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many messages. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { content, authorName: bodyAuthorName } = body as {
      content?: string
      authorName?: string
    }

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required.' }, { status: 400 })
    }
    if (content.trim().length > 1000) {
      return NextResponse.json(
        { error: 'Message must be 1000 characters or less.' },
        { status: 400 }
      )
    }

    // Get session to see if logged-in user
    const session = await getServerSession(authOptions)

    let authorName: string
    let authorId: string | null = null
    let authorEmail: string | null = null
    let authorAvatar: string | null = null

    if (session?.user) {
      authorName = session.user.name ?? bodyAuthorName ?? 'Anonymous'
      authorId = (session.user as any).id ?? null
      authorEmail = session.user.email ?? null
      authorAvatar = (session.user as any).image ?? null
    } else {
      // Anonymous — require a name
      if (!bodyAuthorName || typeof bodyAuthorName !== 'string' || bodyAuthorName.trim().length < 2) {
        return NextResponse.json(
          { error: 'Name must be at least 2 characters.' },
          { status: 400 }
        )
      }
      authorName = bodyAuthorName.trim()
    }

    const fundraiser = await prisma.fundraiser.findUnique({
      where: { slug: id },
      select: { id: true },
    })

    if (!fundraiser) {
      return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 })
    }

    const message = await prisma.fundraiserMessage.create({
      data: {
        fundraiserId: fundraiser.id,
        content: content.trim(),
        authorName,
        authorEmail,
        authorAvatar,
        authorId,
        isApproved: true,
        isHidden: false,
      },
      select: {
        id: true,
        authorName: true,
        authorAvatar: true,
        content: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('[Fundraiser Messages POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
