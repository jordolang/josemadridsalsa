import { z } from 'zod'
import { getHelpArticles, helpArticleUrl, type HelpArticle } from '@/lib/help/articles'
import { slugify } from '@/lib/help/slugify'

const MAX_RESULTS = 8
const SNIPPET_LENGTH = 160

export const helpQuerySchema = z.string().trim().min(1).max(100)

export interface HelpArticleResult {
  title: string
  url: string
  snippet?: string
}

interface Section {
  anchor: string | null
  heading: string | null
  text: string
}

/** MDX/markdown to searchable plain text. Keeps `title="…"` values, e.g. accordion questions. */
function toPlainText(mdx: string): string {
  return mdx
    .replace(/<[A-Z][\w.]*[^>]*?\btitle="([^"]*)"[^>]*>/g, ' $1 ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/[|>#]|^\s*[-:]{3,}\s*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split an article at its `##`/`###` headings so a hit can link straight to its section. */
export function toSections(body: string): Section[] {
  const sections: Section[] = []
  let current = { anchor: null as string | null, heading: null as string | null, lines: [] as string[] }
  const flush = () => sections.push({ anchor: current.anchor, heading: current.heading, text: toPlainText(current.lines.join('\n')) })

  for (const line of body.split('\n')) {
    const heading = /^\s*#{2,3}\s+(.+?)\s*$/.exec(line)
    if (heading) {
      flush()
      const text = toPlainText(heading[1])
      current = { anchor: slugify(text), heading: text, lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  flush()
  return sections.filter((section) => section.heading || section.text)
}

function snippetAround(text: string, term: string): string {
  const at = Math.max(0, text.toLowerCase().indexOf(term) - 40)
  const start = at === 0 ? 0 : text.indexOf(' ', at) + 1
  const slice = text.slice(start, start + SNIPPET_LENGTH)
  return `${start > 0 ? '…' : ''}${slice}${start + SNIPPET_LENGTH < text.length ? '…' : ''}`
}

/** Rank articles whose title or a single section contains every query word. */
export function searchArticles(articles: HelpArticle[], query: string): HelpArticleResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const scored: (HelpArticleResult & { score: number })[] = []

  for (const article of articles) {
    const title = `${article.title} ${article.description}`.toLowerCase()
    let best: { section: Section; score: number } | null = null

    for (const section of toSections(article.body)) {
      const heading = (section.heading ?? '').toLowerCase()
      const text = section.text.toLowerCase()
      if (!terms.every((t) => title.includes(t) || heading.includes(t) || text.includes(t))) continue
      const score = terms.reduce(
        (sum, t) => sum + (title.includes(t) ? 3 : 0) + (heading.includes(t) ? 2 : 0) + (text.includes(t) ? 1 : 0),
        0,
      )
      if (!best || score > best.score) best = { section, score }
    }

    if (!best) continue
    const { section } = best
    const firstHit = terms.find((t) => section.text.toLowerCase().includes(t))
    scored.push({
      title: article.title,
      url: `${helpArticleUrl(article.slug)}${section.anchor ? `#${section.anchor}` : ''}`,
      snippet: firstHit ? snippetAround(section.text, firstHit) : (section.heading ?? article.description),
      score: best.score,
    })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ score: _score, ...result }) => result)
}

/** Search the customer knowledge base in `content/help`. */
export async function searchHelpArticles(query: string): Promise<HelpArticleResult[]> {
  return searchArticles(await getHelpArticles(), query)
}
