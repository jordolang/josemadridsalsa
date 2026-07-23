import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { Button } from '@/components/ui/button'
import { CsvImporter } from '@/components/admin/shared/CsvImporter'

export const metadata: Metadata = createMetadata({
  title: 'Import Customers - Jose Madrid Salsa Admin',
  description: 'Import customers and contacts from a CSV export.',
  pathname: '/admin/customers/import',
})

const TARGET_FIELDS = [
  { key: 'email', label: 'Email address', required: true },
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'phone', label: 'Phone' },
  { key: 'emailStatus', label: 'Email status' },
  { key: 'emailPermissionStatus', label: 'Email permission status' },
  { key: 'sourceName', label: 'Source name' },
  { key: 'notes', label: 'Notes' },
]

const PREVIEW_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
]

export default async function ImportCustomersPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'users:write'))) {
    redirect('/admin')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Import Customers</h1>
          <p className="text-muted-foreground">
            Load contacts from a Constant Contact export or any CSV with an email
            column.
          </p>
        </div>
      </div>

      <CsvImporter
        endpoint="/api/admin/customers/import"
        entityLabel="customers"
        targetFields={TARGET_FIELDS}
        previewColumns={PREVIEW_COLUMNS}
        samplePlaceholder="Email address,First name,Last name,Phone"
        instructions={
          <>
            Customers are matched on email. Re-importing the same file updates
            existing customers and fills in any blank fields instead of creating
            duplicates. Nothing is written until you review the preview and
            confirm.
          </>
        }
      />
    </div>
  )
}
