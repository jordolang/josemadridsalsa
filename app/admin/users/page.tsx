import { redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, User, Users, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { UserRole } from '@prisma/client'

export const metadata = {
  title: 'Users | Admin',
  description: 'Manage user accounts and permissions',
}

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

const roleColors: Record<UserRole, string> = {
  CUSTOMER: 'bg-blue-100 text-blue-800',
  STAFF: 'bg-green-100 text-green-800',
  ADMIN: 'bg-purple-100 text-purple-800',
  DEVELOPER: 'bg-orange-100 text-orange-800',
  WHOLESALE: 'bg-yellow-100 text-yellow-800',
}

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'users:read'))) {
    redirect('/admin')
  }

  const canWrite = await hasPermission(user, 'users:write')
  const { users, total, page, totalPages, roleStats } = await getUsers(searchParams)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-slate-600">Manage user accounts and roles</p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href="/admin/users/new">
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-slate-600">Total Users</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
          </div>
        </Card>
        {roleStats.map((stat) => (
          <Card key={stat.role} className="p-4">
            <div className="flex items-center gap-3">
              {stat.role === 'ADMIN' || stat.role === 'DEVELOPER' ? (
                <ShieldAlert className="h-8 w-8 text-purple-600" />
              ) : (
                <User className="h-8 w-8 text-slate-600" />
              )}
              <div>
                <p className="text-sm text-slate-600">{stat.role}</p>
                <p className="text-2xl font-bold">{stat._count}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search users..."
              defaultValue={searchParams.search}
              className="pl-9"
            />
          </div>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            defaultValue={searchParams.role || 'all'}
          >
            <option value="all">All Roles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="WHOLESALE">Wholesale</option>
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
            <option value="DEVELOPER">Developer</option>
          </select>
        </div>
      </Card>

      {/* Users Table */}
      {users.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500">
            <User className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No users found</p>
            <p className="mt-1 text-sm">
              {searchParams.search ? 'Try a different search term' : 'Create your first user to get started'}
            </p>
            {canWrite && (
              <Button className="mt-4" asChild>
                <Link href="/admin/users/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Link>
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Orders</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Last Login</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{u.name || 'No name'}</p>
                          <p className="text-sm text-slate-600">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={roleColors[u.role]}>{u.role}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {u.isEmailVerified ? (
                          <Badge className="bg-green-100 text-green-800">Verified</Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800">Unverified</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{u._count.orders}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/admin/users/${u.id}/edit`}>Edit</Link>
                        </Button>
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
                {page > 1 ? <Link href={`/admin/users?page=${page - 1}`}>Previous</Link> : <span>Previous</span>}
              </Button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" disabled={page === totalPages} asChild={page < totalPages}>
                {page < totalPages ? <Link href={`/admin/users?page=${page + 1}`}>Next</Link> : <span>Next</span>}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
