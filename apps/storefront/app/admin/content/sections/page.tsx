import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import { requirePermission } from '@/lib/rbac'
import { composableBlocks } from '@/lib/cms/blocks'
import { ResourceManager } from '@/components/admin/cms/resource-manager'
import { STATUS_OPTIONS } from '@/components/admin/cms/status'

export const metadata: Metadata = createMetadata({
  title: 'Reusable Sections - Jose Madrid Salsa Admin',
  description: 'Content blocks shared across pages.',
  pathname: '/admin/content/sections',
})

export const dynamic = 'force-dynamic'

export default async function ReusableSectionsPage() {
  await requirePermission('content:read')

  const typeOptions = composableBlocks().map((block) => ({
    value: block.type,
    label: block.label,
  }))

  return (
    <ResourceManager
      title="Reusable sections"
      description="Content you want to appear on more than one page. Edit it once here and every page using it updates."
      endpoint="/api/admin/cms/sections"
      collectionKey="sections"
      addLabel="New section"
      emptyMessage="No reusable sections yet."
      columns={[
        { name: 'name', label: 'Name' },
        { name: 'key', label: 'Key' },
        { name: 'type', label: 'Block' },
        { name: 'status', label: 'Status', format: 'status' },
      ]}
      defaults={{ key: '', name: '', type: typeOptions[0]?.value ?? 'richText', data: {}, status: 'PUBLISHED' }}
      fields={[
        { name: 'name', label: 'Name', type: 'text', help: 'Shown here so you can find it later.' },
        {
          name: 'key',
          label: 'Key',
          type: 'text',
          placeholder: 'shipping-promise',
          help: 'Lowercase letters, numbers and hyphens.',
        },
        { name: 'type', label: 'Block type', type: 'select', options: typeOptions },
        { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
      ]}
    />
  )
}
