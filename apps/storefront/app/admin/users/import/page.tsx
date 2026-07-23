import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { Button } from '@/components/ui/button'
import { CsvImporter } from '@/components/admin/shared/CsvImporter'

export const metadata: Metadata = createMetadata({
  title: 'Import Users - Jose Madrid Salsa Admin',
  description: 'Import user accounts from a CSV export.',
  pathname: '/admin/users/import',
})

const TARGET_FIELDS = [
  { key: 'email', label: 'Email address', required: true },
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'role', label: 'Role' },
]

const PREVIEW_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'role', label: 'Role' },
]

export default async function ImportUsersPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'users:write'))) {
    redirect('/admin')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Import Users</h1>
          <p className="text-muted-foreground">
            Load user accounts from a CSV. Accounts are matched on email.
          </p>
        </div>
      </div>

      <CsvImporter
        endpoint="/api/admin/users/import"
        entityLabel="users"
        targetFields={TARGET_FIELDS}
        previewColumns={PREVIEW_COLUMNS}
        samplePlaceholder="Email,Name,Phone,Role"
        instructions={
          <>
            New accounts are created without a password — users set one via
            password reset or by signing in with Google. For security, an import
            can only assign Customer, Wholesale, or Fundraiser roles, and never
            changes the role of an existing account. Nothing is written until you
            review the preview and confirm.
          </>
        }
      />
    </div>
  )
}
