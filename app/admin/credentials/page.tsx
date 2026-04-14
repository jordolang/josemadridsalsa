import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { AlertCircle, AlertTriangle, Clock, KeyRound, Lock } from 'lucide-react'

import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { createMetadata } from '@/lib/metadata'
import { isSuperAdmin, getGrantPermissions, isMissingTableError } from '@/lib/credentials'
import CredentialsPageClient from '@/components/admin/CredentialsPageClient'

export const metadata: Metadata = createMetadata({
  title: 'Credentials - Jose Madrid Salsa Admin',
  description: 'Secure credential vault',
  pathname: '/admin/credentials',
})

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

/** Render the "tables not set up yet" message */
function SetupRequired() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md">
        <CardContent className="p-12 text-center">
          <AlertCircle className="mx-auto mb-4 size-16 text-amber-500 dark:text-muted-foreground" />
          <h2 className="text-2xl font-bold">Setup Required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The credentials vault tables have not been created yet. Please run
            database migrations:{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              prisma migrate deploy
            </code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function CredentialsPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'credentials:read'))) {
    redirect('/admin')
  }

  const superAdmin = isSuperAdmin(user.email)

  // ── Access grant check ────────────────────────────────────────────────────
  let accessGrant: { id: string } | null = null
  let grantPermissions: Awaited<ReturnType<typeof getGrantPermissions>> = null
  let grantsTableMissing = false

  try {
    accessGrant = await prisma.credentialAccessGrant.findFirst({
      where: { email: user.email, revokedAt: null },
      select: { id: true },
    })
    grantPermissions = await getGrantPermissions(user.email)
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn('[Credentials] credential_access_grants table missing. Run prisma migrate deploy.')
      grantsTableMissing = true
    } else {
      // Unexpected error — log it, surface setup message to protect the page
      console.error('[Credentials] Error querying access grants:', error)
      grantsTableMissing = true
    }
  }

  // Non-super-admins need the grants table to exist
  if (grantsTableMissing && !superAdmin) {
    return <SetupRequired />
  }

  const canWrite = await hasPermission(user, 'credentials:write')

  if (!accessGrant && !superAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-12 text-center">
            <Lock className="mx-auto mb-4 size-16 text-muted-foreground/40" />
            <h2 className="text-2xl font-bold">Credentials Vault</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Access to the credentials vault requires explicit authorization.
              Contact the system administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Credential data fetch ─────────────────────────────────────────────────
  let credentials: {
    id: string
    serviceName: string
    label: string
    username: string | null
    url: string | null
    notes: string | null
    passwordChangedAt: Date | null
    createdAt: Date
    updatedAt: Date
  }[] = []
  let totalCount = 0
  let providersList: { serviceName: string }[] = []

  try {
    ;[credentials, totalCount] = await Promise.all([
      prisma.serviceCredential.findMany({
        orderBy: { serviceName: 'asc' },
        select: {
          id: true,
          serviceName: true,
          label: true,
          username: true,
          url: true,
          notes: true,
          passwordChangedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.serviceCredential.count(),
    ])

    providersList = await prisma.serviceCredential.findMany({
      select: { serviceName: true },
      distinct: ['serviceName'],
      orderBy: { serviceName: 'asc' },
    })
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn('[Credentials] service_credentials table missing. Run prisma migrate deploy.')
      if (!superAdmin) return <SetupRequired />
      // Super admin: continue with empty state so they can at least see the page
    } else {
      // Unexpected error — log and fall through with empty data rather than crashing
      console.error('[Credentials] Error fetching credentials:', error)
    }
    // credentials / totalCount / providersList stay as their empty defaults
  }

  // ── Build display data ────────────────────────────────────────────────────
  const maskedCredentials = credentials.map((c) => ({
    ...c,
    password: '********',
    passwordChangedAt: c.passwordChangedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))

  const lastUpdated =
    credentials.length > 0
      ? credentials.reduce(
          (latest, c) => (c.updatedAt > latest ? c.updatedAt : latest),
          credentials[0].updatedAt
        )
      : null

  const now = Date.now()
  const expiredCount = credentials.filter((c) => {
    const changedAt = c.passwordChangedAt ?? c.createdAt
    return now - changedAt.getTime() > NINETY_DAYS_MS
  }).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Credentials</h1>
        <p className="text-sm text-muted-foreground">Secure credential vault</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Total Credentials
            </CardDescription>
            <KeyRound className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {totalCount}
            </CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Last Updated
            </CardDescription>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl font-bold">
              {lastUpdated
                ? new Date(lastUpdated).toLocaleDateString()
                : 'Never'}
            </CardTitle>
          </CardContent>
        </Card>
        <Card className={cn(expiredCount > 0 && 'border-destructive')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Passwords 90+ Days
            </CardDescription>
            <AlertTriangle
              className={cn(
                'size-4',
                expiredCount > 0
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              )}
            />
          </CardHeader>
          <CardContent>
            <CardTitle
              className={cn(
                'text-2xl font-bold tabular-nums',
                expiredCount > 0 && 'text-destructive'
              )}
            >
              {expiredCount}
            </CardTitle>
          </CardContent>
        </Card>
      </div>

      <CredentialsPageClient
        initialCredentials={maskedCredentials}
        totalCount={totalCount}
        accessLevel={canWrite ? 'write' : 'read'}
        canWrite={canWrite}
        isSuperAdmin={superAdmin}
        grantPermissions={
          superAdmin
            ? { canView: true, canAdd: true, canEdit: true, canDelete: true, canUpload: true }
            : grantPermissions
        }
        providers={providersList.map((p) => p.serviceName)}
      />
    </div>
  )
}
