import Link from 'next/link'
import { redirect } from 'next/navigation'
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client'
import { DollarSign, Link2, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { StatsCard } from '@/components/admin/StatsCard'
import { formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FinancialUploadPanel } from '@/components/admin/financials/financial-upload-panel'
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
        paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
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
          <h1 className="text-3xl font-bold">Financial Overview</h1>
          <p className="text-slate-600">
            Revenue, cash flow, and outstanding balances across the business.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white p-1 shadow-sm">
          {RANGE_OPTIONS.map((option) => {
            const isActive = option.value === activeRange
            return (
              <Link
                key={option.value}
                href={`/admin/financials?range=${option.value}`}
                className={`rounded-md px-3 py-1 text-sm font-medium ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option.label}
              </Link>
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

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <FinancialUploadPanel acceptedExtensions={supportedUploadFormats} />
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-slate-500">Integrations</p>
              <h2 className="text-xl font-semibold text-slate-900">Financial system connections</h2>
              <p className="text-sm text-slate-600">
                Connect QuickBooks, Quicken, Xero, or ADP to automate sync and reconciliation.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/settings/integrations">Manage keys</Link>
            </Button>
          </div>

          <div className="space-y-3">
            {integrationStatus.map((integration) => (
              <div
                key={integration.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{integration.label}</p>
                    <p className="text-xs text-slate-500">
                      {integration.isConnected
                        ? `Last synced ${integration.lastSyncedAt ? new Date(integration.lastSyncedAt).toLocaleString() : 'recently'}`
                        : 'Not connected'}
                    </p>
                  </div>
                  <Badge
                    className={`text-xs ${integration.isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                  >
                    {integration.isConnected ? 'Connected' : 'Needs setup'}
                  </Badge>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-slate-500">
                  {integration.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <a
                    href={integration.docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-salsa-600 hover:underline"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Docs
                  </a>
                  <Button
                    asChild
                    size="sm"
                    variant={integration.isConnected ? 'outline' : 'default'}
                  >
                    <Link href={`/admin/settings/integrations?service=${integration.id}`}>
                      {integration.isConnected ? 'View settings' : 'Connect'}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Monthly revenue trend</h2>
          <p className="text-sm text-slate-600">Last 12 months of collected payments</p>
          {data.monthlyTrends.every((item) => item.revenue === 0) ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No revenue recorded yet.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-12 gap-3">
              {data.monthlyTrends.map((month) => {
                const percent = maxRevenue === 0 ? 0 : Math.round((month.revenue / maxRevenue) * 100)
                return (
                  <div key={month.month} className="flex flex-col items-center gap-2">
                    <div className="flex h-32 w-full items-end justify-center rounded bg-slate-100">
                      <div
                        className="w-3 rounded bg-emerald-500 transition-all"
                        style={{
                          height: `${percent}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">{month.label}</p>
                    <p className="text-xs font-medium text-slate-700">
                      {formatPrice(month.revenue)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-xl font-semibold">Tax & shipping</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>
                Tax collected:{' '}
                <span className="font-semibold text-slate-900">
                  {formatPrice(data.summary.taxCollected)}
                </span>
              </p>
              <p>
                Shipping collected:{' '}
                <span className="font-semibold text-slate-900">
                  {formatPrice(data.summary.shippingCollected)}
                </span>
              </p>
              <p>
                Discounts granted:{' '}
                <span className="font-semibold text-slate-900">
                  {formatPrice(data.summary.discounts)}
                </span>
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
            Tax and shipping are calculated from paid orders during the selected range. Discounts show the total coupon and promo value applied.
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-slate-500">Payroll</p>
              <h2 className="text-xl font-semibold text-slate-900">Upcoming pay run</h2>
              <p className="text-sm text-slate-600">
                Review hours, taxes, and net pay before exporting to ADP or QuickBooks Payroll.
              </p>
            </div>
            <Badge className="bg-slate-100 text-slate-600">
              {nextPayroll ? nextPayroll.status : 'No runs'}
            </Badge>
          </div>
          {nextPayroll ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{nextPayroll.period}</p>
              <p className="text-xs text-slate-500">Pay date {new Date(nextPayroll.payDate).toLocaleDateString()}</p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-slate-500">
                <div>
                  <p className="font-semibold text-slate-900">{formatPrice(nextPayroll.grossPay)}</p>
                  <p>Gross</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{formatPrice(nextPayroll.taxesWithheld)}</p>
                  <p>Taxes</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{formatPrice(nextPayroll.netPay)}</p>
                  <p>Net</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No pay runs are scheduled. Generate one or import from your POS.
            </div>
          )}
          <div>
            <p className="text-xs uppercase text-slate-500">Top earners this period</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {payrollEmployees.slice(0, 3).map((employee) => (
                <li key={employee.id} className="flex items-center justify-between">
                  <span>{employee.name}</span>
                  <span className="text-xs text-slate-500">{formatPrice(employee.netPay)}</span>
                </li>
              ))}
            </ul>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/financials/payroll">Open payroll workspace</Link>
          </Button>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-slate-500">Expenses</p>
              <h2 className="text-xl font-semibold text-slate-900">Expense approvals</h2>
              <p className="text-sm text-slate-600">
                Approve reimbursements and sync approved spend to your accounting platform.
              </p>
            </div>
            <Badge className="bg-slate-100 text-slate-600">
              {expenseQueue.filter((expense) => expense.status === 'submitted').length} awaiting
            </Badge>
          </div>
          <div className="space-y-3">
            {expenseQueue.map((expense) => (
              <div
                key={expense.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{expense.vendor}</p>
                  <span className="text-sm font-semibold text-slate-900">{formatPrice(expense.amount)}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {expense.category} • Submitted by {expense.submittedBy} on{' '}
                  {new Date(expense.submittedAt).toLocaleDateString()}
                </p>
                <Badge
                  className={`mt-3 text-xs ${
                    expense.status === 'reimbursed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : expense.status === 'approved'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {expense.status}
                </Badge>
              </div>
            ))}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/financials/expenses">Review expenses</Link>
          </Button>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-slate-500">Tax prep</p>
              <h2 className="text-xl font-semibold text-slate-900">Upcoming filings</h2>
              <p className="text-sm text-slate-600">
                Track compliance tasks, owners, and due dates for state and federal filings.
              </p>
            </div>
            <Badge className="bg-slate-100 text-slate-600">
              {openTaxTasks.length} open
            </Badge>
          </div>
          <div className="space-y-3">
            {taxPreparationTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{task.label}</p>
                  <Badge
                    className={`text-xs ${
                      task.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : task.status === 'overdue'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {task.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Due {new Date(task.dueDate).toLocaleDateString()} • Owner {task.owner}
                </p>
                {task.notes ? (
                  <p className="mt-2 text-xs text-slate-600">{task.notes}</p>
                ) : null}
              </div>
            ))}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/financials/taxes">Manage tasks</Link>
          </Button>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Outstanding invoices</h2>
              <p className="text-sm text-slate-600">
                Track sent and overdue invoices requiring follow-up.
              </p>
            </div>
            <div className="text-right text-sm text-slate-500">
              <p>Balance: {formatPrice(data.outstanding.total)}</p>
              <p>
                Overdue:{' '}
                <span className="font-semibold text-red-600">
                  {formatPrice(data.outstanding.overdueTotal)}
                </span>
              </p>
            </div>
          </div>
          {data.upcomingInvoices.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No invoices outstanding. Great job!
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {data.upcomingInvoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/admin/invoices/${invoice.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-300 hover:text-blue-600"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{invoice.number}</p>
                    <p className="text-xs text-slate-500">
                      Due {invoice.dueDate.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">
                      {formatPrice(invoice.total)}
                    </p>
                    <p
                      className={`text-xs ${
                        invoice.status === 'OVERDUE' ? 'text-red-600' : 'text-slate-500'
                      }`}
                    >
                      {invoice.status}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-3 text-xs text-slate-500">
            <span>Invoices outstanding: {data.outstanding.count.toLocaleString()}</span>
            <span>Overdue: {data.outstanding.overdueCount.toLocaleString()}</span>
            <span>Drafts: {data.outstanding.draftCount.toLocaleString()}</span>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold">Recent orders</h2>
          {data.recentOrders.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No transactions recorded in this range.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {data.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 hover:border-blue-300 hover:text-blue-600"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">#{order.orderNumber}</p>
                    <p className="text-xs text-slate-500">
                      {order.createdAt.toLocaleString()} • {order.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">
                      {formatPrice(order.total)}
                    </p>
                    <p className="text-xs text-slate-500">{order.paymentStatus}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
