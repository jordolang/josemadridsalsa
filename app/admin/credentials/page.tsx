import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { Card } from '@/components/ui/card'
import { Lock, KeyRound, Clock, AlertTriangle, AlertCircle } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'
import { isSuperAdmin, getGrantPermissions } from '@/lib/credentials'
import CredentialsPageClient from '@/components/admin/CredentialsPageClient'

export const metadata: Metadata = createMetadata({
  title: 'Credentials - Jose Madrid Salsa Admin',
  description: 'Secure credential vault',
  pathname: '/admin/credentials',
})

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

function isMissingTableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021'
  )
}

export default async function CredentialsPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'credentials:read'))) {
    redirect('/admin')
  }

  const superAdmin = isSuperAdmin(user.email)

  // Check for a non-revoked access grant
  let accessGrant: { id: string } | null = null
  let grantPermissions: Awaited<ReturnType<typeof getGrantPermissions>> = null

  try {
    accessGrant = await prisma.credentialAccessGrant.findFirst({
      where: {
        email: user.email,
        revokedAt: null,
      },
      select: { id: true },
    })
    grantPermissions = await getGrantPermissions(user.email)
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn('[Credentials] credential_access_grants table does not exist. Run prisma migrate deploy.')
      if (!superAdmin) {
        return (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Card className="max-w-md p-12 text-center">
              <AlertCircle className="mx-auto mb-4 h-16 w-16 text-amber-500" />
              <h2 className="text-2xl font-bold">Setup Required</h2>
              <p className="mt-2 text-slate-600">
                The credentials vault tables have not been created yet.
                Please run database migrations.
              </p>
            </Card>
          </div>
        )
      }
    } else {
      throw error
    }
  }

  const canWrite = await hasPermission(user, 'credentials:write')

  if (!accessGrant && !superAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md p-12 text-center">
          <Lock className="mx-auto mb-4 h-16 w-16 text-slate-300" />
          <h2 className="text-2xl font-bold">Credentials Vault</h2>
          <p className="mt-2 text-slate-600">
            Access to the credentials vault requires explicit authorization.
            Contact the system administrator.
          </p>
        </Card>
      </div>
    )
  }

  // Fetch credentials sorted by provider alphabetically
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

    // Get unique providers for filter dropdown
    providersList = await prisma.serviceCredential.findMany({
      select: { serviceName: true },
      distinct: ['serviceName'],
      orderBy: { serviceName: 'asc' },
    })
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn('[Credentials] service_credentials table does not exist. Run prisma migrate deploy.')
    } else {
      throw error
    }
  }

  const maskedCredentials = credentials.map((c) => ({
    ...c,
    password: '********',
    passwordChangedAt: c.passwordChangedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))

  const lastUpdated = credentials.length > 0
    ? credentials.reduce((latest, c) => c.updatedAt > latest ? c.updatedAt : latest, credentials[0].updatedAt)
    : null

  const now = Date.now()
  const expiredCount = credentials.filter((c) => {
    const changedAt = c.passwordChangedAt ?? c.createdAt
    return now - changedAt.getTime() > NINETY_DAYS_MS
  }).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Credentials</h1>
        <p className="text-slate-600">Secure credential vault</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <KeyRound className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-slate-600">Total Credentials</p>
              <p className="text-2xl font-bold">{totalCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-slate-600" />
            <div>
              <p className="text-sm text-slate-600">Last Updated</p>
              <p className="text-2xl font-bold">
                {lastUpdated
                  ? new Date(lastUpdated).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </Card>
        <Card className={`p-4 ${expiredCount > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={`h-8 w-8 ${expiredCount > 0 ? 'text-red-500' : 'text-green-600'}`} />
            <div>
              <p className="text-sm text-slate-600">Passwords 90+ Days</p>
              <p className={`text-2xl font-bold ${expiredCount > 0 ? 'text-red-600' : ''}`}>
                {expiredCount}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <CredentialsPageClient
        initialCredentials={maskedCredentials}
        totalCount={totalCount}
        accessLevel={canWrite ? 'write' : 'read'}
        canWrite={canWrite}
        isSuperAdmin={superAdmin}
        grantPermissions={superAdmin ? { canView: true, canAdd: true, canEdit: true, canDelete: true, canUpload: true } : grantPermissions}
        providers={providersList.map((p) => p.serviceName)}
      />
    </div>
  )
}
