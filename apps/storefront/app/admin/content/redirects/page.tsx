import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import { ResourceManager } from '@/components/admin/cms/resource-manager'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = createMetadata({
  title: 'Redirects - Jose Madrid Salsa Admin',
  description: 'URL redirects.',
  pathname: '/admin/content/redirects',
})

export default function RedirectsPage() {
  return (
    <ResourceManager
      title="Redirects"
      description="Send old URLs to new ones. Applied on every request, so changes take effect immediately without a deploy."
      endpoint="/api/admin/cms/redirects"
      collectionKey="redirects"
      addLabel="New redirect"
      emptyMessage="No redirects yet."
      columns={[
        { name: 'source', label: 'From' },
        { name: 'destination', label: 'To' },
        {
          name: 'permanent',
          label: 'Type',
          render: (row) => (
            <Badge variant="outline">{row.permanent ? '301 permanent' : '302 temporary'}</Badge>
          ),
        },
        {
          name: 'isActive',
          label: 'Active',
          render: (row) => (
            <Badge variant={row.isActive ? 'default' : 'outline'}>
              {row.isActive ? 'Active' : 'Paused'}
            </Badge>
          ),
        },
        { name: 'hitCount', label: 'Hits' },
      ]}
      defaults={{
        source: '',
        destination: '',
        permanent: true,
        isActive: true,
        note: '',
      }}
      fields={[
        {
          name: 'source',
          label: 'From path',
          type: 'text',
          placeholder: '/old-page',
          help: 'Must start with a slash. Query strings are ignored when matching.',
        },
        {
          name: 'destination',
          label: 'To path or URL',
          type: 'text',
          placeholder: '/new-page',
          help: 'A relative path, or a full https:// URL for an external destination.',
        },
        {
          name: 'permanent',
          label: 'Permanent (301) — tells search engines the move is final',
          type: 'boolean',
        },
        { name: 'isActive', label: 'Active', type: 'boolean' },
        { name: 'note', label: 'Note', type: 'text', help: 'Optional reminder of why this exists.' },
      ]}
    />
  )
}
