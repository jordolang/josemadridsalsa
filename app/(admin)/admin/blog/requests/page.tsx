import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle, XCircle, Users } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'
import { BlogRequestActions } from '@/components/admin/BlogRequestActions'

export const metadata: Metadata = createMetadata({
  title: 'Blog Access Requests - Jose Madrid Salsa Admin',
  description: 'Review and manage blog access requests.',
  pathname: '/admin/blog/requests',
})

export default async function BlogRequestsPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin')
  }

  const [requests, statusCounts] = await Promise.all([
    prisma.blogAccessRequest.findMany({
      orderBy: [
        { status: 'asc' }, // PENDING first
        { createdAt: 'desc' },
      ],
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.blogAccessRequest.groupBy({
      by: ['status'],
      _count: true,
    }),
  ])

  const counts = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  }
  statusCounts.forEach((sc) => {
    counts[sc.status as keyof typeof counts] = sc._count
  })

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Blog Access Requests</h1>
        <p className="text-slate-600">Review and approve community blog access requests</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-sm text-slate-600">Pending</p>
              <p className="text-2xl font-bold">{counts.PENDING}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-slate-600">Approved</p>
              <p className="text-2xl font-bold">{counts.APPROVED}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-sm text-slate-600">Rejected</p>
              <p className="text-2xl font-bold">{counts.REJECTED}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Requests Table */}
      {requests.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500">
            <Users className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No blog access requests yet</p>
            <p className="mt-1 text-sm">Requests will appear here when users apply for blog access</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">User</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Business</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Reason</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Applied</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm">{request.user.name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-500">{request.user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {request.businessName || <span className="text-slate-400">N/A</span>}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate">
                      {request.reason || <span className="text-slate-400">No reason provided</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusColors[request.status]}>
                        {request.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {request.status === 'PENDING' ? (
                        <BlogRequestActions requestId={request.id} />
                      ) : (
                        <span className="text-xs text-slate-400">
                          {request.reviewedAt
                            ? `Reviewed ${new Date(request.reviewedAt).toLocaleDateString()}`
                            : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
