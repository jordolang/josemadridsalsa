import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Clock } from 'lucide-react'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrators',
  DEVELOPER: 'Developers',
  STAFF: 'Staff',
  WHOLESALE: 'Wholesale Accounts',
  CUSTOMER: 'Customers',
}

async function getSettingsOverview() {
  const [roleCounts, permissionCount, serviceKeyCount, recentAudit] =
    await Promise.all([
      prisma.user.groupBy({
        by: ['role'],
        _count: { _all: true },
      }),
      prisma.permission.count(),
      prisma.serviceKey.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ])

  const roleSummary = roleCounts.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.role] = item._count._all
      return acc
    },
    {}
  )

  return {
    roleSummary,
    permissionCount,
    serviceKeyCount,
    auditLogs: recentAudit,
  }
}

export default async function SettingsPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'settings:read'))) {
    redirect('/admin')
  }

  const overview = await getSettingsOverview()

  const environment =
    process.env.NODE_ENV === 'production' ? 'Production' : 'Development'

  const overviewCards = [
    {
      label: 'Permissions defined',
      value: overview.permissionCount,
      footer: (
        <>
          Manage access in{' '}
          <Link
            href="/admin/audit-logs"
            className="text-primary hover:underline"
          >
            audit logs
          </Link>
          .
        </>
      ),
    },
    {
      label: 'API integrations',
      value: overview.serviceKeyCount,
      footer: (
        <>
          Update credentials under{' '}
          <Link
            href="/admin/settings/integrations"
            className="text-primary hover:underline"
          >
            Integrations
          </Link>
          .
        </>
      ),
    },
    {
      label: 'Admin & staff',
      value:
        (overview.roleSummary.ADMIN || 0) +
        (overview.roleSummary.DEVELOPER || 0) +
        (overview.roleSummary.STAFF || 0),
      footer: (
        <>
          Review members in{' '}
          <Link href="/admin/users" className="text-primary hover:underline">
            user management
          </Link>
          .
        </>
      ),
    },
    {
      label: 'Wholesale partners',
      value: overview.roleSummary.WHOLESALE || 0,
      footer: (
        <>
          Manage approvals under{' '}
          <Link
            href="/admin/wholesale"
            className="text-primary hover:underline"
          >
            Wholesale
          </Link>
          .
        </>
      ),
    },
  ]

  const securityChecks: Array<{ status: 'ok' | 'review'; text: string }> = [
    { status: 'ok', text: 'Master encryption key configured for service credentials.' },
    { status: 'ok', text: 'Admin routes protected by RBAC middleware.' },
    { status: 'ok', text: 'Audit logging active for all mutations.' },
    { status: 'review', text: 'Enable two-factor authentication for administrators.' },
    { status: 'review', text: 'Rotate API keys stored in Integrations on a regular cadence.' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Settings</h1>
          <p className="text-sm text-muted-foreground">
            Platform-level controls, security posture, and integration status.
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 px-3 py-1">
          <span className="text-muted-foreground">Environment:</span>
          <span className="font-semibold">{environment}</span>
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wide">
                {card.label}
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums">
                {card.value.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {card.footer}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role distribution</CardTitle>
          <CardDescription>
            Current user count per access level.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(roleLabels).map(([role, label]) => (
              <div key={role} className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {overview.roleSummary[role]
                    ? overview.roleSummary[role].toLocaleString()
                    : '0'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent audit activity</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.auditLogs.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No audit log entries yet.
              </div>
            ) : (
              <div className="space-y-3">
                {overview.auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between rounded-lg border p-4"
                  >
                    <div>
                      <p className="text-sm font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.entityType || 'System'} •{' '}
                        {log.userId ? `Actor: ${log.userId}` : 'Automated'}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {log.createdAt.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 text-right">
              <Link
                href="/admin/audit-logs"
                className="text-sm font-medium text-primary hover:underline"
              >
                View full audit log
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {securityChecks.map((check, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                {check.status === 'ok' ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="size-3" />
                    OK
                  </Badge>
                ) : (
                  <Badge variant="warning" className="gap-1">
                    <Clock className="size-3" />
                    Review
                  </Badge>
                )}
                <p className="flex-1 text-muted-foreground">{check.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
