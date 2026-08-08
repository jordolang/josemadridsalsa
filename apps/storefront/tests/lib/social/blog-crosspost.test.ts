import { describe, expect, it } from 'vitest'
import {
  markdownToPlainText,
  blogPostToSocialText,
  buildTwitterText,
  blogPostUrl,
} from '@/lib/social/blog-crosspost'

describe('markdownToPlainText', () => {
  it('strips heading markers but keeps the text', () => {
    expect(markdownToPlainText('## The Y-Bridge Tasting')).toBe('The Y-Bridge Tasting')
  })

  it('strips bold, italic, and inline code markers', () => {
    expect(markdownToPlainText('This is **bold**, *italic*, and `code`.')).toBe(
      'This is bold, italic, and code.',
    )
  })

  it('converts unordered lists to bullets', () => {
    const md = '- Raspberry Chipotle\n- Black Bean & Corn'
    expect(markdownToPlainText(md)).toBe('• Raspberry Chipotle\n• Black Bean & Corn')
  })

  it('keeps ordered list numbers', () => {
    expect(markdownToPlainText('1. First\n2. Second')).toBe('1. First\n2. Second')
  })

  it('renders links as "text (url)"', () => {
    expect(markdownToPlainText('Try our [salsa](https://josemadrid.net/shop).')).toBe(
      'Try our salsa (https://josemadrid.net/shop).',
    )
  })

  it('drops inline images (the link card carries the cover image)', () => {
    expect(markdownToPlainText('Before ![a jar of salsa](https://cdn/x.jpg) after')).toBe(
      'Before  after',
    )
  })

  it('converts youtube/vimeo/video embeds to plain URLs', () => {
    expect(markdownToPlainText('[[youtube:abc123]]')).toBe('https://youtu.be/abc123')
    expect(markdownToPlainText('[[vimeo:987654]]')).toBe('https://vimeo.com/987654')
    expect(markdownToPlainText('[[video:https://cdn/clip.mp4]]')).toBe('https://cdn/clip.mp4')
  })

  it('strips blockquote markers', () => {
    expect(markdownToPlainText('> A wise word about heat.')).toBe('A wise word about heat.')
  })

  it('removes horizontal rules', () => {
    expect(markdownToPlainText('Above\n\n---\n\nBelow')).toBe('Above\n\nBelow')
  })

  it('preserves paragraph breaks and collapses extra blank lines', () => {
    const md = 'First paragraph.\n\n\n\nSecond paragraph.'
    expect(markdownToPlainText(md)).toBe('First paragraph.\n\nSecond paragraph.')
  })

  it('keeps fenced code content without the fences', () => {
    const md = '```js\nconst heat = 10\n```'
    expect(markdownToPlainText(md)).toBe('const heat = 10')
  })
})

describe('blogPostToSocialText', () => {
  it('leads with title and subtitle, then the body', () => {
    const out = blogPostToSocialText({
      title: 'The Y-Bridge Tasting',
      subtitle: 'A short one-liner',
      content: '## Heat\n\nThe salsa was **excellent**.',
    })
    expect(out).toBe('The Y-Bridge Tasting\n\nA short one-liner\n\nHeat\n\nThe salsa was excellent.')
  })

  it('omits the subtitle when absent', () => {
    const out = blogPostToSocialText({
      title: 'Title Only',
      subtitle: null,
      content: 'Body text here.',
    })
    expect(out).toBe('Title Only\n\nBody text here.')
  })
})

describe('buildTwitterText', () => {
  const url = 'https://www.josemadrid.net/heat-index/y-bridge'

  it('includes title, excerpt, and link when within the limit', () => {
    const out = buildTwitterText({ title: 'Y-Bridge', excerpt: 'A tasting note.' }, url)
    expect(out).toBe(`Y-Bridge — A tasting note. ${url}`)
  })

  it('never exceeds the character limit and always keeps the link', () => {
    const out = buildTwitterText(
      { title: 'A'.repeat(300), excerpt: 'B'.repeat(300) },
      url,
    )
    expect(out.length).toBeLessThanOrEqual(280)
    expect(out.endsWith(url)).toBe(true)
    expect(out).toContain('…')
  })
})

describe('blogPostUrl', () => {
  it('builds the canonical heat-index URL', () => {
    expect(blogPostUrl('y-bridge')).toBe(
      `${process.env.NEXTAUTH_URL ?? 'https://www.josemadrid.net'}/heat-index/y-bridge`,
    )
  })
})
