import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Lock, KeyRound, Clock } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'
import CredentialsPageClient from '@/components/admin/CredentialsPageClient'

export const metadata: Metadata = createMetadata({
  title: 'Credentials - Jose Madrid Salsa Admin',
  description: 'Secure credential vault',
  pathname: '/admin/credentials',
})

export default async function CredentialsPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'credentials:read'))) {
    redirect('/admin')
  }

  // Check for a non-revoked access grant
  const accessGrant = await prisma.credentialAccessGrant.findFirst({
    where: {
      email: user.email,
      revokedAt: null,
    },
  })

  const canWrite = await hasPermission(user, 'credentials:write')

  if (!accessGrant) {
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

  // Fetch credentials (masked passwords)
  const [credentials, totalCount] = await Promise.all([
    prisma.serviceCredential.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        serviceName: true,
        label: true,
        username: true,
        url: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.serviceCredential.count(),
  ])

  const maskedCredentials = credentials.map((c) => ({
    ...c,
    password: '••••••••',
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))

  const lastUpdated = credentials[0]?.updatedAt

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Credentials</h1>
        <p className="text-slate-600">Secure credential vault</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
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
      </div>

      <CredentialsPageClient
        initialCredentials={maskedCredentials}
        totalCount={totalCount}
        accessLevel={canWrite ? 'write' : 'read'}
        canWrite={canWrite}
      />
    </div>
  )
}
