import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { blobUploadsConfigured } from '@/lib/blob-storage'
import { BlobFileExplorer } from '@/components/admin/developer/BlobFileExplorer'
import { createMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'File Explorer - Developer Console',
  description: 'Browse and manage the josemadridsalsa-blob store.',
  pathname: '/admin/developer/files',
})

export default async function DeveloperFilesPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'developer:blob'))) {
    redirect('/admin')
  }

  if (!blobUploadsConfigured()) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-6 text-sm">
        <p className="font-medium">Blob storage is not configured.</p>
        <p className="mt-1 text-muted-foreground">
          Set <code className="font-mono">BLOB_READ_WRITE_TOKEN</code> to the read/write token
          of the <code className="font-mono">josemadridsalsa-blob</code> store (Vercel →
          Storage → josemadridsalsa-blob) to enable the file explorer.
        </p>
      </div>
    )
  }

  return <BlobFileExplorer />
}
