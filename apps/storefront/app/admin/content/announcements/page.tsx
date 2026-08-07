import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import { ResourceManager } from '@/components/admin/cms/resource-manager'
import { Badge } from '@/components/ui/badge'
import { STATUS_OPTIONS, statusBadge } from '@/components/admin/cms/status'

export const metadata: Metadata = createMetadata({
  title: 'Announcements - Jose Madrid Salsa Admin',
  description: 'Site-wide announcement bar.',
  pathname: '/admin/content/announcements',
})

export default function AnnouncementsPage() {
  return (
    <ResourceManager
      title="Announcements"
      description="The thin bar above the site navigation. The highest-priority live announcement wins."
      endpoint="/api/admin/cms/announcements"
      collectionKey="announcements"
      addLabel="New announcement"
      emptyMessage="No announcements yet. Create one to show a message above the navigation."
      columns={[
        { name: 'message', label: 'Message' },
        {
          name: 'variant',
          label: 'Style',
          render: (row) => <Badge variant="outline">{String(row.variant)}</Badge>,
        },
        { name: 'status', label: 'Status', render: statusBadge },
        { name: 'priority', label: 'Priority' },
      ]}
      defaults={{
        message: '',
        ctaText: '',
        ctaHref: '',
        variant: 'INFO',
        status: 'DRAFT',
        startsAt: '',
        endsAt: '',
        priority: 0,
        targetPaths: [],
        dismissible: true,
      }}
      fields={[
        { name: 'message', label: 'Message', type: 'textarea' },
        { name: 'ctaText', label: 'Button text', type: 'text' },
        {
          name: 'ctaHref',
          label: 'Button link',
          type: 'text',
          placeholder: '/products',
          help: 'A relative path, or a full https:// URL.',
        },
        {
          name: 'variant',
          label: 'Style',
          type: 'select',
          options: [
            { value: 'INFO', label: 'Info' },
            { value: 'PROMO', label: 'Promotion' },
            { value: 'WARNING', label: 'Warning' },
            { value: 'SUCCESS', label: 'Success' },
          ],
        },
        { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
        {
          name: 'startsAt',
          label: 'Starts at',
          type: 'datetime',
          help: 'Leave blank to start immediately.',
        },
        {
          name: 'endsAt',
          label: 'Ends at',
          type: 'datetime',
          help: 'Leave blank to run until the status changes.',
        },
        {
          name: 'priority',
          label: 'Priority',
          type: 'number',
          help: 'Higher wins when several announcements are live at once.',
        },
        {
          name: 'targetPaths',
          label: 'Limit to paths',
          type: 'paths',
          help: 'One path per line. Leave blank to show on every page.',
        },
        { name: 'dismissible', label: 'Visitors can dismiss it', type: 'boolean' },
      ]}
    />
  )
}
