import { readFile } from 'fs/promises'
import { join } from 'path'
import { cache } from 'react'
import matter from 'gray-matter'

/**
 * Customer help articles, copied from salsadocs `content/help`. `meta.json` sets the
 * order, and `---Name---` entries in it start a sidebar section.
 */
const HELP_DIR = join(process.cwd(), 'content', 'help')

export interface HelpArticle {
  slug: string
  title: string
  description: string
  body: string
}

export interface HelpNavSection {
  title: string | null
  articles: Pick<HelpArticle, 'slug' | 'title'>[]
}

const SECTION = /^---(.+)---$/

const readPages = cache(async (): Promise<string[]> => {
  const meta = JSON.parse(await readFile(join(HELP_DIR, 'meta.json'), 'utf-8')) as { pages: string[] }
  return meta.pages
})

/** Every article in sidebar order, including the `index` landing article. */
export const getHelpArticles = cache(async (): Promise<HelpArticle[]> => {
  const slugs = (await readPages()).filter((page) => !SECTION.test(page))
  return Promise.all(
    slugs.map(async (slug) => {
      const { data, content } = matter(await readFile(join(HELP_DIR, `${slug}.mdx`), 'utf-8'))
      return {
        slug,
        title: String(data.title ?? slug),
        description: String(data.description ?? ''),
        body: content,
      }
    }),
  )
})

export async function getHelpArticle(slug: string): Promise<HelpArticle | undefined> {
  return (await getHelpArticles()).find((article) => article.slug === slug)
}

export function helpArticleUrl(slug: string): string {
  return slug === 'index' ? '/help' : `/help/${slug}`
}

/** Sidebar sections; the `index` article is the hub itself, so it is left out. */
export async function getHelpNav(): Promise<HelpNavSection[]> {
  const [pages, articles] = await Promise.all([readPages(), getHelpArticles()])
  const sections: HelpNavSection[] = [{ title: null, articles: [] }]
  for (const page of pages) {
    const heading = SECTION.exec(page)
    if (heading) {
      sections.push({ title: heading[1], articles: [] })
      continue
    }
    const article = articles.find((a) => a.slug === page)
    if (article && article.slug !== 'index') {
      sections[sections.length - 1].articles.push({ slug: article.slug, title: article.title })
    }
  }
  return sections.filter((section) => section.articles.length > 0)
}
