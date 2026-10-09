import Link from 'next/link'
import { redirect } from 'next/navigation'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  SITE_FEEDBACK_CATEGORIES,
  SITE_FEEDBACK_MAX_RATING,
  parseStoredRatings,
  summarizeByCategory,
} from '@/lib/site-feedback'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25
// Upper bound on rows read for the per-category averages.
const SUMMARY_SAMPLE = 5000

function scoreTone(score: number | null) {
  if (score === null) return 'text-muted-foreground'
  if (score >= 8) return 'text-green-600'
  if (score >= 5) return 'text-amber-600'
  return 'text-red-600'
}

export default async function SiteFeedbackAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:read'))) {
    redirect('/admin')
  }

  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const [total, overall, sample, rows] = await Promise.all([
    prisma.siteFeedback.count(),
    prisma.siteFeedback.aggregate({ _avg: { averageRating: true } }),
    prisma.siteFeedback.findMany({
      select: { ratings: true },
      orderBy: { createdAt: 'desc' },
      take: SUMMARY_SAMPLE,
    }),
    prisma.siteFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  const summary = summarizeByCategory(sample.map((s) => parseStoredRatings(s.ratings)))
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const overallAverage = overall._avg.averageRating
  const labelFor = new Map<string, string>(SITE_FEEDBACK_CATEGORIES.map((c) => [c.key, c.label]))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Site Feedback</h1>
          <p className="text-sm text-muted-foreground">
            Visitor ratings of the website from the homepage section and{' '}
            <Link href="/feedback" className="underline underline-offset-4" target="_blank">
              /feedback
            </Link>
            , scored 1 to {SITE_FEEDBACK_MAX_RATING}.
          </p>
        </div>
        <div className="flex gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide">
                Responses
              </CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {total.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide">
                Avg Score
              </CardDescription>
              <CardTitle
                className={cn('text-2xl font-bold tabular-nums', scoreTone(overallAverage))}
              >
                {overallAverage ? overallAverage.toFixed(1) : '—'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By category</CardTitle>
          <CardDescription>Average score and number of ratings for each part of the site.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {summary.map((item) => (
              <div key={item.key} className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className={cn('text-2xl font-bold tabular-nums', scoreTone(item.average))}>
                  {item.average !== null ? item.average.toFixed(1) : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.count.toLocaleString()} {item.count === 1 ? 'rating' : 'ratings'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Received</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Ratings</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead className="text-right">Avg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No feedback yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const ratings = Object.entries(parseStoredRatings(row.ratings))
                return (
                  <TableRow key={row.id} className="align-top">
                    <TableCell className="whitespace-nowrap text-sm">
                      {row.createdAt.toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                      {row.source && (
                        <div className="text-xs text-muted-foreground">{row.source}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{row.name || 'Anonymous'}</div>
                      {row.email && (
                        <a
                          href={`mailto:${row.email}`}
                          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                        >
                          {row.email}
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-md flex-wrap gap-1">
                        {ratings.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          ratings.map(([key, score]) => (
                            <Badge key={key} variant="outline" className="font-normal">
                              {labelFor.get(key) ?? key}:{' '}
                              <span className={cn('ml-1 font-semibold', scoreTone(score))}>
                                {score}
                              </span>
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-sm whitespace-pre-wrap text-sm">
                      {row.comment || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-semibold tabular-nums',
                        scoreTone(row.averageRating),
                      )}
                    >
                      {row.averageRating !== null ? row.averageRating.toFixed(1) : '—'}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link href={`/admin/site-feedback?page=${Math.max(1, page - 1)}`}>Previous</Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
              <Link href={`/admin/site-feedback?page=${Math.min(totalPages, page + 1)}`}>
                Next
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
