import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Plus, ShieldAlert, User, Users } from 'lucide-react'
import Link from 'next/link'
import type { UserRole } from '@prisma/client'

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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UsersFilter } from '@/components/admin/users/UsersFilter'
import { createMetadata } from '@/lib/metadata'
import { formatUserRole, getRoleBadgeVariant } from '@/lib/user-role'

export const metadata: Metadata = createMetadata({
  title: 'Users - Jose Madrid Salsa Admin',
  description: 'Manage user accounts and permissions.',
  pathname: '/admin/users',
})

type SearchParams = {
  search?: string
  role?: string
  page?: string
}

async function getUsers(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = 20
  const skip = (page - 1) * limit

  const where: any = {}

  if (searchParams.search) {
    where.OR = [
      { email: { contains: searchParams.search, mode: 'insensitive' } },
      { name: { contains: searchParams.search, mode: 'insensitive' } },
    ]
  }

  if (searchParams.role && searchParams.role !== 'all') {
    where.role = searchParams.role
  }

  const [users, total, roleStats] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            orders: true,
            reviews: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({
      by: ['role'],
      _count: true,
    }),
  ])

  return {
    users,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    roleStats,
  }
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'users:read'))) {
    redirect('/admin')
  }

  const canWrite = await hasPermission(user, 'users:write')
  const { users, total, page, totalPages, roleStats } = await getUsers(params)

  const buildPageHref = (targetPage: number) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.role) qs.set('role', params.role)
    qs.set('page', String(targetPage))
    return `/admin/users?${qs.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage user accounts and roles
          </p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href="/admin/users/new">
              <Plus className="mr-2 size-4" />
              Add User
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Total Users
            </CardDescription>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{total}</p>
          </CardContent>
        </Card>
        {roleStats.map((stat) => {
          const isPrivileged =
            stat.role === 'ADMIN' || stat.role === 'DEVELOPER'
          const Icon = isPrivileged ? ShieldAlert : User
          return (
            <Card key={stat.role}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  {formatUserRole(stat.role)}
                </CardDescription>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">
                  {stat._count}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <Suspense fallback={<Skeleton className="h-10 w-full" />}>
            <UsersFilter
              initialSearch={params.search}
              initialRole={params.role}
            />
          </Suspense>
        </CardContent>
      </Card>

      {/* Users Table */}
      {users.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <User className="mx-auto mb-4 size-12 opacity-40" />
              <p className="text-lg font-medium text-foreground">
                No users found
              </p>
              <p className="mt-1 text-sm">
                {params.search
                  ? 'Try a different search term'
                  : 'Create your first user to get started'}
              </p>
              {canWrite && (
                <Button className="mt-4" asChild>
                  <Link href="/admin/users/new">
                    <Plus className="mr-2 size-4" />
                    Add User
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{u.name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">
                          {u.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(u.role)}>
                        {formatUserRole(u.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.isEmailVerified ? 'default' : 'outline'}
                      >
                        {u.isEmailVerified ? 'Verified' : 'Unverified'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {u._count.orders}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/admin/users/${u.id}/edit`}>Edit</Link>
                      </Button>
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
