import { redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, DollarSign, TrendingUp, Users } from 'lucide-react'
import Link from 'next/link'
import { FundraiserStatus } from '@prisma/client'

export const metadata = {
  title: 'Fundraisers | Admin',
  description: 'Manage fundraising campaigns',
}

type SearchParams = {
  status?: string
  page?: string
}

async function getFundraisers(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = 20
  const skip = (page - 1) * limit

  const where: any = {}

  if (searchParams.status && searchParams.status !== 'all') {
    where.status = searchParams.status
  }

  const [fundraisers, total, stats] = await Promise.all([
    prisma.fundraiser.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            orders: true,
            products: true,
          },
        },
      },
    }),
    prisma.fundraiser.count({ where }),
    prisma.fundraiser.aggregate({
      _sum: {
        totalRevenue: true,
        totalCommission: true,
        totalOrders: true,
      },
    }),
  ])

  return {
    fundraisers,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    stats: {
      revenue: stats._sum.totalRevenue || 0,
      commission: stats._sum.totalCommission || 0,
      orders: stats._sum.totalOrders || 0,
    },
  }
}

const statusColors: Record<FundraiserStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-800',
  ACTIVE: 'bg-green-100 text-green-800',
  ENDED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

export default async function FundraisersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:read'))) {
    redirect('/admin')
  }

  const canWrite = await hasPermission(user, 'orders:write')
  const { fundraisers, total, page, totalPages, stats } = await getFundraisers(searchParams)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fundraisers</h1>
          <p className="text-slate-600">Manage fundraising campaigns</p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href="/admin/fundraisers/new">
              <Plus className="mr-2 h-4 w-4" />
              New Fundraiser
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-slate-600">Total Revenue</p>
              <p className="text-2xl font-bold">${Number(stats.revenue).toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-slate-600">Total Commission</p>
              <p className="text-2xl font-bold">${Number(stats.commission).toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-slate-600">Total Orders</p>
              <p className="text-2xl font-bold">{stats.orders}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            defaultValue={searchParams.status || 'all'}
          >
            <option value="all">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ENDED">Ended</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </Card>

      {/* Fundraisers Grid */}
      {fundraisers.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500">
            <Users className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No fundraisers found</p>
            <p className="mt-1 text-sm">Create your first fundraiser to get started</p>
            {canWrite && (
              <Button className="mt-4" asChild>
                <Link href="/admin/fundraisers/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Fundraiser
                </Link>
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {fundraisers.map((fundraiser) => (
              <Card key={fundraiser.id} className="p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{fundraiser.name}</h3>
                    <p className="text-sm text-slate-600">{fundraiser.organizationName}</p>
                  </div>
                  <Badge className={statusColors[fundraiser.status]}>{fundraiser.status}</Badge>
                </div>

                <div className="mb-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Commission:</span>
                    <span className="font-medium">{Number(fundraiser.commissionRate)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Revenue:</span>
                    <span className="font-medium">${Number(fundraiser.totalRevenue).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Orders:</span>
                    <span className="font-medium">{fundraiser.totalOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Products:</span>
                    <span className="font-medium">{fundraiser._count.products}</span>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4 text-xs text-slate-500">
                  <div>Start: {new Date(fundraiser.startDate).toLocaleDateString()}</div>
                  <div>End: {new Date(fundraiser.endDate).toLocaleDateString()}</div>
                  {fundraiser.goal && <div>Goal: ${Number(fundraiser.goal).toFixed(2)}</div>}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <Link href={`/admin/fundraisers/${fundraiser.id}/edit`}>Edit</Link>
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/fundraisers/${fundraiser.slug}`}>View</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" disabled={page === 1} asChild={page > 1}>
                {page > 1 ? <Link href={`/admin/fundraisers?page=${page - 1}`}>Previous</Link> : <span>Previous</span>}
              </Button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" disabled={page === totalPages} asChild={page < totalPages}>
                {page < totalPages ? <Link href={`/admin/fundraisers?page=${page + 1}`}>Next</Link> : <span>Next</span>}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
