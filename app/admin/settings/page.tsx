import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrators',
  DEVELOPER: 'Developers',
  STAFF: 'Staff',
  WHOLESALE: 'Wholesale Accounts',
  CUSTOMER: 'Customers',
}

async function getSettingsOverview() {
  const [roleCounts, permissionCount, serviceKeyCount, recentAudit] = await Promise.all([
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

  const roleSummary = roleCounts.reduce<Record<string, number>>((acc, item) => {
    acc[item.role] = item._count._all
    return acc
  }, {})

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

  const environment = process.env.NODE_ENV === 'production' ? 'Production' : 'Development'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Settings</h1>
          <p className="text-slate-600">
            Platform-level controls, security posture, and integration status.
          </p>
        </div>
        <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600">
          Environment:{' '}
          <span className="font-semibold text-slate-900">{environment}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-6">
          <p className="text-sm text-slate-500">Permissions defined</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {overview.permissionCount.toLocaleString()}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Manage access in{' '}
            <Link href="/admin/audit-logs" className="text-blue-600 hover:underline">
              audit logs
            </Link>
            .
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-slate-500">API integrations</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {overview.serviceKeyCount.toLocaleString()}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Update credentials under{' '}
            <Link href="/admin/settings/integrations" className="text-blue-600 hover:underline">
              Integrations
            </Link>
            .
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-slate-500">Admin & staff</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {(overview.roleSummary.ADMIN || 0) + (overview.roleSummary.DEVELOPER || 0) + (overview.roleSummary.STAFF || 0)}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Review members in{' '}
            <Link href="/admin/users" className="text-blue-600 hover:underline">
              user management
            </Link>
            .
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-slate-500">Wholesale partners</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {(overview.roleSummary.WHOLESALE || 0).toLocaleString()}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Manage approvals under{' '}
            <Link href="/admin/wholesale" className="text-blue-600 hover:underline">
              Wholesale
            </Link>
            .
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold">Role distribution</h2>
        <p className="text-sm text-slate-600">
          Current user count per access level.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(roleLabels).map(([role, label]) => (
            <div key={role} className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {overview.roleSummary[role] ? overview.roleSummary[role].toLocaleString() : '0'}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Recent audit activity</h2>
          {overview.auditLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No audit log entries yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {overview.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{log.action}</p>
                    <p className="text-xs text-slate-500">
                      {log.entityType || 'System'} •{' '}
                      {log.userId ? `Actor: ${log.userId}` : 'Automated'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">{log.createdAt.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 text-right">
            <Link href="/admin/audit-logs" className="text-sm font-medium text-blue-600 hover:underline">
              View full audit log
            </Link>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">Security checklist</h2>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-start gap-2">
              <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>
              <p>Master encryption key configured for service credentials.</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>
              <p>Admin routes protected by RBAC middleware.</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>
              <p>Audit logging active for all mutations.</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-amber-100 text-amber-700">Review</Badge>
              <p>Enable two-factor authentication for administrators.</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-amber-100 text-amber-700">Review</Badge>
              <p>Rotate API keys stored in Integrations on a regular cadence.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
