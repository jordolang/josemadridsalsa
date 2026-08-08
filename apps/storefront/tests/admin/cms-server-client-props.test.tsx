import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

/**
 * Guards the server/client component boundary for the CMS admin screens.
 *
 * These pages are server components that render `<ResourceManager>`, which is
 * a client component. React cannot serialize a function across that boundary,
 * so a single callback prop (a column `render`, an `onSelect`, …) makes the
 * whole page throw at request time — "Functions cannot be passed directly to
 * Client Components".
 *
 * Neither `tsc` nor `next build` catches it; it only appears when the page is
 * actually requested. This test renders each page and walks the returned tree
 * for function-valued props, so the failure is caught in CI instead of by
 * someone opening the admin.
 */

vi.mock('@/lib/rbac', () => ({
  requirePermission: vi.fn(async () => ({ id: 'test-user', email: 'test@example.com' })),
}))

vi.mock('@/lib/cms/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/queries')>()),
  getFaqCategories: vi.fn(async () => [
    { id: 'c1', name: 'Shipping', slug: 'shipping', _count: { items: 2 } },
  ]),
}))

// The database is not what is under test; these pages only need to render.
vi.mock('@/lib/prisma', () => {
  const page = {
    id: 'p1',
    slug: 'home',
    title: 'Homepage',
    kind: 'SYSTEM',
    status: 'DRAFT',
    seoTitle: null,
    seoDescription: null,
    ogImage: null,
    canonicalUrl: null,
    noIndex: false,
    updatedAt: new Date('2026-01-01'),
    sections: [],
  }
  return {
    default: {
      page: {
        findMany: vi.fn(async () => [page]),
        findUnique: vi.fn(async () => page),
        create: vi.fn(async () => page),
        count: vi.fn(async () => 1),
      },
      banner: { count: vi.fn(async () => 0) },
      announcement: { count: vi.fn(async () => 0) },
      faqItem: { count: vi.fn(async () => 0) },
      reusableSection: { count: vi.fn(async () => 0) },
      redirect: { count: vi.fn(async () => 0) },
      media: { count: vi.fn(async () => 0) },
      blogPost: { count: vi.fn(async () => 0) },
    },
  }
})

/** Props React handles itself rather than serializing to the client. */
const REACT_INTERNAL_PROPS = new Set(['children', 'key', 'ref'])

interface FunctionProp {
  path: string
  prop: string
}

/**
 * Walk a rendered tree collecting any function-valued prop.
 *
 * Descends into plain objects and arrays as well as elements: the realistic
 * offender is a callback nested inside a config array (a column's `render`),
 * not a top-level prop, so stopping at element boundaries would miss the very
 * bug this exists to catch.
 */
function findFunctionProps(
  node: unknown,
  path = 'root',
  found: FunctionProp[] = [],
  seen = new WeakSet<object>()
) {
  if (typeof node === 'function') {
    found.push({ path, prop: '(value)' })
    return found
  }
  if (!node || typeof node !== 'object') return found
  if (seen.has(node)) return found
  seen.add(node)

  if (Array.isArray(node)) {
    node.forEach((child, i) => findFunctionProps(child, `${path}[${i}]`, found, seen))
    return found
  }

  const element = node as Partial<ReactElement> & { props?: Record<string, unknown> }

  // A React element: descend through its props.
  if (element.props && 'type' in element) {
    const name =
      typeof element.type === 'function'
        ? (element.type as { name?: string }).name || 'Component'
        : String(element.type)
    const here = `${path} > ${name}`
    for (const [prop, value] of Object.entries(element.props)) {
      if (REACT_INTERNAL_PROPS.has(prop) && prop !== 'children') continue
      if (typeof value === 'function') {
        found.push({ path: here, prop })
      } else {
        findFunctionProps(value, `${here}.${prop}`, found, seen)
      }
    }
    return found
  }

  // A plain object, e.g. one entry of a `columns` array.
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (typeof value === 'function') {
      found.push({ path, prop: key })
    } else {
      findFunctionProps(value, `${path}.${key}`, found, seen)
    }
  }
  return found
}

const PAGES = [
  ['announcements', () => import('@/app/admin/content/announcements/page'), undefined],
  ['banners', () => import('@/app/admin/content/banners/page'), undefined],
  ['redirects', () => import('@/app/admin/content/redirects/page'), undefined],
  ['faqs', () => import('@/app/admin/content/faqs/page'), undefined],
  ['faq categories', () => import('@/app/admin/content/faqs/categories/page'), undefined],
  ['reusable sections', () => import('@/app/admin/content/sections/page'), undefined],
  ['navigation', () => import('@/app/admin/content/navigation/page'), undefined],
  ['footer', () => import('@/app/admin/content/footer/page'), undefined],
  ['content hub', () => import('@/app/admin/content/page'), undefined],
  ['pages list', () => import('@/app/admin/content/pages/page'), undefined],
  [
    'page editor',
    () => import('@/app/admin/content/pages/[slug]/page'),
    // The editor ships the whole block registry to a client component; the
    // registry holds Zod schemas, which are function-bearing objects, so this
    // is the page most likely to leak one.
    { params: Promise.resolve({ slug: 'home' }) },
  ],
] as const

describe('CMS admin pages pass only serializable props to client components', () => {
  it.each(PAGES)('%s', async (_name, load, props) => {
    const mod = await load()
    const tree = await (mod.default as (p?: unknown) => Promise<ReactElement>)(props)

    const offenders = findFunctionProps(tree)

    expect(
      offenders,
      offenders.length
        ? `Function props cannot cross into a client component: ${offenders
            .map((o) => `${o.path} prop "${o.prop}"`)
            .join(', ')}`
        : ''
    ).toEqual([])
  })
})
