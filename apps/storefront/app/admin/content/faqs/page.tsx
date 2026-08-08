import type { Metadata } from 'next'
import Link from 'next/link'
import { FolderTree } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'
import { requirePermission } from '@/lib/rbac'
import { getFaqCategories } from '@/lib/cms/queries'
import { ResourceManager } from '@/components/admin/cms/resource-manager'
import { STATUS_OPTIONS } from '@/components/admin/cms/status'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = createMetadata({
  title: 'FAQs - Jose Madrid Salsa Admin',
  description: 'Frequently asked questions.',
  pathname: '/admin/content/faqs',
})

export const dynamic = 'force-dynamic'

export default async function FaqsPage() {
  await requirePermission('content:read')
  const categories = await getFaqCategories()

  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: category.name,
  }))

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href="/admin/content/faqs/categories">
            <FolderTree className="mr-2 h-4 w-4" />
            Manage categories
          </Link>
        </Button>
      </div>

      <ResourceManager
        title="FAQs"
        description="Questions shown on the FAQ block of any page. Group them into categories to control where they appear."
        endpoint="/api/admin/cms/faqs"
        collectionKey="faqs"
        addLabel="New question"
        emptyMessage="No questions yet."
        columns={[
          { name: 'question', label: 'Question' },
          {
            name: 'category',
            label: 'Category',
            format: 'nested',
            path: 'category.name',
            fallback: 'Uncategorised',
          },
          { name: 'status', label: 'Status', format: 'status' },
          { name: 'sortOrder', label: 'Order' },
        ]}
        defaults={{
          question: '',
          answer: '',
          categoryId: '',
          sortOrder: 0,
          status: 'PUBLISHED',
        }}
        fields={[
          { name: 'question', label: 'Question', type: 'text' },
          { name: 'answer', label: 'Answer', type: 'textarea' },
          {
            name: 'categoryId',
            label: 'Category',
            type: 'select',
            options: categoryOptions,
            help:
              categoryOptions.length === 0
                ? 'No categories yet — create one first to group questions.'
                : 'Leave unset to show this question in every FAQ block.',
          },
          { name: 'sortOrder', label: 'Sort order', type: 'number' },
          { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
        ]}
      />
    </div>
  )
}
