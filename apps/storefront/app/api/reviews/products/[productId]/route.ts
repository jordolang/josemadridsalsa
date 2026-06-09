import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'

type Params = { params: Promise<{ productId: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { productId } = await params

  const [reviews, stats] = await Promise.all([
    prisma.review.findMany({
      where: { productId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        isVerified: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.review.aggregate({
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ])

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      isVerified: r.isVerified,
      createdAt: r.createdAt.toISOString(),
      authorName: r.user?.name ?? 'Verified customer',
    })),
    averageRating: stats._avg.rating ?? 0,
    totalReviews: stats._count.rating ?? 0,
  })
}
