import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Star, Search } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { logAudit } from '@/lib/audit'

type SearchParams = {
  status?: string
  q?: string
  page?: string
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

async function getReviews(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = 25
  const skip = (page - 1) * limit

  const where: any = {}

  const status = searchParams.status?.toUpperCase()
  if (status && status !== 'ALL') {
    where.status = status
  }

  if (searchParams.q) {
    where.OR = [
      { comment: { contains: searchParams.q, mode: 'insensitive' } },
      { title: { contains: searchParams.q, mode: 'insensitive' } },
      {
        product: {
          name: { contains: searchParams.q, mode: 'insensitive' },
        },
      },
      {
        user: {
          OR: [
            { email: { contains: searchParams.q, mode: 'insensitive' } },
            { name: { contains: searchParams.q, mode: 'insensitive' } },
          ],
        },
      },
    ]
  }

  const [reviews, total, pending, approved, rejected, ratingAggregate] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.review.count({ where }),
    prisma.review.count({ where: { status: 'PENDING' } }),
    prisma.review.count({ where: { status: 'APPROVED' } }),
    prisma.review.count({ where: { status: 'REJECTED' } }),
    prisma.review.aggregate({
      _avg: {
        rating: true,
      },
      where: {
        status: 'APPROVED',
      },
    }),
  ])

  return {
    reviews,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    counts: {
      pending,
      approved,
      rejected,
    },
    averageRating: ratingAggregate._avg.rating ? Number(ratingAggregate._avg.rating) : null,
  }
}

async function updateReviewStatus(reviewId: string, status: 'PENDING' | 'APPROVED' | 'REJECTED') {
  'use server'

  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    throw new Error('Unauthorized')
  }

  await prisma.review.update({
    where: { id: reviewId },
    data: {
      status,
      moderatedAt: new Date(),
      moderatedBy: user.id,
    },
  })

  await logAudit({
    userId: user.id,
    action: 'review.status_change',
    entityType: 'Review',
    entityId: reviewId,
    changes: { status },
  })

  revalidatePath('/admin/reviews')
}

async function toggleVerified(reviewId: string, nextState: 'true' | 'false') {
  'use server'

  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    throw new Error('Unauthorized')
  }

  const verified = nextState === 'true'

  await prisma.review.update({
    where: { id: reviewId },
    data: {
      isVerified: verified,
    },
  })

  await logAudit({
    userId: user.id,
    action: 'review.verified_toggle',
    entityType: 'Review',
    entityId: reviewId,
    changes: { isVerified: verified },
  })

  revalidatePath('/admin/reviews')
}

export default async function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:read'))) {
    redirect('/admin')
  }

  const canModerate = await hasPermission(user, 'content:write')
  const { reviews, total, page, totalPages, counts, averageRating } = await getReviews(searchParams)

  const statusCandidate = searchParams.status?.toUpperCase()
  const activeStatus = STATUS_OPTIONS.some((option) => option.value === statusCandidate)
    ? (statusCandidate as 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED')
    : 'ALL'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Product Reviews</h1>
          <p className="text-slate-600">
            Moderate customer feedback before it appears on the storefront.
          </p>
        </div>
        <div className="flex gap-3">
          <Card className="px-4 py-3">
            <p className="text-xs uppercase text-slate-500">Pending</p>
            <p className="text-lg font-semibold text-amber-600">
              {counts.pending.toLocaleString()}
            </p>
          </Card>
          <Card className="px-4 py-3">
            <p className="text-xs uppercase text-slate-500">Average Rating</p>
            <p className="text-lg font-semibold text-emerald-600">
              {averageRating ? averageRating.toFixed(1) : '—'}
            </p>
          </Card>
        </div>
      </div>

      <Card className="p-4">
        <form className="flex flex-col gap-4 sm:flex-row" method="get">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              name="q"
              defaultValue={searchParams.q}
              placeholder="Search by product, customer, or comment"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              Search
            </Button>
            {searchParams.q && (
              <Button asChild variant="ghost">
                <Link href="/admin/reviews">Clear</Link>
              </Button>
            )}
          </div>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map((option) => {
            const isActive = option.value === activeStatus
            const href =
              option.value === 'ALL'
                ? `/admin/reviews${searchParams.q ? `?q=${encodeURIComponent(searchParams.q)}` : ''}`
                : `/admin/reviews?status=${option.value}${
                    searchParams.q ? `&q=${encodeURIComponent(searchParams.q)}` : ''
                  }`
            return (
              <Link
                key={option.value}
                href={href}
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option.label}
              </Link>
            )
          })}
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Rating</th>
                <th className="px-4 py-3 text-left font-medium">Comment</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Submitted</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No reviews found for this filter.
                  </td>
                </tr>
              ) : (
                reviews.map((review) => {
                  const approveAction = updateReviewStatus.bind(null, review.id, 'APPROVED')
                  const rejectAction = updateReviewStatus.bind(null, review.id, 'REJECTED')
                  const resetAction = updateReviewStatus.bind(null, review.id, 'PENDING')
                  const toggleVerifiedAction = toggleVerified.bind(
                    null,
                    review.id,
                    review.isVerified ? 'false' : 'true'
                  )

                  return (
                    <tr key={review.id} className="border-b last:border-0">
                      <td className="px-4 py-4 font-medium text-slate-900">
                        {review.product?.name || 'Deleted product'}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {review.user?.name || review.user?.email || 'Unknown customer'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star
                              key={index}
                              className={`h-4 w-4 ${
                                index < review.rating ? 'fill-current' : 'stroke-current text-slate-300'
                              }`}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <p className="line-clamp-2">
                          {review.comment || 'No comment provided'}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <Badge
                            className={
                              review.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-700'
                                : review.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }
                          >
                            {review.status}
                          </Badge>
                          {review.isVerified && (
                            <span className="text-xs font-medium text-emerald-600">Verified</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {review.createdAt.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {canModerate ? (
                          <div className="flex flex-col items-end gap-2">
                            <form action={toggleVerifiedAction}>
                              <input type="hidden" name="verified" value={review.isVerified ? 'false' : 'true'} />
                              <Button type="submit" variant="ghost" size="sm">
                                {review.isVerified ? 'Unverify' : 'Mark verified'}
                              </Button>
                            </form>
                            {review.status === 'PENDING' ? (
                              <div className="flex gap-2">
                                <form action={approveAction}>
                                  <Button type="submit" size="sm">
                                    Approve
                                  </Button>
                                </form>
                                <form action={rejectAction}>
                                  <Button type="submit" variant="outline" size="sm">
                                    Reject
                                  </Button>
                                </form>
                              </div>
                            ) : (
                              <form action={resetAction}>
                                <Button type="submit" variant="ghost" size="sm">
                                  Move to pending
                                </Button>
                              </form>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Read-only</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-6 py-4 text-sm text-slate-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/reviews?page=${Math.max(page - 1, 1)}${
                  searchParams.status ? `&status=${activeStatus}` : ''
                }${searchParams.q ? `&q=${encodeURIComponent(searchParams.q)}` : ''}`}
                className={`rounded-md border px-3 py-1 ${
                  page === 1
                    ? 'pointer-events-none border-slate-200 text-slate-300'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                Previous
              </Link>
              <Link
                href={`/admin/reviews?page=${Math.min(page + 1, totalPages)}${
                  searchParams.status ? `&status=${activeStatus}` : ''
                }${searchParams.q ? `&q=${encodeURIComponent(searchParams.q)}` : ''}`}
                className={`rounded-md border px-3 py-1 ${
                  page === totalPages
                    ? 'pointer-events-none border-slate-200 text-slate-300'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
