import { describe, it, expect } from 'vitest'

import { convertMarkdownToFumadocs, slugifyDocName } from '@/lib/developer/salsadocs'

describe('slugifyDocName', () => {
  it('strips the markdown extension and slugifies', () => {
    expect(slugifyDocName('GETTING_STARTED.md')).toBe('getting-started')
    expect(slugifyDocName('Turborepo Architecture.mdx')).toBe('turborepo-architecture')
  })

  it('collapses repeated separators and trims hyphens', () => {
    expect(slugifyDocName('--Weird   name!!.md')).toBe('weird-name')
  })
})

describe('convertMarkdownToFumadocs', () => {
  it('extracts the first H1 as the title and removes it from the body', () => {
    const result = convertMarkdownToFumadocs('# My Title\n\nFirst paragraph here.\n', {
      fallbackTitle: 'fallback',
    })
    expect(result.title).toBe('My Title')
    expect(result.mdx).toContain('title: "My Title"')
    expect(result.mdx).not.toContain('# My Title')
    expect(result.mdx).toContain('First paragraph here.')
  })

  it('uses the fallback title when no H1 exists', () => {
    const result = convertMarkdownToFumadocs('Just a paragraph.', {
      fallbackTitle: 'Environment Variables',
    })
    expect(result.title).toBe('Environment Variables')
  })

  it('derives the description from the first plain paragraph', () => {
    const markdown = '# Title\n\n> a quote\n\nThe **real** [description](https://x.dev) text.\n'
    const result = convertMarkdownToFumadocs(markdown, { fallbackTitle: 'f' })
    expect(result.description).toBe('The real description text.')
  })

  it('truncates long descriptions to roughly 160 characters', () => {
    const long = `word ${'lorem ipsum dolor sit amet '.repeat(20)}`
    const result = convertMarkdownToFumadocs(`# T\n\n${long}\n`, { fallbackTitle: 'f' })
    expect(result.description.length).toBeLessThanOrEqual(160)
    expect(result.description.endsWith('…')).toBe(true)
  })

  it('preserves fenced code blocks without escaping their contents', () => {
    const markdown = '# T\n\n```ts\nconst x = { a: 1 }\nif (x.a < 2) {}\n```\n'
    const result = convertMarkdownToFumadocs(markdown, { fallbackTitle: 'f' })
    expect(result.mdx).toContain('const x = { a: 1 }')
    expect(result.mdx).toContain('if (x.a < 2) {}')
    expect(result.mdx).not.toContain('\\{ a: 1 \\}')
  })

  it('preserves inline code spans verbatim', () => {
    const markdown = '# T\n\nSet `{ "key": "value" }` in the config.\n'
    const result = convertMarkdownToFumadocs(markdown, { fallbackTitle: 'f' })
    expect(result.mdx).toContain('`{ "key": "value" }`')
  })

  it('escapes braces and lone angle brackets outside code', () => {
    const markdown = '# T\n\nUse {placeholders} and sizes < 10 in prose.\n'
    const result = convertMarkdownToFumadocs(markdown, { fallbackTitle: 'f' })
    expect(result.mdx).toContain('\\{placeholders\\}')
    expect(result.mdx).toContain('sizes \\< 10')
  })

  it('leaves HTML-style tags unescaped', () => {
    const markdown = '# T\n\n<details><summary>More</summary>body</details>\n'
    const result = convertMarkdownToFumadocs(markdown, { fallbackTitle: 'f' })
    expect(result.mdx).toContain('<details><summary>More</summary>body</details>')
  })

  it('converts markdown autolinks to standard links', () => {
    const markdown = '# T\n\nSee <https://salsadocs.vercel.app> for docs.\n'
    const result = convertMarkdownToFumadocs(markdown, { fallbackTitle: 'f' })
    expect(result.mdx).toContain('[https://salsadocs.vercel.app](https://salsadocs.vercel.app)')
  })

  it('strips HTML comments', () => {
    const markdown = '# T\n\n<!-- internal note -->\n\nVisible text.\n'
    const result = convertMarkdownToFumadocs(markdown, { fallbackTitle: 'f' })
    expect(result.mdx).not.toContain('internal note')
    expect(result.mdx).toContain('Visible text.')
  })

  it('emits valid frontmatter with quoted strings', () => {
    const result = convertMarkdownToFumadocs('# A "quoted" title\n\nBody.\n', {
      fallbackTitle: 'f',
    })
    expect(result.mdx.startsWith('---\n')).toBe(true)
    expect(result.mdx).toContain('title: "A \\"quoted\\" title"')
    expect(result.mdx).toContain('description: "Body."')
  })
})
