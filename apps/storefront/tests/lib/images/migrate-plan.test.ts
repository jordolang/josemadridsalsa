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
    expect(rewriteText(input, map)).toEqual({ text: input, replacements: [] })
  })

  it('is idempotent — running it twice changes nothing the second time', () => {
    const once = rewriteText('<img src="/images/shared/salsa-bowl.png">', map)
    const twice = rewriteText(once.text, map)
    expect(twice.text).toBe(once.text)
    expect(twice.replacements).toEqual([])
  })
})

describe('summariseMigration', () => {
  it('separates converted from preserved files', () => {
    const entries: MigrationEntry[] = [
      { localRef: '/a.png', blobPathname: 'site/a.webp', converted: true, sizeBytes: 1000 },
      { localRef: '/og.png', blobPathname: 'site/og.png', converted: false, sizeBytes: 500 },
    ]
    expect(summariseMigration(entries)).toEqual({
      files: 2,
      converted: 1,
      kept: 1,
      bytes: 1500,
    })
  })
})
