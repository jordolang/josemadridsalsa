import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { disconnectAccount } from '@/lib/social/platforms'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:compose'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { isActive: true },
    select: {
      id: true,
      platform: true,
      accountId: true,
      accountName: true,
      accountHandle: true,
      profileImageUrl: true,
      isActive: true,
      lastVerifiedAt: true,
      connectionError: true,
      scopes: true,
      tokenExpiresAt: true,
      createdAt: true,
      _count: { select: { publishedPosts: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ accounts })
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:publish'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('id')

  if (!accountId) {
    return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
  }

  try {
    await disconnectAccount(accountId)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    console.error('Failed to disconnect social account:', error)
    return NextResponse.json({ error: 'Failed to disconnect account' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
