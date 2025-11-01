import { redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { WholesaleStatus } from '@prisma/client'

export const metadata = {
  title: 'Wholesale Accounts | Admin',
  description: 'Manage wholesale customer accounts',
}

type SearchParams = {
  status?: string
  page?: string
}

async function getWholesaleAccounts(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = 20
  const skip = (page - 1) * limit

  const where: any = {}

  if (searchParams.status && searchParams.status !== 'all') {
    where.status = searchParams.status
  }

  const [accounts, total, statusCounts] = await Promise.all([
    prisma.wholesaleAccount.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
    prisma.wholesaleAccount.count({ where }),
    prisma.wholesaleAccount.groupBy({
      by: ['status'],
      _count: true,
    }),
  ])

  return {
    accounts,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    statusCounts,
  }
}

const statusColors: Record<WholesaleStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  SUSPENDED: 'bg-orange-100 text-orange-800',
}

const statusIcons = {
  PENDING: Clock,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
  SUSPENDED: AlertCircle,
}

export default async function WholesalePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'users:read'))) {
    redirect('/admin')
  }

  const canWrite = await hasPermission(user, 'users:write')
  const { accounts, total, page, totalPages, statusCounts } = await getWholesaleAccounts(searchParams)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Wholesale Accounts</h1>
          <p className="text-slate-600">Manage wholesale customer applications</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {statusCounts.map((stat) => {
          const Icon = statusIcons[stat.status]
          return (
            <Card key={stat.status} className="p-4">
              <div className="flex items-center gap-3">
                <Icon className="h-8 w-8 text-slate-600" />
                <div>
                  <p className="text-sm text-slate-600">{stat.status}</p>
                  <p className="text-2xl font-bold">{stat._count}</p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            defaultValue={searchParams.status || 'all'}
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </Card>

      {/* Accounts Table */}
      {accounts.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No wholesale accounts found</p>
            <p className="mt-1 text-sm">Applications will appear here when submitted</p>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Business</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Contact</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Discount</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Applied</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{account.businessName}</p>
                          <p className="text-sm text-slate-600">{account.user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <p>{account.contactName}</p>
                          {account.website && (
                            <a href={account.website} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                              Website
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{account.businessType.replace('_', ' ')}</td>
                      <td className="px-4 py-3">
                        <Badge className={statusColors[account.status]}>{account.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {Number(account.discountRate)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {new Date(account.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/admin/wholesale/${account.id}`}>View</Link>
                          </Button>
                          {canWrite && account.status === 'PENDING' && (
                            <>
                              <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50">
                                Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50">
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" disabled={page === 1} asChild={page > 1}>
                {page > 1 ? <Link href={`/admin/wholesale?page=${page - 1}`}>Previous</Link> : <span>Previous</span>}
              </Button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" disabled={page === totalPages} asChild={page < totalPages}>
                {page < totalPages ? <Link href={`/admin/wholesale?page=${page + 1}`}>Next</Link> : <span>Next</span>}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
