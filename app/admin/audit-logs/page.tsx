import { redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Search, Shield } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Audit Logs | Admin',
  description: 'View system audit trail',
}

type SearchParams = {
  search?: string
  action?: string
  entityType?: string
  page?: string
}

async function getAuditLogs(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = 50
  const skip = (page - 1) * limit

  const where: any = {}

  if (searchParams.search) {
    where.OR = [
      { action: { contains: searchParams.search, mode: 'insensitive' } },
      { entityType: { contains: searchParams.search, mode: 'insensitive' } },
      { entityId: { contains: searchParams.search, mode: 'insensitive' } },
    ]
  }

  if (searchParams.action && searchParams.action !== 'all') {
    where.action = { contains: searchParams.action, mode: 'insensitive' }
  }

  if (searchParams.entityType && searchParams.entityType !== 'all') {
    where.entityType = searchParams.entityType
  }

  const [logs, total, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where: { entityType: { not: null } },
      select: { entityType: true },
      distinct: ['entityType'],
      orderBy: { entityType: 'asc' },
    }),
  ])

  return {
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    entityTypes: entityTypes.map((e) => e.entityType).filter(Boolean) as string[],
  }
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-purple-100 text-purple-800',
  LOGOUT: 'bg-slate-100 text-slate-800',
}

export default async function AuditLogsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'users:read'))) {
    redirect('/admin')
  }

  const { logs, total, page, totalPages, entityTypes } = await getAuditLogs(searchParams)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-slate-600">System activity audit trail</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-slate-600">Total Logs</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-slate-600">Entity Types</p>
              <p className="text-2xl font-bold">{entityTypes.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search logs..."
              defaultValue={searchParams.search}
              className="pl-9"
            />
          </div>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            defaultValue={searchParams.action || 'all'}
          >
            <option value="all">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            defaultValue={searchParams.entityType || 'all'}
          >
            <option value="all">All Entity Types</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Logs Table */}
      {logs.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500">
            <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No audit logs found</p>
            <p className="mt-1 text-sm">Try a different search filter</p>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Action</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Entity</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Timestamp</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Badge className={actionColors[log.action] || 'bg-slate-100 text-slate-800'}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {log.entityType && (
                            <>
                              <p className="font-medium">{log.entityType}</p>
                              {log.entityId && <p className="text-slate-600">{log.entityId.slice(0, 8)}...</p>}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {log.userId ? log.userId.slice(0, 8) + '...' : 'System'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {log.changes && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-blue-600 hover:underline">View</summary>
                            <pre className="mt-2 max-w-md overflow-auto rounded bg-slate-100 p-2">
                              {JSON.stringify(log.changes, null, 2)}
                            </pre>
                          </details>
                        )}
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
                {page > 1 ? <Link href={`/admin/audit-logs?page=${page - 1}`}>Previous</Link> : <span>Previous</span>}
              </Button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" disabled={page === totalPages} asChild={page < totalPages}>
                {page < totalPages ? <Link href={`/admin/audit-logs?page=${page + 1}`}>Next</Link> : <span>Next</span>}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
