import type { Metadata } from 'next'
import Link from 'next/link'
import { createMetadata } from '@/lib/metadata'
import { getFaqs, getFaqCategories } from '@/lib/cms/queries'
import { FaqGroups } from '@/components/store/faq-groups'
import {
  HELP_DOCS_PREFIX,
  SALSADOCS_URL,
  helpQuerySchema,
  searchHelpArticles,
} from '@/lib/help/search'

export const metadata: Metadata = createMetadata({
  title: 'Help Center - Jose Madrid Salsa',
  description:
    'Search our knowledge base, track an order, read shipping and return policies, or get in touch with Jose Madrid Salsa.',
  pathname: '/help',
})

const QUICK_LINKS = [
  { href: '/account/orders', title: 'Your orders', description: 'Order status and tracking' },
  { href: '/shipping', title: 'Shipping', description: 'Processing times, rates and carriers' },
  { href: '/returns', title: 'Returns', description: 'Unopened jars within 14 days' },
  { href: '/contact', title: 'Contact us', description: 'Still stuck? We will help' },
]

/** Customer help hub: knowledge-base search, quick links and the CMS FAQ. */
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const { q } = await searchParams
  const parsed = helpQuerySchema.safeParse(Array.isArray(q) ? q[0] : q)
  const query = parsed.success ? parsed.data : null

  const [results, items, categories] = await Promise.all([
    query ? searchHelpArticles(query) : Promise.resolve(undefined),
    getFaqs(),
    getFaqCategories(),
  ])

  return (
    <main className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl font-bold">How can we help?</h1>

      <form action="/help" method="get" role="search" className="mt-6 flex gap-2">
        <label htmlFor="help-search" className="sr-only">
          Search help articles
        </label>
        <input
          id="help-search"
          name="q"
          type="search"
          defaultValue={query ?? ''}
          maxLength={100}
          placeholder="Search shipping, returns, orders…"
          className="flex-1 rounded-md border border-input bg-background px-4 py-2"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-5 py-2 font-medium text-primary-foreground"
        >
          Search
        </button>
      </form>

      {query && (
        <section aria-live="polite" className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Results for &ldquo;{query}&rdquo;</h2>
          {results === null ? (
            <p className="text-muted-foreground">
              Search is unavailable right now. Browse the{' '}
              <a href={`${SALSADOCS_URL}${HELP_DOCS_PREFIX}`} className="underline">
                knowledge base
              </a>{' '}
              or <Link href="/contact" className="underline">contact us</Link>.
            </p>
          ) : results && results.length > 0 ? (
            <ul className="space-y-3">
              {results.map((result) => (
                <li key={result.url} className="rounded-lg border p-4">
                  <a href={result.url} className="font-medium underline-offset-4 hover:underline">
                    {result.title}
                  </a>
                  {result.snippet && (
                    <p className="mt-1 text-sm text-muted-foreground">{result.snippet}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              No articles matched. Try the FAQ below or{' '}
              <Link href="/contact" className="underline">contact us</Link>.
            </p>
          )}
        </section>
      )}

      <nav aria-label="Quick help links" className="mt-10 grid gap-4 sm:grid-cols-2">
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-lg border p-4 hover:bg-muted">
            <span className="font-medium">{link.title}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{link.description}</span>
          </Link>
        ))}
      </nav>

      <section className="mt-10 rounded-lg border p-6">
        <h2 className="text-2xl font-semibold">Knowledge base</h2>
        <p className="mt-2 text-muted-foreground">
          Step-by-step guides for orders, shipping, tracking and returns.
        </p>
        <a
          href={`${SALSADOCS_URL}${HELP_DOCS_PREFIX}`}
          className="mt-4 inline-block font-medium underline underline-offset-4"
        >
          Browse all help articles →
        </a>
      </section>

      <section className="mt-14">
        <h2 className="font-serif text-3xl font-bold">Frequently asked questions</h2>
        <FaqGroups items={items} categories={categories} />
      </section>
    </main>
  )
}
