import { loader, map } from 'fumadocs-core/source'
import type { PageData } from 'fumadocs-core/source'
import { docs as docsCollection } from '../../.source/server'

export type DocVisibility = 'public' | 'developer'

const rawSource = docsCollection.toFumadocsSource()

function normalizeSegments(entry: { slugs?: string[]; path: string }) {
  if (entry.slugs && entry.slugs.length > 0) {
    return entry.slugs
  }

  const withoutPrefix = entry.path.replace(/^docs\//, '')
  const clean = withoutPrefix.replace(/\.(mdx|md)$/i, '')
  return clean.split('/').filter(Boolean)
}

function humanizeTitle(value: string) {
  const cleaned = value
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const enrichedSource = map(rawSource).page((entry) => {
  const segments = normalizeSegments(entry)
  const slug = segments.length > 0 ? segments.join('/') : 'index'
  const fallbackTitle = entry.data.title ?? humanizeTitle(segments.at(-1) ?? 'Documentation')
  const visibility = (entry.data.visibility as DocVisibility | undefined) ?? 'public'

  return {
    ...entry,
    slugs: segments,
    data: {
      ...entry.data,
      title: fallbackTitle,
      visibility,
      slug,
      filePath: entry.path,
    } satisfies PageData & {
      visibility: DocVisibility
      slug: string
      filePath: string
    },
  }
})

export const docSource = loader({
  source: enrichedSource,
  baseUrl: '/docs',
  icon: () => null,
})

export type DocSource = typeof docSource
export type DocPage = ReturnType<DocSource['getPage']>
export type DocPages = ReturnType<DocSource['getPages']>

export function docSlugFromParams(slug?: string[]) {
  return slug && slug.length > 0 ? slug.join('/') : 'index'
}

export function docTree() {
  return docSource.pageTree()
}
