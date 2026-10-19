import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createMetadata } from '@/lib/metadata'
import { HelpMdx } from '@/components/help/help-mdx'
import { HelpSidebar } from '@/components/help/help-sidebar'
import { getHelpArticle, getHelpArticles, getHelpNav, helpArticleTitle, helpArticleUrl } from '@/lib/help/articles'

type Props = { params: Promise<{ slug: string }> }

// Articles are files in content/help; anything else under /help is a 404.
export const dynamicParams = false

export async function generateStaticParams() {
  return (await getHelpArticles())
    .filter((article) => article.slug !== 'index')
    .map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getHelpArticle((await params).slug)
  if (!article) return {}
  return createMetadata({
    title: helpArticleTitle(article.title),
    description: article.description,
    pathname: helpArticleUrl(article.slug),
  })
}

export default async function HelpArticlePage({ params }: Props) {
  const { slug } = await params
  const article = slug === 'index' ? undefined : await getHelpArticle(slug)
  if (!article) notFound()

  const nav = await getHelpNav()
  const order = nav.flatMap((section) => section.articles)
  const index = order.findIndex((a) => a.slug === slug)
  const prev = order[index - 1]
  const next = order[index + 1]

  return (
    <main className="container mx-auto max-w-6xl px-4 py-12">
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <HelpSidebar nav={nav} current={slug} />

        <article className="min-w-0 max-w-3xl">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/help" className="hover:underline">
              Help Center
            </Link>{' '}
            / <span aria-current="page">{article.title}</span>
          </nav>
          <h1 className="mt-3 font-serif text-4xl font-bold">{article.title}</h1>
          {article.description && (
            <p className="mt-3 text-lg text-muted-foreground">{article.description}</p>
          )}

          <div className="mt-8">
            <HelpMdx source={article.body} />
          </div>

          <nav aria-label="More help articles" className="mt-12 grid gap-4 border-t pt-6 sm:grid-cols-2">
            {prev ? (
              <Link href={helpArticleUrl(prev.slug)} className="rounded-lg border p-4 hover:bg-muted">
                <span className="block text-xs text-muted-foreground">Previous</span>
                <span className="font-medium">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                href={helpArticleUrl(next.slug)}
                className="rounded-lg border p-4 text-right hover:bg-muted"
              >
                <span className="block text-xs text-muted-foreground">Next</span>
                <span className="font-medium">{next.title}</span>
              </Link>
            )}
          </nav>

          <p className="mt-8 text-sm text-muted-foreground">
            Still need help? <Link href="/contact" className="underline">Contact us</Link> and a
            real person will get back to you.
          </p>
        </article>
      </div>
    </main>
  )
}
