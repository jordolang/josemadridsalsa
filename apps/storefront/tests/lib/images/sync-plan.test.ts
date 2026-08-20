import { describe, it, expect } from 'vitest'
import {
  blobPathnameFor,
  buildPlan,
  decideLink,
  decideUpload,
  filenameToSlug,
  isImageFile,
  matchProduct,
  nameToSlug,
  outputFileName,
  shouldConvertToWebp,
  summarisePlan,
  type ManifestEntry,
  type ProductRef,
  type SourceFile,
} from '@/lib/images/sync-plan'

const STORE = 'https://abc123.public.blob.vercel-storage.com'

function product(overrides: Partial<ProductRef> = {}): ProductRef {
  return {
    id: 'p1',
    name: 'Mango Habanero',
    slug: 'mango-habanero',
    sku: 'JMS-MH-16',
    featuredImage: null,
    images: [],
    ...overrides,
  }
}

function file(overrides: Partial<SourceFile> = {}): SourceFile {
  return {
    sourcePath: '/Users/x/Desktop/jms-images/mango-habanero.png',
    fileName: 'mango-habanero.png',
    sizeBytes: 3_600_000,
    sha256: 'a'.repeat(64),
    ...overrides,
  }
}

describe('isImageFile', () => {
  it.each(['a.png', 'a.PNG', 'b.jpg', 'c.jpeg', 'd.webp', 'e.avif'])('accepts %s', (name) => {
    expect(isImageFile(name)).toBe(true)
  })

  it('rejects non-images and dotfiles', () => {
    // .DS_Store is the file that would otherwise get uploaded from every macOS folder.
    expect(isImageFile('.DS_Store')).toBe(false)
    expect(isImageFile('notes.txt')).toBe(false)
    expect(isImageFile('.hidden.png')).toBe(false)
  })
})

describe('shouldConvertToWebp', () => {
  it('converts ordinary photos by default', () => {
    expect(shouldConvertToWebp('salsa.png', 'products', true)).toBe(true)
    expect(shouldConvertToWebp('shot.JPG', 'marketing', true)).toBe(true)
  })

  it('leaves already-optimised formats alone', () => {
    expect(shouldConvertToWebp('a.webp', 'products', true)).toBe(false)
    expect(shouldConvertToWebp('a.avif', 'products', true)).toBe(false)
  })

  it('never converts a GIF, which would drop the animation', () => {
    expect(shouldConvertToWebp('spinner.gif', 'products', true)).toBe(false)
  })

  it('never converts Open Graph images', () => {
    // Several social crawlers render a WebP OG image as a blank card.
    expect(shouldConvertToWebp('home.png', 'opengraph', true)).toBe(false)
    expect(shouldConvertToWebp('home.png', 'shared/og', true)).toBe(false)
    expect(shouldConvertToWebp('icon.png', 'favicon', true)).toBe(false)
  })

  it('respects conversion being switched off entirely', () => {
    expect(shouldConvertToWebp('salsa.png', 'products', false)).toBe(false)
  })
})

describe('outputFileName', () => {
  it('swaps the extension when converting', () => {
    expect(outputFileName('mango-habanero.png', true)).toBe('mango-habanero.webp')
    expect(outputFileName('shot.JPEG', true)).toBe('shot.webp')
  })

  it('leaves the name untouched when not converting', () => {
    expect(outputFileName('home.png', false)).toBe('home.png')
  })
})

describe('filenameToSlug', () => {
  it('normalises the shapes a real folder contains', () => {
    expect(filenameToSlug('mango-habanero.png')).toBe('mango-habanero')
    expect(filenameToSlug('Mango Habanero.PNG')).toBe('mango-habanero')
    expect(filenameToSlug('Mango_Habanero.jpg')).toBe('mango-habanero')
  })

  it('strips the "(2)" the OS appends to a second copy', () => {
    // Without this, the single most common real filename silently fails to match its product.
    expect(filenameToSlug('mango-habanero (2).png')).toBe('mango-habanero')
    expect(filenameToSlug('Mango Habanero (10).png')).toBe('mango-habanero')
  })

  it('keeps a meaningful trailing number', () => {
    expect(filenameToSlug('verde-2.png')).toBe('verde-2')
  })

  it('returns empty for a name with nothing usable', () => {
    expect(filenameToSlug('---.png')).toBe('')
  })
})

describe('nameToSlug', () => {
  it('matches the filename normalisation so the two meet', () => {
    expect(nameToSlug('Mango Habanero')).toBe('mango-habanero')
    expect(nameToSlug("Jose's X-Hot")).toBe('jose-s-x-hot')
  })
})

describe('matchProduct', () => {
  const products = [
    product(),
    product({ id: 'p2', name: 'Black Bean Corn Poblano', slug: 'black-bean-corn', sku: 'JMS-BB-16' }),
  ]

  it('matches on slug first', () => {
    expect(matchProduct('mango-habanero.png', products)).toMatchObject({
      matchedOn: 'slug',
      product: { id: 'p1' },
    })
  })

  it('matches on SKU when the slug does not hit', () => {
    expect(matchProduct('JMS-BB-16.png', products)).toMatchObject({
      matchedOn: 'sku',
      product: { id: 'p2' },
    })
  })

  it('matches on product name as a last resort', () => {
    expect(matchProduct('Black Bean Corn Poblano.png', products)).toMatchObject({
      matchedOn: 'name',
      product: { id: 'p2' },
    })
  })

  it('refuses an ambiguous name match rather than guessing', () => {
    // Attaching a photo to the wrong product is worse than not attaching it.
    const dupes = [
      product({ id: 'a', name: 'Verde', slug: 'verde-a', sku: 'A' }),
      product({ id: 'b', name: 'Verde', slug: 'verde-b', sku: 'B' }),
    ]
    expect(matchProduct('verde.png', dupes)).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(matchProduct('random-photo.png', products)).toBeNull()
  })
})

describe('blobPathnameFor', () => {
  it('joins prefix and filename, tolerating stray slashes', () => {
    expect(blobPathnameFor('a.png', 'products')).toBe('products/a.png')
    expect(blobPathnameFor('a.png', '/products/')).toBe('products/a.png')
    expect(blobPathnameFor('a.png', '')).toBe('a.png')
  })
})

describe('decideUpload', () => {
  const entry = (sha: string): ManifestEntry => ({
    sha256: sha,
    url: `${STORE}/products/mango-habanero.png`,
    sizeBytes: 1,
    uploadedAt: '2026-08-20T00:00:00.000Z',
  })

  it('uploads a file the store has never seen', () => {
    expect(decideUpload(file(), undefined)).toBe('UPLOAD')
  })

  it('skips an unchanged file, so re-running the sync is free', () => {
    expect(decideUpload(file(), entry('a'.repeat(64)))).toBe('SKIP_UNCHANGED')
  })

  it('replaces when the content changed but the name did not', () => {
    // The URL stays stable, so every listing pointing at it updates at once.
    expect(decideUpload(file(), entry('b'.repeat(64)))).toBe('REPLACE')
  })
})

describe('decideLink', () => {
  const url = `${STORE}/products/mango-habanero.png`
  const match = { product: product(), matchedOn: 'slug' as const }

  it('does nothing when linking was not requested', () => {
    expect(decideLink(match, url, { link: false, featured: false })).toBe('NONE')
  })

  it('does nothing when no product matched', () => {
    expect(decideLink(null, url, { link: true, featured: true })).toBe('NONE')
  })

  it('appends by default', () => {
    expect(decideLink(match, url, { link: true, featured: false })).toBe('APPEND')
  })

  it('sets featured only when asked', () => {
    expect(decideLink(match, url, { link: true, featured: true })).toBe('FEATURED')
  })

  it('is idempotent — re-linking the same URL changes nothing', () => {
    const withImage = { product: product({ images: [url] }), matchedOn: 'slug' as const }
    expect(decideLink(withImage, url, { link: true, featured: false })).toBe('ALREADY_LINKED')

    const withFeatured = { product: product({ featuredImage: url }), matchedOn: 'slug' as const }
    expect(decideLink(withFeatured, url, { link: true, featured: true })).toBe('ALREADY_LINKED')
  })
})

describe('buildPlan', () => {
  const products = [product()]

  it('predicts the URL of a not-yet-uploaded file so the plan shows the real outcome', () => {
    const plan = buildPlan({
      files: [file()],
      manifest: {},
      products,
      prefix: 'products',
      link: true,
      featured: false,
      storeBaseUrl: STORE,
    })

    expect(plan[0].blobPathname).toBe('products/mango-habanero.png')
    expect(plan[0].decision).toBe('UPLOAD')
    expect(plan[0].linkAction).toBe('APPEND')
    expect(plan[0].match?.product.id).toBe('p1')
  })

  it('reports an unmatched file as a problem but still uploads it', () => {
    const plan = buildPlan({
      files: [file({ fileName: 'a-photo-of-a-truck.png' })],
      manifest: {},
      products,
      prefix: 'products',
      link: true,
      featured: false,
      storeBaseUrl: STORE,
    })

    expect(plan[0].decision).toBe('UPLOAD')
    expect(plan[0].linkAction).toBe('NONE')
    expect(plan[0].problem).toMatch(/No product matches/)
  })

  it('orders the plan by filename so two runs read the same', () => {
    const plan = buildPlan({
      files: [file({ fileName: 'z.png' }), file({ fileName: 'a.png' })],
      manifest: {},
      products,
      prefix: '',
      link: false,
      featured: false,
      storeBaseUrl: STORE,
    })

    expect(plan.map((p) => p.source.fileName)).toEqual(['a.png', 'z.png'])
  })

  it('uses the stored URL for a file already in the manifest', () => {
    const existingUrl = `${STORE}/products/mango-habanero.png`
    const plan = buildPlan({
      files: [file()],
      manifest: {
        'products/mango-habanero.png': {
          sha256: 'a'.repeat(64),
          url: existingUrl,
          sizeBytes: 1,
          uploadedAt: '2026-08-20T00:00:00.000Z',
        },
      },
      products,
      prefix: 'products',
      link: true,
      featured: false,
      storeBaseUrl: null,
    })

    expect(plan[0].decision).toBe('SKIP_UNCHANGED')
    expect(plan[0].existingUrl).toBe(existingUrl)
    expect(plan[0].linkAction).toBe('APPEND')
  })
})

describe('summarisePlan', () => {
  it('counts each outcome for the final report', () => {
    const plan = buildPlan({
      files: [
        file({ fileName: 'mango-habanero.png' }),
        file({ fileName: 'unmatched.png', sha256: 'c'.repeat(64) }),
      ],
      manifest: {},
      products: [product()],
      prefix: 'products',
      link: true,
      featured: false,
      storeBaseUrl: STORE,
    })

    expect(summarisePlan(plan)).toEqual({
      upload: 2,
      replace: 0,
      unchanged: 0,
      linked: 1,
      unmatched: 1,
    })
  })
})
