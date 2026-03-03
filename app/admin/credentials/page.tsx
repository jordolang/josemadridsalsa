import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/rbac'
import { hasCredentialAccess, isSuperAdmin } from '@/lib/credentials-access'
import { createMetadata } from '@/lib/metadata'
import { ShieldOff } from 'lucide-react'
import { CredentialsClient } from './credentials-client'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = createMetadata({
  title: 'Credentials Vault - Jose Madrid Salsa Admin',
  description: 'Manage service credentials and account access.',
  pathname: '/admin/credentials',
})

export default async function CredentialsPage() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldOff className="mx-auto mb-4 h-16 w-16 text-red-400" />
          <h1 className="text-2xl font-bold text-foreground">Not Permitted</h1>
          <p className="mt-2 text-muted-foreground">You must be signed in to access this page.</p>
        </div>
      </div>
    )
  }

  const allowed = await hasCredentialAccess(user.email)

  if (!allowed) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldOff className="mx-auto mb-4 h-16 w-16 text-red-400" />
          <h1 className="text-2xl font-bold text-foreground">Not Permitted</h1>
          <p className="mt-2 text-muted-foreground">
            You do not have access to the credentials vault.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact the site administrator to request access.
          </p>
        </div>
      </div>
    )
  }

  return (
    <CredentialsClient
      isGrantAdmin={isSuperAdmin(user.email)}
      userEmail={user.email}
    />
  )
}
