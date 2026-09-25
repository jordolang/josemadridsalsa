import { redirect } from 'next/navigation'
import { getCurrentFundraiserAccount } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { SITE_DOMAIN } from '@/lib/site-url'

export default async function FundraiserDashboardPage() {
  const account = await getCurrentFundraiserAccount()
  if (!account || account.status !== 'APPROVED') {
    redirect('/fundraiser-portal/pending')
  }

  const fundraiser = await prisma.fundraiser.findUnique({
    where: { id: account.fundraiserId },
    include: {
      participants: {
        where: { status: 'ACTIVE' },
        orderBy: { totalRevenue: 'desc' },
        take: 10,
      },
      _count: { select: { orders: true, participants: true } },
    },
  })

  if (!fundraiser) {
    redirect('/fundraiser-portal/pending')
  }

  const revenue = Number(fundraiser.totalRevenue)
  const commission = Number(fundraiser.totalCommission)
  const goal = fundraiser.goal ? Number(fundraiser.goal) : null
  const progressPercent = goal && goal > 0 ? Math.min((revenue / goal) * 100, 100) : 0

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-6 font-serif text-2xl font-bold text-gray-900">
        Dashboard
      </h1>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={`$${revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
        <StatCard label="Commission Earned" value={`$${commission.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
        <StatCard label="Total Orders" value={fundraiser.totalOrders.toString()} />
        <StatCard label="Participants" value={fundraiser._count.participants.toString()} />
      </div>

      {/* Progress */}
      {goal && goal > 0 && (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Goal Progress
          </h2>
          <div className="mb-2 h-4 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-verde-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-gray-900">${revenue.toLocaleString()}</span>
            <span className="text-gray-500">{Math.round(progressPercent)}% of ${goal.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Campaign info */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Campaign Details
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                fundraiser.isActive ? 'bg-verde-100 text-verde-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {fundraiser.isActive ? 'Active' : 'Inactive'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Commission Rate</dt>
            <dd className="mt-1 font-semibold text-gray-900">{Number(fundraiser.commissionRate)}%</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Start Date</dt>
            <dd className="mt-1 text-gray-900">{fundraiser.startDate.toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">End Date</dt>
            <dd className="mt-1 text-gray-900">{fundraiser.endDate.toLocaleDateString()}</dd>
          </div>
          {fundraiser.subdomain && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Your Page URL</dt>
              <dd className="mt-1">
                <a
                  href={`/f/${fundraiser.subdomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-salsa-600 hover:text-salsa-700"
                >
                  {SITE_DOMAIN}/f/{fundraiser.subdomain}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Top participants */}
      {fundraiser.participants.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Top Participants
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 font-medium text-gray-500">Name</th>
                  <th className="pb-2 font-medium text-gray-500">Orders</th>
                  <th className="pb-2 text-right font-medium text-gray-500">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {fundraiser.participants.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">{p.name}</td>
                    <td className="py-2 text-gray-600">{p.totalOrders}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">
                      ${Number(p.totalRevenue).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
