import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { Button } from '@/components/ui/button'
import { CsvImporter } from '@/components/admin/shared/CsvImporter'

export const metadata: Metadata = createMetadata({
  title: 'Import Fundraiser Participants - Jose Madrid Salsa Admin',
  description: 'Import sellers/students into their fundraisers from a CSV.',
  pathname: '/admin/fundraisers/participants/import',
})

const TARGET_FIELDS = [
  { key: 'fundraiser', label: 'Fundraiser (slug or name)', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Phone' },
  { key: 'referralCode', label: 'Referral code' },
  { key: 'status', label: 'Status' },
]

const PREVIEW_COLUMNS = [
  { key: 'fundraiser', label: 'Fundraiser' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
]

export default async function ImportParticipantsPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin')
  }

  const canExport = await hasPermission(user, 'content:read')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/fundraisers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Import Participants</h1>
            <p className="text-muted-foreground">
              Load sellers/students into their fundraisers from a spreadsheet.
            </p>
          </div>
        </div>
        {canExport && (
          <Button variant="outline" asChild>
            <a href="/api/admin/fundraisers/participants/export" download>
              <Download className="mr-2 size-4" />
              Export CSV
            </a>
          </Button>
        )}
      </div>

      <CsvImporter
        endpoint="/api/admin/fundraisers/participants/import"
        entityLabel="participants"
        targetFields={TARGET_FIELDS}
        previewColumns={PREVIEW_COLUMNS}
        samplePlaceholder="Fundraiser,Name,Email,Phone,Referral Code,Status"
        instructions={
          <>
            Each row must name the fundraiser it belongs to — by slug (preferred)
            or exact name. Participants are matched within a fundraiser by email;
            re-importing updates in place. New participants get a referral code
            automatically if you don&rsquo;t supply one, and existing codes are
            never changed. Nothing is written until you review the preview and
            confirm.
          </>
        }
      />
    </div>
  )
}
