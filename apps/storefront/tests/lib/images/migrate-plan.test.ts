import { describe, it, expect } from 'vitest'
import {
  SITE_PREFIX,
  buildRewriteMap,
  planFile,
  rewriteText,
  summariseMigration,
  type MigrationEntry,
} from '@/lib/images/migrate-plan'

const STORE = 'https://abc123.public.blob.vercel-storage.com'
const SITE = 'https://www.josemadrid.net'

describe('planFile', () => {
  it('preserves the directory structure so a URL stays traceable', () => {
    const entry = planFile({ relativePath: 'images/shared/salsa-bowl.png', sizeBytes: 337_000 }, true)
    expect(entry.localRef).toBe('/images/shared/salsa-bowl.png')
    expect(entry.blobPathname).toBe(`${SITE_PREFIX}/images/shared/salsa-bowl.webp`)
    expect(entry.converted).toBe(true)
  })

  it('keeps Open Graph images in their original format', () => {
    // A WebP OG image renders as a blank card on several social crawlers.
    const entry = planFile(
      { relativePath: 'images/opengraph/josemadridhome.png', sizeBytes: 500_000 },
      true
    )
    expect(entry.blobPathname).toBe(`${SITE_PREFIX}/images/opengraph/josemadridhome.png`)
    expect(entry.converted).toBe(false)
  })

  it('leaves an animated GIF alone', () => {
    const entry = planFile({ relativePath: 'images/shared/spinner.gif', sizeBytes: 10 }, true)
    expect(entry.converted).toBe(false)
    expect(entry.blobPathname).toBe(`${SITE_PREFIX}/images/shared/spinner.gif`)
  })

  it('respects conversion being disabled', () => {
    const entry = planFile({ relativePath: 'images/a.png', sizeBytes: 10 }, false)
    expect(entry.converted).toBe(false)
    expect(entry.blobPathname).toBe(`${SITE_PREFIX}/images/a.png`)
  })
})

describe('buildRewriteMap', () => {
  const entries: MigrationEntry[] = [
    {
      localRef: '/images/shared/salsa-bowl.png',
      blobPathname: 'site/images/shared/salsa-bowl.webp',
      converted: true,
      sizeBytes: 1,
    },
  ]

  it('maps both the root-relative and absolute forms to the same URL', () => {
    // Metadata and email templates use absolute URLs; components use root-relative ones.
    const map = buildRewriteMap(entries, STORE, [SITE])
    const expected = `${STORE}/site/images/shared/salsa-bowl.webp`

    expect(map.get('/images/shared/salsa-bowl.png')).toBe(expected)
    expect(map.get(`${SITE}/images/shared/salsa-bowl.png`)).toBe(expected)
  })

  it('tolerates a trailing slash on either base', () => {
    const map = buildRewriteMap(entries, `${STORE}/`, [`${SITE}/`])
    expect(map.get(`${SITE}/images/shared/salsa-bowl.png`)).toBe(
      `${STORE}/site/images/shared/salsa-bowl.webp`
    )
  })
})

describe('rewriteText', () => {
  const map = buildRewriteMap(
    [
      {
        localRef: '/images/shared/salsa-bowl.png',
        blobPathname: 'site/images/shared/salsa-bowl.webp',
        converted: true,
        sizeBytes: 1,
      },
    ],
    STORE,
    [SITE]
  )
  const blobUrl = `${STORE}/site/images/shared/salsa-bowl.webp`

  it('rewrites a JSX src attribute', () => {
    const { text } = rewriteText('<Image src="/images/shared/salsa-bowl.png" alt="x" />', map)
    expect(text).toBe(`<Image src="${blobUrl}" alt="x" />`)
  })

  it('rewrites the absolute form without mangling it', () => {
    // The short key is a substring of the long one; replacing it first would produce
    // "https://www.josemadrid.net" + blobUrl, a broken hybrid URL.
    const { text } = rewriteText(`url: '${SITE}/images/shared/salsa-bowl.png',`, map)
    expect(text).toBe(`url: '${blobUrl}',`)
    expect(text).not.toContain(SITE)
  })

  it('handles both forms in one file', () => {
    const input = `a="${SITE}/images/shared/salsa-bowl.png" b="/images/shared/salsa-bowl.png"`
    const { text } = rewriteText(input, map)
    expect(text).toBe(`a="${blobUrl}" b="${blobUrl}"`)
  })

  it('does not match a longer path that merely starts the same', () => {
    const input = '"/images/shared/salsa-bowl.png.bak"'
    const { text } = rewriteText(input, map)
    expect(text).toBe(input)
  })

  it('does not match a different file in the same directory', () => {
    const input = '"/images/shared/salsa-bowl-2.png"'
    const { text } = rewriteText(input, map)
    expect(text).toBe(input)
  })

  it('reports what it changed, with counts', () => {
    const input = `"/images/shared/salsa-bowl.png" and "/images/shared/salsa-bowl.png"`
    const { replacements } = rewriteText(input, map)
    expect(replacements).toEqual([
      { from: '/images/shared/salsa-bowl.png', to: blobUrl, count: 2 },
    ])
  })

  it('leaves text with no references untouched', () => {
    const input = 'const x = 1'
    expect(rewriteText(input, map)).toEqual({ text: input, replacements: [], needsReview: [] })
  })

  it('is idempotent — running it twice changes nothing the second time', () => {
    const once = rewriteText('<img src="/images/shared/salsa-bowl.png">', map)
    const twice = rewriteText(once.text, map)
    expect(twice.text).toBe(once.text)
    expect(twice.replacements).toEqual([])
  })
})

describe('preserving the original alongside the conversion', () => {
  it('records where the untouched original lands as well as the WebP', () => {
    const entry = planFile({ relativePath: 'images/shared/salsa-bowl.png', sizeBytes: 337_000 }, true)
    expect(entry.blobPathname).toBe(`${SITE_PREFIX}/images/shared/salsa-bowl.webp`)
    expect(entry.originalBlobPathname).toBe(`${SITE_PREFIX}/images/shared/salsa-bowl.png`)
  })

  it('points both pathnames at the same file when nothing is converted', () => {
    const entry = planFile({ relativePath: 'images/opengraph/home.png', sizeBytes: 500 }, true)
    expect(entry.originalBlobPathname).toBe(entry.blobPathname)
  })

  it('resolves references to the original when asked for that variant', () => {
    const entries = [planFile({ relativePath: 'images/shared/salsa-bowl.png', sizeBytes: 1 }, true)]
    const converted = buildRewriteMap(entries, STORE, [SITE])
    const original = buildRewriteMap(entries, STORE, [SITE], 'original')
    expect(converted.get('/images/shared/salsa-bowl.png')).toBe(
      `${STORE}/${SITE_PREFIX}/images/shared/salsa-bowl.webp`,
    )
    expect(original.get('/images/shared/salsa-bowl.png')).toBe(
      `${STORE}/${SITE_PREFIX}/images/shared/salsa-bowl.png`,
    )
  })

  it('does not re-prefix an already-migrated URL whose key it still contains', () => {
    // The regression that produced `.../sitehttps://.../site/images/...` in production: an
    // unconverted entry maps onto a URL ending in its own key, so an unguarded second pass
    // matched inside its own output.
    const entries = [planFile({ relativePath: 'images/opengraph/home.png', sizeBytes: 1 }, true)]
    const map = buildRewriteMap(entries, STORE, [SITE])
    const once = rewriteText(`<meta content="/images/opengraph/home.png">`, map)
    expect(once.text).toContain(`${STORE}/${SITE_PREFIX}/images/opengraph/home.png`)

    const twice = rewriteText(once.text, map)
    expect(twice.text).toBe(once.text)
    expect(twice.replacements).toEqual([])
    expect(twice.text).not.toContain('sitehttps://')
  })

  it('reports a templated reference for review instead of stranding the variable', () => {
    const entries = [planFile({ relativePath: 'images/shared/logo.png', sizeBytes: 1 }, true)]
    const map = buildRewriteMap(entries, STORE, [SITE])
    const result = rewriteText('url: `${SITE_URL}/images/shared/logo.png`', map)
    expect(result.text).toBe('url: `${SITE_URL}/images/shared/logo.png`')
    expect(result.needsReview).toEqual([{ ref: '/images/shared/logo.png', count: 1 }])
  })
})

describe('summariseMigration', () => {
  it('separates converted from preserved files', () => {
    const entries: MigrationEntry[] = [
      {
        localRef: '/a.png',
        blobPathname: 'site/a.webp',
        originalBlobPathname: 'site/a.png',
        converted: true,
        sizeBytes: 1000,
      },
      {
        localRef: '/og.png',
        blobPathname: 'site/og.png',
        originalBlobPathname: 'site/og.png',
        converted: false,
        sizeBytes: 500,
      },
    ]
    expect(summariseMigration(entries)).toEqual({
      files: 2,
      converted: 1,
      kept: 1,
      bytes: 1500,
    })
  })
})
