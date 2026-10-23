import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, Calendar, Shield, Edit } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import {
  businessDayKey,
  formatBusinessDateTimeInput,
  formatBusinessTime,
  formatDayLabel,
  formatDecimalHours,
  punchDurationMs,
} from '@/lib/timeclock'
import EditPunchDialog from '@/components/admin/timeclock/EditPunchDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const roleColors: Record<string, string> = {
  CUSTOMER: 'bg-primary/10 text-primary',
  STAFF: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-destructive/10 text-destructive',
  DEVELOPER: 'bg-orange-100 text-orange-800',
  WHOLESALE: 'bg-teal-100 text-teal-800',
}

const orderStatusInfo: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmed', color: 'bg-primary/10 text-primary' },
  PROCESSING: { label: 'Processing', color: 'bg-purple-100 text-purple-800' },
  SHIPPED: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800' },
  DELIVERED: { label: 'Delivered', color: 'bg-primary/10 text-primary' },
  CANCELLED: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive' },
  REFUNDED: { label: 'Refunded', color: 'bg-muted text-foreground' },
}

async function getUserWithOrders(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
        },
      },
      addresses: true,
    },
  })

  return user
}

/** Most recent punches, each with its latest audited correction, if any. */
async function getRecentPunches(userId: string) {
  const punches = await prisma.timeClockEntry.findMany({
    where: { userId },
    orderBy: { clockInAt: 'desc' },
    take: 30,
    select: { id: true, clockInAt: true, clockOutAt: true, notes: true },
  })
  if (punches.length === 0) return []

  const corrections = await prisma.auditLog.findMany({
    where: {
      action: 'TIMECLOCK_CORRECTION',
      entityType: 'TimeClockEntry',
      entityId: { in: punches.map((punch) => punch.id) },
    },
    orderBy: { createdAt: 'desc' },
    select: { entityId: true, userId: true, createdAt: true, changes: true },
  })

  const editorIds = [...new Set(corrections.flatMap((c) => (c.userId ? [c.userId] : [])))]
  const editors = await prisma.user.findMany({
    where: { id: { in: editorIds } },
    select: { id: true, name: true, email: true },
  })
  const editorName = new Map(editors.map((editor) => [editor.id, editor.name || editor.email]))

  const latestCorrection = new Map<string, (typeof corrections)[number]>()
  for (const correction of corrections) {
    if (correction.entityId && !latestCorrection.has(correction.entityId)) {
      latestCorrection.set(correction.entityId, correction)
    }
  }

  return punches.map((punch) => {
    const correction = latestCorrection.get(punch.id)
    const changes = correction?.changes as { reason?: string } | null | undefined
    return {
      ...punch,
      correction: correction
        ? {
          by: (correction.userId && editorName.get(correction.userId)) || 'Unknown',
          at: correction.createdAt,
          reason: changes?.reason ?? null,
        }
        : null,
    }
  })
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const currentUser = await getCurrentUser()

  if (!currentUser || !(await hasPermission(currentUser, 'users:read'))) {
    redirect('/admin/users')
  }

  const user = await getUserWithOrders(id)

  if (!user) {
    notFound()
  }

  const canWrite = await hasPermission(currentUser, 'users:write')
  // Punch history is payroll data: only admins who can correct it see it.
  const punches = canWrite ? await getRecentPunches(user.id) : []
  const totalSpent = user.orders.reduce((sum, order) => sum + Number(order.total), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/users">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{user.name || 'Unnamed User'}</h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={roleColors[user.role] || 'bg-muted text-foreground'}>
            {user.role}
          </Badge>
          {canWrite && (
            <Button variant="outline" asChild>
              <Link href={`/admin/users/${user.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit User
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Info Card */}
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">User Information</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{user.email}</span>
                  {user.isEmailVerified ? (
                    <Badge variant="outline" className="text-primary border-border text-xs">Verified</Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">Unverified</Badge>
                  )}
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{user.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>Role: {user.role}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
                {user.lastLoginAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Last login {new Date(user.lastLoginAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Stats Card */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Orders</span>
                  <span className="font-medium">{user.orders.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Spent</span>
                  <span className="font-medium">${totalSpent.toFixed(2)}</span>
                </div>
                {user.orders.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Average Order</span>
                    <span className="font-medium">
                      ${(totalSpent / user.orders.length).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Order History */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Order History</h2>
              {user.orders.length === 0 ? (
                <p className="text-muted-foreground text-sm">No orders found for this user.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {user.orders.map((order) => {
                        const status = orderStatusInfo[order.status] || {
                          label: order.status,
                          color: 'bg-muted text-foreground',
                        }
                        return (
                          <TableRow key={order.id}>
                            <TableCell>
                              <Link
                                href={`/admin/orders/${order.id}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {order.orderNumber}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={status.color}>{status.label}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${Number(order.total).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </Card>

          {punches.length > 0 && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Time Clock</h2>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>In</TableHead>
                        <TableHead>Out</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead>Job duties</TableHead>
                        {canWrite && <TableHead className="w-10" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {punches.map((punch) => (
                        <TableRow key={punch.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDayLabel(businessDayKey(punch.clockInAt))}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatBusinessTime(punch.clockInAt)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {punch.clockOutAt ? (
                              formatBusinessTime(punch.clockOutAt)
                            ) : (
                              <Badge variant="outline">On the clock</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatDecimalHours(punchDurationMs(punch))}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {punch.notes}
                            {punch.correction && (
                              <p className="mt-1 text-xs">
                                Corrected by {punch.correction.by} on{' '}
                                {punch.correction.at.toLocaleDateString()}
                                {punch.correction.reason && `: ${punch.correction.reason}`}
                              </p>
                            )}
                          </TableCell>
                          {canWrite && (
                            <TableCell>
                              <EditPunchDialog
                                punchId={punch.id}
                                employeeName={user.name || user.email}
                                clockInAt={formatBusinessDateTimeInput(punch.clockInAt)}
                                clockOutAt={
                                  punch.clockOutAt ? formatBusinessDateTimeInput(punch.clockOutAt) : null
                                }
                                notes={punch.notes}
                              />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
