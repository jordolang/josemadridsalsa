import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

const statusClasses: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
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

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'financials:read'))) {
    redirect('/admin')
  }

  const { invoices, total, page, totalPages, statusSummary } = await getInvoices(searchParams)
  const statusCandidate = searchParams.status?.toUpperCase()
  const activeStatus = STATUS_OPTIONS.some((option) => option.value === statusCandidate)
    ? (statusCandidate as 'ALL' | 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED')
    : 'ALL'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-slate-600">
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
            <p className="text-xs uppercase text-slate-500">{option.label}</p>
            <p
              className={`mt-2 text-xl font-semibold ${
                option.value === 'PAID'
                  ? 'text-emerald-600'
                  : option.value === 'OVERDUE'
                  ? 'text-red-600'
                  : 'text-slate-800'
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
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              name="q"
              defaultValue={searchParams.q}
              placeholder="Search invoices by number, note, or customer ID"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              Search
            </Button>
            {searchParams.q && (
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
                ? `/admin/invoices${searchParams.q ? `?q=${encodeURIComponent(searchParams.q)}` : ''}`
                : `/admin/invoices?status=${option.value}${
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
                <th className="px-4 py-3 text-left font-medium">Invoice</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Due Date</th>
                <th className="px-4 py-3 text-left font-medium">Items</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No invoices found for this filter.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const lineCount = parseLineCount(invoice.lines)
                  return (
                    <tr key={invoice.id} className="border-b last:border-0">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-slate-900">{invoice.number}</p>
                          <p className="text-xs text-slate-500">
                            Created {invoice.createdAt.toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {invoice.customerId || '—'}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {invoice.dueDate.toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{lineCount}</td>
                      <td className="px-4 py-4">
                        <Badge className={statusClasses[invoice.status] || 'bg-slate-100 text-slate-600'}>
                          {invoice.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-900">
                        {formatPrice(Number(invoice.total || 0))}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/admin/invoices/${invoice.id}`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          View
                        </Link>
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
                href={`/admin/invoices?page=${Math.max(page - 1, 1)}${
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
                href={`/admin/invoices?page=${Math.min(page + 1, totalPages)}${
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
