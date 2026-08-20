import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * End-to-end check of the contract between the page editor and the public
 * storefront.
 *
 * The editor stores a system page's sections under their *registry key*
 * (`hero`), while a landing page stores them under their *block type*. The
 * storefront looks system sections up by registry key. If those two ever
 * disagree, saving appears to succeed and the site silently keeps showing its
 * built-in copy — which no type check would catch.
 *
 * Runs against the dev database; permissions and audit logging are stubbed
 * because they are not what is under test here. Skipped when no DATABASE_URL
 * is present.
 */

vi.mock('@/lib/rbac', () => ({
  requirePermission: vi.fn(async () => ({ id: 'test-user', email: 'test@example.com' })),
}))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => undefined) }))

const { PATCH } = await import('@/app/api/admin/cms/pages/[id]/route')
const { getPageContent } = await import('@/lib/cms/queries')
const prisma = (await import('@/lib/prisma')).default

// Must be a slug present in SYSTEM_PAGES: the registry is what maps a section
// key ('hero') to its block ('homeHero'), and therefore what shape its stored
// data is validated against. An unregistered slug would silently strip the
// homeHero fields — which is exactly the failure this test exists to catch.
const SLUG = 'home'
let pageId: string

// This file deletes and recreates the 'home' page, so it needs a database it
// owns. DATABASE_URL cannot signal that: @prisma/client loads .env itself, so
// it is set on every developer machine and would aim those deletes at shared
// dev. CI opts in explicitly; without the flag the file skips rather than
// failing on an unreachable datasource.
const runIntegration = !!process.env.RUN_INTEGRATION_TESTS

function patchRequest(body: unknown) {
  return new NextRequest(`https://store.example.com/api/admin/cms/pages/${pageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe.skipIf(!runIntegration)('saving a page through the editor', () => {
  beforeAll(async () => {
    await prisma.page.deleteMany({ where: { slug: SLUG } })
    const page = await prisma.page.create({
      data: { slug: SLUG, title: 'Homepage', kind: 'SYSTEM', status: 'DRAFT' },
    })
    pageId = page.id
  })

  afterAll(async () => {
    await prisma.page.deleteMany({ where: { slug: SLUG } })
  })

  it('stores system sections under their registry key and publishes them', async () => {
    // Exactly the payload components/admin/cms/page-editor.tsx sends.
    const response = await PATCH(
      patchRequest({
        title: 'Homepage',
        status: 'PUBLISHED',
        publishedAt: new Date().toISOString(),
        seoTitle: 'Saved title',
        noIndex: false,
        sections: [
          {
            type: 'hero',
            sortOrder: 0,
            isVisible: true,
            data: { panel1Title: 'Saved headline', panel1Body: 'Saved body' },
          },
          {
            type: 'featuredProducts',
            sortOrder: 1,
            isVisible: false,
            data: { heading: 'Picks', limit: 6 },
          },
        ],
      }),
      { params: Promise.resolve({ id: pageId }) }
    )

    expect(response.status).toBe(200)

    const stored = await prisma.pageSection.findMany({
      where: { pageId },
      orderBy: { sortOrder: 'asc' },
    })
    expect(stored.map((s) => s.type)).toEqual(['hero', 'featuredProducts'])
    expect(stored[1].isVisible).toBe(false)
  })

  it('is read back by the storefront under the same keys', async () => {
    const content = await getPageContent(SLUG)

    expect(content.isPublished).toBe(true)
    expect(content.text('hero', 'panel1Title', 'FALLBACK')).toBe('Saved headline')
    expect(content.number('featuredProducts', 'limit', 4)).toBe(6)
    // A hidden section must report as hidden so the page can skip it.
    expect(content.isVisible('featuredProducts')).toBe(false)
    expect(content.isVisible('hero')).toBe(true)
  })

  it('falls back for sections that were never saved', async () => {
    const content = await getPageContent(SLUG)

    expect(content.text('whatSetsUsApart', 'heading', 'ORIGINAL COPY')).toBe('ORIGINAL COPY')
    // An unsaved section is shown, not hidden.
    expect(content.isVisible('whatSetsUsApart')).toBe(true)
  })

  it('replaces the section list wholesale rather than appending', async () => {
    await PATCH(
      patchRequest({
        sections: [
          { type: 'hero', sortOrder: 0, isVisible: true, data: { panel1Title: 'Second save' } },
        ],
      }),
      { params: Promise.resolve({ id: pageId }) }
    )

    const stored = await prisma.pageSection.findMany({ where: { pageId } })
    expect(stored).toHaveLength(1)
    expect(stored[0].type).toBe('hero')
  })

  it('rejects a slug that is not URL-safe', async () => {
    const response = await PATCH(patchRequest({ slug: 'Not A Slug' }), {
      params: Promise.resolve({ id: pageId }),
    })

    expect(response.status).toBe(422)
  })
})
