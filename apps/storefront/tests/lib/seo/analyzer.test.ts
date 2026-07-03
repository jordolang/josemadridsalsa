import { describe, it, expect } from 'vitest'
import { analyzePage } from '@/lib/seo/analyzer'

function checkById(analysis: ReturnType<typeof analyzePage>, id: string) {
  return analysis.checks.find((c) => c.id === id)
}

describe('analyzePage', () => {
  it('scores a well-optimized page at 100', () => {
    const analysis = analyzePage({
      title: 'Salsa Verde - Medium Heat Gourmet Salsa Jar', // 43 chars
      description:
        'Handcrafted salsa verde made with roasted tomatillos and green chiles. Order online for fast delivery from Jose Madrid Salsa.', // ~126 chars
      slug: 'salsa-verde',
      image: 'https://example.com/verde.jpg',
      keywords: ['salsa'],
      hasStructuredData: true,
    })

    expect(analysis.score).toBe(100)
    expect(analysis.recommendations).toHaveLength(0)
  })

  it('fails on missing title and description', () => {
    const analysis = analyzePage({ title: '', description: null })

    expect(checkById(analysis, 'title')?.status).toBe('fail')
    expect(checkById(analysis, 'description')?.status).toBe('fail')
    expect(analysis.score).toBe(0)
    expect(analysis.recommendations.length).toBeGreaterThan(0)
  })

  it('warns on short and overly long titles', () => {
    const short = analyzePage({ title: 'Salsa', description: 'x'.repeat(100) })
    expect(checkById(short, 'title')?.status).toBe('warn')

    const long = analyzePage({ title: 'x'.repeat(80), description: 'x'.repeat(100) })
    expect(checkById(long, 'title')?.status).toBe('warn')
  })

  it('warns on description outside the recommended range', () => {
    const short = analyzePage({ title: 'x'.repeat(40), description: 'too short' })
    expect(checkById(short, 'description')?.status).toBe('warn')

    const long = analyzePage({ title: 'x'.repeat(40), description: 'x'.repeat(200) })
    expect(checkById(long, 'description')?.status).toBe('warn')
  })

  it('flags malformed slugs', () => {
    const analysis = analyzePage({
      title: 'x'.repeat(40),
      description: 'x'.repeat(100),
      slug: 'Salsa_Verde 2',
    })
    expect(checkById(analysis, 'slug')?.status).toBe('warn')
  })

  it('accepts well-formed slugs', () => {
    const analysis = analyzePage({
      title: 'x'.repeat(40),
      description: 'x'.repeat(100),
      slug: 'salsa-verde-2',
    })
    expect(checkById(analysis, 'slug')?.status).toBe('pass')
  })

  it('skips optional checks when input is not provided', () => {
    const analysis = analyzePage({ title: 'x'.repeat(40), description: 'x'.repeat(100) })
    expect(checkById(analysis, 'slug')).toBeUndefined()
    expect(checkById(analysis, 'image')).toBeUndefined()
    expect(checkById(analysis, 'keywords')).toBeUndefined()
    expect(checkById(analysis, 'structured-data')).toBeUndefined()
  })

  it('warns when no keyword appears in title or description', () => {
    const analysis = analyzePage({
      title: 'x'.repeat(40),
      description: 'x'.repeat(100),
      keywords: ['salsa', 'gourmet'],
    })
    expect(checkById(analysis, 'keywords')?.status).toBe('warn')
  })

  it('warns on missing image and structured data', () => {
    const analysis = analyzePage({
      title: 'x'.repeat(40),
      description: 'x'.repeat(100),
      image: null,
      hasStructuredData: false,
    })
    expect(checkById(analysis, 'image')?.status).toBe('warn')
    expect(checkById(analysis, 'structured-data')?.status).toBe('warn')
  })
})
