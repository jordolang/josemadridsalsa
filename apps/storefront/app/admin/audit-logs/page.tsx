import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, Search, Shield } from 'lucide-react'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createMetadata } from '@/lib/metadata'
import { AIChatStats } from '@/components/admin/audit-logs/AIChatStats'

export const metadata: Metadata = createMetadata({
  title: 'Audit Logs - Jose Madrid Salsa Admin',
  description: 'View the system audit trail.',
  pathname: '/admin/audit-logs',
})

type SearchParams = {
  search?: string
  action?: string
  entityType?: string
  page?: string
}

type ActionVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const ACTION_VARIANT: Record<string, ActionVariant> = {
  CREATE: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
  LOGIN: 'secondary',
  LOGOUT: 'outline',
}

function getActionVariant(action: string): ActionVariant {
  // Match the prefix of dotted actions like "review.status_change"
  const upper = action.toUpperCase()
  for (const key of Object.keys(ACTION_VARIANT)) {
    if (upper.startsWith(key)) return ACTION_VARIANT[key]
  }
  return 'outline'
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
    entityTypes: entityTypes
      .map((e) => e.entityType)
      .filter(Boolean) as string[],
  }
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'users:read'))) {
    redirect('/admin')
  }

  const { logs, total, page, totalPages, entityTypes } = await getAuditLogs(
    params
  )

  const buildPageHref = (targetPage: number) => {
    const qs = new URLSearchParams()
    qs.set('page', String(targetPage))
    if (params.search) qs.set('search', params.search)
    if (params.action) qs.set('action', params.action)
    if (params.entityType) qs.set('entityType', params.entityType)
    return `/admin/audit-logs?${qs.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            System activity audit trail
          </p>
        </div>
      </div>

      {/* AI Chat Analytics */}
      <AIChatStats />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Total Logs
            </CardDescription>
            <FileText className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {total.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Entity Types
            </CardDescription>
            <Shield className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {entityTypes.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search logs..."
                defaultValue={params.search}
                className="pl-9"
              />
            </div>
            <Select defaultValue={params.action || 'all'}>
              <SelectTrigger>
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATE">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue={params.entityType || 'all'}>
              <SelectTrigger>
                <SelectValue placeholder="All Entity Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entity Types</SelectItem>
                {entityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FileText className="mx-auto mb-4 size-12 opacity-40" />
              <p className="text-lg font-medium text-foreground">
                No audit logs found
              </p>
              <p className="mt-1 text-sm">Try a different search filter</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant={getActionVariant(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.entityType && (
                        <div className="text-sm">
                          <p className="font-medium">{log.entityType}</p>
                          {log.entityId && (
                            <p className="font-mono text-xs text-muted-foreground">
                              {log.entityId.slice(0, 8)}...
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.userId
                        ? log.userId.slice(0, 8) + '...'
                        : 'System'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {log.changes ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-primary hover:underline">
                            View
                          </summary>
                          <pre className="mt-2 max-w-md overflow-auto rounded bg-muted p-2">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                {page > 1 && (
                  <PaginationItem>
                    <PaginationPrevious href={buildPageHref(page - 1)} />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink href="#" isActive>
                    {page} / {totalPages}
                  </PaginationLink>
                </PaginationItem>
                {page < totalPages && (
                  <PaginationItem>
                    <PaginationNext href={buildPageHref(page + 1)} />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  )
}
