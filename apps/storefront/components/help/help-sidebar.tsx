import Link from 'next/link'
import { cn } from '@/lib/utils'
import { helpArticleUrl, type HelpNavSection } from '@/lib/help/articles'

function NavList({ nav, current }: { nav: HelpNavSection[]; current: string }) {
  return (
    <div className="space-y-6 text-sm">
      <Link href="/help" className="block font-medium hover:underline">
        ← Help Center home
      </Link>
      {nav.map((section) => (
        <div key={section.title ?? 'top'}>
          {section.title && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.title}
            </p>
          )}
          <ul className="space-y-1">
            {section.articles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={helpArticleUrl(article.slug)}
                  aria-current={article.slug === current ? 'page' : undefined}
                  className={cn(
                    'block rounded-md px-2 py-1 hover:bg-muted',
                    article.slug === current && 'bg-muted font-medium text-foreground',
                  )}
                >
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Help topic list: a sticky sidebar on desktop, a collapsible menu on phones. */
export function HelpSidebar({ nav, current }: { nav: HelpNavSection[]; current: string }) {
  return (
    <>
      <details className="mb-8 rounded-lg border p-4 lg:hidden">
        <summary className="cursor-pointer font-medium">Help topics</summary>
        <div className="mt-4">
          <NavList nav={nav} current={current} />
        </div>
      </details>
      <nav aria-label="Help topics" className="sticky top-24 hidden self-start lg:block">
        <NavList nav={nav} current={current} />
      </nav>
    </>
  )
}
