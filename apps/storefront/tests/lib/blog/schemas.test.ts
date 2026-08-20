import { describe, it, expect } from 'vitest'
import { blogPostSchema, checkPostSeo } from '@/lib/blog/schemas'

const validPost = {
  title: 'Why Roasted Tomatillos Make Better Salsa Verde',
  slug: 'roasted-tomatillos-salsa-verde',
  excerpt: 'Roasting tomatillos before blending deepens the flavour of salsa verde. Here is the method we use in Zanesville.',
  content: 'x'.repeat(200),
  status: 'PUBLISHED' as const,
}

describe('blogPostSchema SEO fields', () => {
  it('accepts an SEO title within 30-60 characters', () => {
    const parsed = blogPostSchema.safeParse({
      ...validPost,
      seoTitle: 'Roasted Tomatillo Salsa Verde Recipe | Jose Madrid',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects an SEO title under 30 characters', () => {
    const parsed = blogPostSchema.safeParse({ ...validPost, seoTitle: 'Salsa Verde' })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0].message).toContain('at least 30 characters')
  })

  it('rejects an SEO title over 60 characters', () => {
    const parsed = blogPostSchema.safeParse({ ...validPost, seoTitle: 'x'.repeat(61) })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0].message).toContain('60 characters or fewer')
  })

  it('rejects an SEO description over 160 characters', () => {
    const parsed = blogPostSchema.safeParse({ ...validPost, seoDescription: 'x'.repeat(161) })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0].message).toContain('160 characters or fewer')
  })

  it('accepts an SEO description at exactly 160 characters', () => {
    const parsed = blogPostSchema.safeParse({ ...validPost, seoDescription: 'x'.repeat(160) })
    expect(parsed.success).toBe(true)
  })

  it('treats a blank override as unset rather than a length violation', () => {
    const parsed = blogPostSchema.safeParse({ ...validPost, seoTitle: '', seoDescription: '   ' })
    expect(parsed.success).toBe(true)
    expect(parsed.data?.seoTitle).toBeNull()
    expect(parsed.data?.seoDescription).toBeNull()
  })
})

describe('checkPostSeo', () => {
  it('passes a published post whose own title and excerpt are in range', () => {
    expect(checkPostSeo(validPost)).toBeNull()
  })

  it('flags a short post title when no SEO title overrides it', () => {
    const issue = checkPostSeo({ ...validPost, title: 'Salsa Verde Guide' })
    expect(issue).toContain('17 characters')
    expect(issue).toContain('Set an SEO title')
  })

  it('accepts a short post title once an SEO title overrides it', () => {
    expect(
      checkPostSeo({
        ...validPost,
        title: 'Salsa Verde Guide',
        seoTitle: 'Roasted Tomatillo Salsa Verde Recipe | Jose Madrid',
      })
    ).toBeNull()
  })

  it('flags an over-long excerpt when no SEO description overrides it', () => {
    const issue = checkPostSeo({ ...validPost, excerpt: 'x'.repeat(198) })
    expect(issue).toContain('198 characters')
    expect(issue).toContain('Set an SEO description')
  })

  it('accepts an over-long excerpt once an SEO description overrides it', () => {
    expect(
      checkPostSeo({
        ...validPost,
        excerpt: 'x'.repeat(198),
        seoDescription: 'Roasting tomatillos before blending deepens salsa verde. Here is our Zanesville method.',
      })
    ).toBeNull()
  })

  it('enforces the rules on scheduled posts', () => {
    expect(checkPostSeo({ ...validPost, status: 'SCHEDULED', title: 'Short' })).not.toBeNull()
  })

  it('exempts drafts and archived posts so work in progress can be saved', () => {
    expect(checkPostSeo({ ...validPost, status: 'DRAFT', title: 'Short', excerpt: 'x'.repeat(300) })).toBeNull()
    expect(checkPostSeo({ ...validPost, status: 'ARCHIVED', title: 'Short' })).toBeNull()
  })
})
