import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import { getFaqs, getFaqCategories } from '@/lib/cms/queries'
import { FaqGroups } from '@/components/store/faq-groups'

export const revalidate = 7200 // 2 hours

export const metadata: Metadata = createMetadata({
  title: 'Frequently Asked Questions - Jose Madrid Salsa',
  description:
    'Answers to common questions about ordering, shipping, fundraising and wholesale with Jose Madrid Salsa.',
  pathname: '/faq',
})

/** Public FAQ page, grouped by the categories set up in the admin. */
export default async function FaqPage() {
  const [items, categories] = await Promise.all([getFaqs(), getFaqCategories()])

  return (
    <main className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl font-bold">Frequently asked questions</h1>
      <FaqGroups items={items} categories={categories} />
    </main>
  )
}
