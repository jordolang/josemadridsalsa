import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatPrice } from '@/lib/utils'
import { Search } from 'lucide-react'

type SearchParams = {
  status?: string
  q?: string
  page?: string
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const statusVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DRAFT: 'outline',
  SENT: 'secondary',
  PAID: 'default',
  OVERDUE: 'destructive',
  CANCELLED: 'outline',
}

function parseLineCount(lines: any): number {
  if (Array.isArray(lines)) {
    return lines.length
  }
  try {
    const parsed = typeof lines === 'string' ? JSON.parse(lines) : lines
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

async function getInvoices(searchParams: SearchParams) {
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
      { number: { contains: searchParams.q, mode: 'insensitive' } },
      { notes: { contains: searchParams.q, mode: 'insensitive' } },
      { customerId: { contains: searchParams.q, mode: 'insensitive' } },
    ]
  }

  const [invoices, total, counts] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { dueDate: 'asc' },
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ])

  const statusSummary = counts.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = item._count._all
    return acc
  }, {})

  return {
    invoices,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    statusSummary,
  }
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'financials:read'))) {
    redirect('/admin')
  }

  const { invoices, total, page, totalPages, statusSummary } = await getInvoices(params)
  const statusCandidate = params.status?.toUpperCase()
  const activeStatus = STATUS_OPTIONS.some((option) => option.value === statusCandidate)
    ? (statusCandidate as 'ALL' | 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED')
    : 'ALL'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">
            Manage billing records, outstanding balances, and payment tracking.
          </p>
        </div>
        <Button variant="outline" disabled>
          Invoice creator coming soon
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STATUS_OPTIONS.filter((option) => option.value !== 'ALL').map((option) => (
          <Card key={option.value} className="px-4 py-3">
            <p className="text-xs uppercase text-muted-foreground">{option.label}</p>
            <p
              className={`mt-2 text-xl font-semibold ${
                option.value === 'PAID'
                  ? 'text-primary'
                  : option.value === 'OVERDUE'
                  ? 'text-destructive'
                  : 'text-foreground'
              }`}
            >
              {(statusSummary[option.value] || 0).toLocaleString()}
            </p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <form className="flex flex-col gap-4 sm:flex-row" method="get">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              defaultValue={params.q}
              placeholder="Search invoices by number, note, or customer ID"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              Search
            </Button>
            {params.q && (
              <Button asChild variant="ghost">
                <Link href="/admin/invoices">Clear</Link>
              </Button>
            )}
          </div>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map((option) => {
            const isActive = option.value === activeStatus
            const href =
              option.value === 'ALL'
                ? `/admin/invoices${params.q ? `?q=${encodeURIComponent(params.q)}` : ''}`
                : `/admin/invoices?status=${option.value}${
                    params.q ? `&q=${encodeURIComponent(params.q)}` : ''
                  }`
            return (
              <Link
                key={option.value}
                href={href}
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted'
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
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No invoices found for this filter.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => {
                  const lineCount = parseLineCount(invoice.lines)
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{invoice.number}</p>
                          <p className="text-xs text-muted-foreground">
                            Created {invoice.createdAt.toLocaleDateString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {invoice.customerId || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {invoice.dueDate.toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lineCount}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariants[invoice.status] || 'outline'}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {formatPrice(Number(invoice.total || 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="link" size="sm" asChild className="h-auto p-0">
                          <Link href={`/admin/invoices/${invoice.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-6 py-4 text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/invoices?page=${Math.max(page - 1, 1)}${
                  params.status ? `&status=${activeStatus}` : ''
                }${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`}
                className={`rounded-md border px-3 py-1 ${
                  page === 1
                    ? 'pointer-events-none border-border text-muted-foreground/60'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                }`}
              >
                Previous
              </Link>
              <Link
                href={`/admin/invoices?page=${Math.min(page + 1, totalPages)}${
                  params.status ? `&status=${activeStatus}` : ''
                }${params.q ? `&q=${encodeURIComponent(params.q)}` : ''}`}
                className={`rounded-md border px-3 py-1 ${
                  page === totalPages
                    ? 'pointer-events-none border-border text-muted-foreground/60'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
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
