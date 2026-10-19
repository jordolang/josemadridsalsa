import type { Metadata } from 'next'
import Link from 'next/link'
import { createMetadata } from '@/lib/metadata'
import { getFaqs, getFaqCategories } from '@/lib/cms/queries'
import { FaqGroups } from '@/components/store/faq-groups'
import { HelpMdx } from '@/components/help/help-mdx'
import { getHelpArticle } from '@/lib/help/articles'
import { helpQuerySchema, searchHelpArticles } from '@/lib/help/search'

export const metadata: Metadata = createMetadata({
  title: 'Help Center',
  description:
    'Search our knowledge base, track an order, read shipping and return policies, or get in touch with Jose Madrid Salsa.',
  pathname: '/help',
})

const QUICK_LINKS = [
  { href: '/order-tracking', title: 'Track your order', description: 'Order number and phone, or a tracking number' },
  { href: '/shipping', title: 'Shipping', description: 'Processing times, rates and carriers' },
  { href: '/returns', title: 'Returns', description: 'Unopened jars within 14 days' },
  { href: '/contact', title: 'Contact us', description: 'Still stuck? We will help' },
]

/** Customer help hub: knowledge-base search, quick links, the help articles and the CMS FAQ. */
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const { q } = await searchParams
  const parsed = helpQuerySchema.safeParse(Array.isArray(q) ? q[0] : q)
  const query = parsed.success ? parsed.data : null

  const [results, home, items, categories] = await Promise.all([
    query ? searchHelpArticles(query) : Promise.resolve(undefined),
    getHelpArticle('index'),
    getFaqs(),
    getFaqCategories(),
  ])

  return (
    <main className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-4xl font-bold">How can we help?</h1>
      {home?.description && <p className="mt-3 text-lg text-muted-foreground">{home.description}</p>}

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
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-4 py-2"
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
          {results && results.length > 0 ? (
            <ul className="space-y-3">
              {results.map((result) => (
                <li key={result.url} className="rounded-lg border p-4">
                  <Link href={result.url} className="font-medium underline-offset-4 hover:underline">
                    {result.title}
                  </Link>
                  {result.snippet && (
                    <p className="mt-1 text-sm text-muted-foreground">{result.snippet}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              No articles matched. Browse the topics below or{' '}
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

      {home && (
        <section aria-labelledby="knowledge-base" className="mt-14">
          <h2 id="knowledge-base" className="font-serif text-3xl font-bold">
            Knowledge base
          </h2>
          <div className="mt-4">
            <HelpMdx source={home.body} />
          </div>
        </section>
      )}

      <section className="mt-14">
        <h2 className="font-serif text-3xl font-bold">Frequently asked questions</h2>
        <FaqGroups items={items} categories={categories} />
      </section>
    </main>
  )
}
