import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Search, Star } from 'lucide-react'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { logAudit } from '@/lib/audit'
import { cn } from '@/lib/utils'

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
] as const

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

const REVIEW_STATUS_VARIANT: Record<
  ReviewStatus,
  'default' | 'secondary' | 'destructive' | 'outline' | 'warning'
> = {
  PENDING: 'warning',
  APPROVED: 'default',
  REJECTED: 'destructive',
}

async function getReviews(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = 25
  const skip = (page - 1) * limit

  const where: Prisma.ReviewWhereInput = {}

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

  const [reviews, total, pending, , , ratingAggregate] = await Promise.all([
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
    counts: { pending },
    averageRating: ratingAggregate._avg.rating
      ? Number(ratingAggregate._avg.rating)
      : null,
  }
}

async function updateReviewStatus(reviewId: string, status: ReviewStatus) {
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

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:read'))) {
    redirect('/admin')
  }

  const canModerate = await hasPermission(user, 'content:write')
  const { reviews, page, totalPages, counts, averageRating } = await getReviews(
    params
  )

  const statusCandidate = params.status?.toUpperCase()
  const activeStatus = STATUS_OPTIONS.some(
    (option) => option.value === statusCandidate
  )
    ? (statusCandidate as 'ALL' | ReviewStatus)
    : 'ALL'

  const buildPageHref = (targetPage: number) => {
    const qs = new URLSearchParams()
    qs.set('page', String(targetPage))
    if (params.status) qs.set('status', activeStatus)
    if (params.q) qs.set('q', params.q)
    return `/admin/reviews?${qs.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Reviews</h1>
          <p className="text-sm text-muted-foreground">
            Moderate customer feedback before it appears on the storefront.
          </p>
        </div>
        <div className="flex gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide">
                Pending
              </CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {counts.pending.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide">
                Avg Rating
              </CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {averageRating ? averageRating.toFixed(1) : '—'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <form className="flex flex-col gap-4 sm:flex-row" method="get">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                name="q"
                defaultValue={params.q}
                placeholder="Search by product, customer, or comment"
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="outline">
                Search
              </Button>
              {params.q && (
                <Button asChild variant="ghost">
                  <Link href="/admin/reviews">Clear</Link>
                </Button>
              )}
            </div>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((option) => {
              const isActive = option.value === activeStatus
              const href =
                option.value === 'ALL'
                  ? `/admin/reviews${
                      params.q ? `?q=${encodeURIComponent(params.q)}` : ''
                    }`
                  : `/admin/reviews?status=${option.value}${
                      params.q ? `&q=${encodeURIComponent(params.q)}` : ''
                    }`
              return (
                <Button
                  key={option.value}
                  asChild
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                >
                  <Link href={href}>{option.label}</Link>
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-muted-foreground"
                >
                  No reviews found for this filter.
                </TableCell>
              </TableRow>
            ) : (
              reviews.map((review) => {
                const approveAction = updateReviewStatus.bind(
                  null,
                  review.id,
                  'APPROVED'
                )
                const rejectAction = updateReviewStatus.bind(
                  null,
                  review.id,
                  'REJECTED'
                )
                const resetAction = updateReviewStatus.bind(
                  null,
                  review.id,
                  'PENDING'
                )
                const toggleVerifiedAction = toggleVerified.bind(
                  null,
                  review.id,
                  review.isVerified ? 'false' : 'true'
                )

                return (
                  <TableRow key={review.id}>
                    <TableCell className="font-medium">
                      {review.product?.name || 'Deleted product'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {review.user?.name ||
                        review.user?.email ||
                        'Unknown customer'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star
                            key={index}
                            className={cn(
                              'size-3.5',
                              index < review.rating
                                ? 'fill-amber-400 text-muted-foreground'
                                : 'text-muted-foreground/30'
                            )}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs text-muted-foreground">
                      <p className="line-clamp-2">
                        {review.comment || 'No comment provided'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant={
                            REVIEW_STATUS_VARIANT[review.status as ReviewStatus] ??
                            'outline'
                          }
                        >
                          {review.status}
                        </Badge>
                        {review.isVerified && (
                          <span className="text-xs font-medium text-primary dark:text-emerald-400">
                            Verified
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {review.createdAt.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {canModerate ? (
                        <div className="flex flex-col items-end gap-2">
                          <form action={toggleVerifiedAction}>
                            <input
                              type="hidden"
                              name="verified"
                              value={review.isVerified ? 'false' : 'true'}
                            />
                            <Button type="submit" variant="ghost" size="sm">
                              {review.isVerified
                                ? 'Unverify'
                                : 'Mark verified'}
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
                                <Button
                                  type="submit"
                                  variant="outline"
                                  size="sm"
                                >
                                  Reject
                                </Button>
                              </form>
                            </div>
                          ) : (
                            <form action={resetAction}>
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                              >
                                Move to pending
                              </Button>
                            </form>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Read-only
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            {page > 1 && (
              <PaginationItem>
                <PaginationPrevious href={buildPageHref(page - 1)} />
              </PaginationItem>
            )}
            <PaginationItem>
              <PaginationLink href="#" isActive>
                {page} / {totalPages}
              </PaginationLink>
            </PaginationItem>
            {page < totalPages && (
              <PaginationItem>
                <PaginationNext href={buildPageHref(page + 1)} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
