import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import { ResourceManager } from '@/components/admin/cms/resource-manager'
import { Badge } from '@/components/ui/badge'
import { STATUS_OPTIONS, statusBadge } from '@/components/admin/cms/status'

export const metadata: Metadata = createMetadata({
  title: 'Banners - Jose Madrid Salsa Admin',
  description: 'Promotional banners across the storefront.',
  pathname: '/admin/content/banners',
})

export default function BannersPage() {
  return (
    <ResourceManager
      title="Banners"
      description="Promotional banners with an image, copy and a button. Each placement renders its highest-priority live banner."
      endpoint="/api/admin/cms/banners"
      collectionKey="banners"
      addLabel="New banner"
      emptyMessage="No banners yet."
      columns={[
        { name: 'name', label: 'Name' },
        {
          name: 'placement',
          label: 'Placement',
          render: (row) => <Badge variant="outline">{String(row.placement)}</Badge>,
        },
        { name: 'status', label: 'Status', render: statusBadge },
        { name: 'priority', label: 'Priority' },
      ]}
      defaults={{
        name: '',
        placement: 'SITE_WIDE_TOP',
        headline: '',
        body: '',
        imageUrl: '',
        imageAlt: '',
        ctaText: '',
        ctaHref: '',
        status: 'DRAFT',
        startsAt: '',
        endsAt: '',
        priority: 0,
        targetPaths: [],
      }}
      fields={[
        {
          name: 'name',
          label: 'Internal name',
          type: 'text',
          help: 'Only shown here, to help you find this banner later.',
        },
        {
          name: 'placement',
          label: 'Placement',
          type: 'select',
          options: [
            { value: 'SITE_WIDE_TOP', label: 'Site-wide (top of page)' },
            { value: 'HOMEPAGE_HERO', label: 'Homepage hero' },
            { value: 'CATEGORY', label: 'Category pages' },
            { value: 'CHECKOUT', label: 'Checkout' },
            { value: 'FUNDRAISING', label: 'Fundraising pages' },
          ],
        },
        { name: 'headline', label: 'Headline', type: 'text' },
        { name: 'body', label: 'Body copy', type: 'textarea' },
        { name: 'imageUrl', label: 'Image', type: 'image' },
        { name: 'imageAlt', label: 'Image alt text', type: 'text' },
        { name: 'ctaText', label: 'Button text', type: 'text' },
        { name: 'ctaHref', label: 'Button link', type: 'text', placeholder: '/products' },
        { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
        { name: 'startsAt', label: 'Starts at', type: 'datetime' },
        { name: 'endsAt', label: 'Ends at', type: 'datetime' },
        {
          name: 'priority',
          label: 'Priority',
          type: 'number',
          help: 'Higher wins when several banners share a placement.',
        },
        {
          name: 'targetPaths',
          label: 'Limit to paths',
          type: 'paths',
          help: 'One path per line. Leave blank for every page in this placement.',
        },
      ]}
    />
  )
}
