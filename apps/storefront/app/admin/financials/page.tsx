import Link from 'next/link'
import { redirect } from 'next/navigation'
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { DollarSign, Link2, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatsCard } from '@/components/admin/StatsCard'
import { formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FinancialUploadPanel } from '@/components/admin/financials/financial-upload-panel'
import QuickBooksProfitAndLossCard from '@/components/admin/financials/quickbooks-pl-card'
import { PAID_PAYMENT_STATUSES } from '@/lib/payments/status'
import {
  financialIntegrations,
  mapIntegrationStatus,
  payrollRuns,
  payrollEmployees,
  expenseQueue,
  taxPreparationTasks,
  supportedUploadFormats,
} from '@/lib/financials/config'

type RangeKey = '30d' | '90d' | '365d'

type SearchParams = {
  range?: string
}

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '365d', label: '12 months' },
]

const RANGE_DAYS: Record<RangeKey, number> = {
  '30d': 30,
  '90d': 90,
  '365d': 365,
}

type MonthlyTrend = {
  month: string
  label: string
  revenue: number
}

type FinancialOverview = {
  summary: {
    revenue: number
    refunds: number
    netRevenue: number
    orders: number
    averageOrderValue: number
    taxCollected: number
    shippingCollected: number
    discounts: number
  }
  outstanding: {
    total: number
    count: number
    overdueTotal: number
    overdueCount: number
    draftCount: number
  }
  monthlyTrends: MonthlyTrend[]
  upcomingInvoices: Array<{
    id: string
    number: string
    dueDate: Date
    total: number
    status: string
  }>
  recentOrders: Array<{
    id: string
    orderNumber: string
    total: number
    status: string
    paymentStatus: string
    createdAt: Date
  }>
}

function getRange(range: RangeKey) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const days = RANGE_DAYS[range]
  const start = new Date(end)
  start.setDate(end.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)

  return { start, end }
}

function createMonthlyBuckets(months: number) {
  const buckets: { [key: string]: MonthlyTrend } = {}
  const now = new Date()
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    buckets[key] = {
      month: key,
      label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      revenue: 0,
    }
  }
  return buckets
}

async function getFinancialOverview(range: RangeKey): Promise<FinancialOverview> {
  const { start, end } = getRange(range)
  const createdAtRange = { gte: start, lte: end }

  const excludedStatuses: OrderStatus[] = [OrderStatus.CANCELLED]
  const includedPayments: PaymentStatus[] = [
    PaymentStatus.PAID,
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
  ]

  const orderFilter: Prisma.OrderWhereInput = {
    createdAt: createdAtRange,
    status: { notIn: excludedStatuses },
    paymentStatus: { in: includedPayments },
  }

  const [
    revenueAggregate,
    orderCount,
    refundAggregate,
    ordersForTrend,
    outstandingInvoices,
    overdueInvoices,
    draftInvoiceCount,
    upcomingInvoices,
    recentOrders,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: orderFilter,
      _sum: {
        total: true,
        tax: true,
        shippingCost: true,
        discountAmount: true,
      },
    }),
    prisma.order.count({
      where: {
        ...orderFilter,
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
        paymentStatus: { in: [...PAID_PAYMENT_STATUSES, 'PARTIALLY_REFUNDED'] },
      },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: createdAtRange,
        paymentStatus: 'REFUNDED',
      },
      _sum: {
        total: true,
      },
    }),
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1),
        },
        status: { notIn: excludedStatuses },
        paymentStatus: { in: includedPayments },
      },
      select: {
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { in: ['SENT', 'OVERDUE'] },
      },
      _sum: {
        total: true,
      },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: {
        status: 'OVERDUE',
      },
      _sum: {
        total: true,
      },
      _count: true,
    }),
    prisma.invoice.count({
      where: {
        status: 'DRAFT',
      },
    }),
    prisma.invoice.findMany({
      where: {
        status: { in: ['SENT', 'OVERDUE'] },
      },
      orderBy: { dueDate: 'asc' },
      take: 6,
      select: {
        id: true,
        number: true,
        dueDate: true,
        total: true,
        status: true,
      },
    }),
    prisma.order.findMany({
      where: {
        ...orderFilter,
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ])

  const revenue = Number(revenueAggregate._sum?.total || 0)
  const taxCollected = Number(revenueAggregate._sum?.tax || 0)
  const shippingCollected = Number(revenueAggregate._sum?.shippingCost || 0)
  const discounts = Number(revenueAggregate._sum?.discountAmount || 0)
  const refundTotal = Number(refundAggregate._sum?.total || 0)

  const averageOrderValue = orderCount === 0 ? 0 : revenue / orderCount
  const netRevenue = revenue - refundTotal

  const monthlyBuckets = createMonthlyBuckets(12)
  ordersForTrend.forEach((order) => {
    const key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`
    if (monthlyBuckets[key]) {
      monthlyBuckets[key].revenue += Number(order.total || 0)
    }
  })

  return {
    summary: {
      revenue,
      refunds: refundTotal,
      netRevenue,
      orders: orderCount,
      averageOrderValue,
      taxCollected,
      shippingCollected,
      discounts,
    },
    outstanding: {
      total: Number(outstandingInvoices._sum.total || 0),
      count: outstandingInvoices._count,
      overdueTotal: Number(overdueInvoices._sum.total || 0),
      overdueCount: overdueInvoices._count,
      draftCount: draftInvoiceCount,
    },
    monthlyTrends: Object.values(monthlyBuckets),
    upcomingInvoices: upcomingInvoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      dueDate: invoice.dueDate,
      total: Number(invoice.total || 0),
      status: invoice.status,
    })),
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total || 0),
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
    })),
  }
}

export default async function FinancialsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'financials:read'))) {
    redirect('/admin')
  }

  const requested = params.range
  const activeRange = RANGE_OPTIONS.some((option) => option.value === requested)
    ? (requested as RangeKey)
    : '30d'

  const data = await getFinancialOverview(activeRange)
  const integrationRecords = await prisma.serviceKey.findMany({
    where: {
      serviceName: {
        in: financialIntegrations.map((integration) => integration.serviceName),
      },
    },
    select: {
      serviceName: true,
      lastUsed: true,
      isActive: true,
    },
  })
  const integrationStatus = mapIntegrationStatus(integrationRecords)
  const nextPayroll = payrollRuns.find((run) => run.status !== 'paid')
  const openTaxTasks = taxPreparationTasks.filter((task) => task.status !== 'completed')
  const maxRevenue = data.monthlyTrends.reduce((max, item) => Math.max(max, item.revenue), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Financial Overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Revenue, cash flow, and outstanding balances across the business.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          {RANGE_OPTIONS.map((option) => {
            const isActive = option.value === activeRange
            return (
              <Button
                key={option.value}
                asChild
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
              >
                <Link href={`/admin/financials?range=${option.value}`}>
                  {option.label}
                </Link>
              </Button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Gross Revenue" value={formatPrice(data.summary.revenue)} icon={DollarSign} />
        <StatsCard title="Net Revenue" value={formatPrice(data.summary.netRevenue)} icon={Wallet} />
        <StatsCard
          title="Avg. Order Value"
          value={formatPrice(data.summary.averageOrderValue)}
          icon={TrendingUp}
        />
        <StatsCard
          title="Orders"
          value={data.summary.orders.toLocaleString()}
          icon={Receipt}
        />
      </div>

      {/* Renders nothing when QuickBooks isn't connected. */}
      <QuickBooksProfitAndLossCard
        start={new Date(Date.now() - RANGE_DAYS[activeRange] * 24 * 60 * 60 * 1000)}
        end={new Date()}
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <FinancialUploadPanel acceptedExtensions={supportedUploadFormats} />
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  Integrations
                </CardDescription>
                <CardTitle>Financial system connections</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connect QuickBooks, Quicken, Xero, or ADP to automate sync
                  and reconciliation.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/settings/integrations">Manage keys</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {integrationStatus.map((integration) => (
              <div
                key={integration.id}
                className="rounded-lg border p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {integration.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {integration.isConnected
                        ? `Last synced ${
                            integration.lastSyncedAt
                              ? new Date(
                                  integration.lastSyncedAt
                                ).toLocaleString()
                              : 'recently'
                          }`
                        : 'Not connected'}
                    </p>
                  </div>
                  <Badge
                    variant={integration.isConnected ? 'default' : 'warning'}
                  >
                    {integration.isConnected ? 'Connected' : 'Needs setup'}
                  </Badge>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {integration.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <a
                    href={integration.docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Link2 className="size-3.5" />
                    Docs
                  </a>
                  <Button
                    asChild
                    size="sm"
                    variant={integration.isConnected ? 'outline' : 'default'}
                  >
                    <Link
                      href={`/admin/settings/integrations?service=${integration.id}`}
                    >
                      {integration.isConnected ? 'View settings' : 'Connect'}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Monthly revenue trend</CardTitle>
            <CardDescription>
              Last 12 months of collected payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.monthlyTrends.every((item) => item.revenue === 0) ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No revenue recorded yet.
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-3">
                {data.monthlyTrends.map((month) => {
                  const percent =
                    maxRevenue === 0
                      ? 0
                      : Math.round((month.revenue / maxRevenue) * 100)
                  return (
                    <div
                      key={month.month}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className="flex h-32 w-full items-end justify-center rounded bg-muted">
                        <div
                          className="w-3 rounded bg-primary transition-all"
                          style={{ height: `${percent}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {month.label}
                      </p>
                      <p className="text-xs font-medium tabular-nums">
                        {formatPrice(month.revenue)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax & shipping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Tax collected:{' '}
                <span className="font-semibold text-foreground tabular-nums">
                  {formatPrice(data.summary.taxCollected)}
                </span>
              </p>
              <p>
                Shipping collected:{' '}
                <span className="font-semibold text-foreground tabular-nums">
                  {formatPrice(data.summary.shippingCollected)}
                </span>
              </p>
              <p>
                Discounts granted:{' '}
                <span className="font-semibold text-foreground tabular-nums">
                  {formatPrice(data.summary.discounts)}
                </span>
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4 text-xs text-muted-foreground">
              Tax and shipping are calculated from paid orders during the
              selected range. Discounts show the total coupon and promo value
              applied.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  Payroll
                </CardDescription>
                <CardTitle>Upcoming pay run</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review hours, taxes, and net pay before exporting to ADP or
                  QuickBooks Payroll.
                </p>
              </div>
              <Badge variant="outline">
                {nextPayroll ? nextPayroll.status : 'No runs'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {nextPayroll ? (
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm font-semibold">{nextPayroll.period}</p>
                <p className="text-xs text-muted-foreground">
                  Pay date{' '}
                  {new Date(nextPayroll.payDate).toLocaleDateString()}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                  <div>
                    <p className="font-semibold text-foreground tabular-nums">
                      {formatPrice(nextPayroll.grossPay)}
                    </p>
                    <p>Gross</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground tabular-nums">
                      {formatPrice(nextPayroll.taxesWithheld)}
                    </p>
                    <p>Taxes</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground tabular-nums">
                      {formatPrice(nextPayroll.netPay)}
                    </p>
                    <p>Net</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/50 p-6 text-center text-sm text-muted-foreground">
                No pay runs are scheduled. Generate one or import from your
                POS.
              </div>
            )}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Top earners this period
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                {payrollEmployees.slice(0, 3).map((employee) => (
                  <li
                    key={employee.id}
                    className="flex items-center justify-between"
                  >
                    <span>{employee.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatPrice(employee.netPay)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/financials/payroll">
                Open payroll workspace
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  Expenses
                </CardDescription>
                <CardTitle>Expense approvals</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Approve reimbursements and sync approved spend to your
                  accounting platform.
                </p>
              </div>
              <Badge variant="outline">
                {
                  expenseQueue.filter(
                    (expense) => expense.status === 'submitted'
                  ).length
                }{' '}
                awaiting
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {expenseQueue.map((expense) => (
              <div key={expense.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{expense.vendor}</p>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatPrice(expense.amount)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {expense.category} • Submitted by {expense.submittedBy} on{' '}
                  {new Date(expense.submittedAt).toLocaleDateString()}
                </p>
                <Badge
                  variant={
                    expense.status === 'reimbursed'
                      ? 'default'
                      : expense.status === 'approved'
                        ? 'secondary'
                        : 'warning'
                  }
                  className="mt-3"
                >
                  {expense.status}
                </Badge>
              </div>
            ))}
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/financials/expenses">Review expenses</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  Tax prep
                </CardDescription>
                <CardTitle>Upcoming filings</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Track compliance tasks, owners, and due dates for state and
                  federal filings.
                </p>
              </div>
              <Badge variant="outline">{openTaxTasks.length} open</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {taxPreparationTasks.map((task) => (
              <div key={task.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{task.label}</p>
                  <Badge
                    variant={
                      task.status === 'completed'
                        ? 'default'
                        : task.status === 'overdue'
                          ? 'destructive'
                          : 'warning'
                    }
                  >
                    {task.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Due {new Date(task.dueDate).toLocaleDateString()} • Owner{' '}
                  {task.owner}
                </p>
                {task.notes ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {task.notes}
                  </p>
                ) : null}
              </div>
            ))}
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/financials/taxes">Manage tasks</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Outstanding invoices</CardTitle>
                <CardDescription>
                  Track sent and overdue invoices requiring follow-up.
                </CardDescription>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p className="tabular-nums">
                  Balance: {formatPrice(data.outstanding.total)}
                </p>
                <p>
                  Overdue:{' '}
                  <span className="font-semibold text-destructive tabular-nums">
                    {formatPrice(data.outstanding.overdueTotal)}
                  </span>
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data.upcomingInvoices.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No invoices outstanding. Great job!
              </div>
            ) : (
              <div className="space-y-3">
                {data.upcomingInvoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/admin/invoices/${invoice.id}`}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
                  >
                    <div>
                      <p className="text-sm font-semibold">{invoice.number}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {invoice.dueDate.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatPrice(invoice.total)}
                      </p>
                      <Badge
                        variant={
                          invoice.status === 'OVERDUE'
                            ? 'destructive'
                            : 'outline'
                        }
                        className="text-xs"
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-3 text-xs text-muted-foreground">
              <span>
                Invoices outstanding:{' '}
                {data.outstanding.count.toLocaleString()}
              </span>
              <span>
                Overdue: {data.outstanding.overdueCount.toLocaleString()}
              </span>
              <span>
                Drafts: {data.outstanding.draftCount.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentOrders.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No transactions recorded in this range.
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        #{order.orderNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.createdAt.toLocaleString()} • {order.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatPrice(order.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.paymentStatus}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
