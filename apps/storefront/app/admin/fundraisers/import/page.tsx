import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { Button } from '@/components/ui/button'
import { CsvImporter } from '@/components/admin/shared/CsvImporter'

export const metadata: Metadata = createMetadata({
  title: 'Import Fundraisers - Jose Madrid Salsa Admin',
  description: 'Import past and current fundraisers from a spreadsheet.',
  pathname: '/admin/fundraisers/import',
})

const TARGET_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'organizationName', label: 'Organization', required: true },
  { key: 'contactEmail', label: 'Contact email', required: true },
  { key: 'startDate', label: 'Start date', required: true },
  { key: 'endDate', label: 'End date', required: true },
  { key: 'commissionRate', label: 'Commission rate (%)', required: true },
  { key: 'goal', label: 'Goal' },
  { key: 'contactPhone', label: 'Contact phone' },
  { key: 'slug', label: 'Slug' },
  { key: 'subdomain', label: 'Subdomain' },
  { key: 'status', label: 'Status' },
  { key: 'description', label: 'Description' },
  { key: 'missionStatement', label: 'Mission statement' },
]

const PREVIEW_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'organization', label: 'Organization' },
  { key: 'start', label: 'Start' },
  { key: 'end', label: 'End' },
  { key: 'commission', label: 'Commission' },
]

export default async function ImportFundraisersPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/fundraisers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Import Fundraisers</h1>
          <p className="text-muted-foreground">
            Load past or current campaigns from a spreadsheet. Columns are
            auto-detected — adjust the mapping if anything looks off.
          </p>
        </div>
      </div>

      <CsvImporter
        endpoint="/api/admin/fundraisers/import"
        entityLabel="fundraisers"
        targetFields={TARGET_FIELDS}
        previewColumns={PREVIEW_COLUMNS}
        samplePlaceholder="Name,Organization,Contact Email,Start Date,End Date,Commission Rate"
        instructions={
          <>
            Fundraisers are matched on slug (generated from the name when your
            file has no slug column). Re-importing updates existing campaigns in
            place; order and revenue totals stay driven by live orders. Nothing
            is written until you review the preview and confirm.
          </>
        }
      />
    </div>
  )
}
