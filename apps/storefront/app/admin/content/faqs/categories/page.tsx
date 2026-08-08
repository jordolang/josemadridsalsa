import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import { ResourceManager } from '@/components/admin/cms/resource-manager'

export const metadata: Metadata = createMetadata({
  title: 'FAQ Categories - Jose Madrid Salsa Admin',
  description: 'Groups of frequently asked questions.',
  pathname: '/admin/content/faqs/categories',
})

export default function FaqCategoriesPage() {
  return (
    <ResourceManager
      title="FAQ categories"
      description="Groups of questions. A page's FAQ block can pull one category by its slug."
      endpoint="/api/admin/cms/faq-categories"
      collectionKey="categories"
      addLabel="New category"
      emptyMessage="No categories yet."
      columns={[
        { name: 'name', label: 'Name' },
        { name: 'slug', label: 'Slug' },
        {
          name: 'items',
          label: 'Questions',
          render: (row) => {
            const counts = row._count as { items?: number } | undefined
            return counts?.items ?? 0
          },
        },
        { name: 'sortOrder', label: 'Order' },
      ]}
      defaults={{ name: '', slug: '', description: '', sortOrder: 0 }}
      fields={[
        { name: 'name', label: 'Name', type: 'text' },
        {
          name: 'slug',
          label: 'Slug',
          type: 'text',
          placeholder: 'wholesale',
          help: 'Lowercase letters, numbers and hyphens. Used to reference this group from a page.',
        },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'sortOrder', label: 'Sort order', type: 'number' },
      ]}
    />
  )
}
