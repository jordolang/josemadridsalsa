import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHARE_IMAGE,
  firstContentImage,
  resolveShareImage,
} from '@/lib/blog/share-image'

const COVER = 'https://cdn.example.com/cover.jpg'
const IN_BODY = 'https://cdn.example.com/booth.jpg'

describe('firstContentImage', () => {
  it('finds the first Markdown image in the body', () => {
    expect(firstContentImage(`Intro\n\n![The booth](${IN_BODY})\n\nMore`)).toBe(IN_BODY)
  })

  it('returns the first of several', () => {
    const body = `![one](${IN_BODY})\n\n![two](https://cdn.example.com/two.jpg)`
    expect(firstContentImage(body)).toBe(IN_BODY)
  })

  it('tolerates a bracketed href and a title', () => {
    expect(firstContentImage(`![alt](<${IN_BODY}> "The booth")`)).toBe(IN_BODY)
  })

  it('ignores an image inside a fenced code block', () => {
    const body = '```md\n![sample](https://cdn.example.com/sample.jpg)\n```\n\nNo picture here.'
    expect(firstContentImage(body)).toBeNull()
  })

  it('ignores a data URI, which a scraper cannot fetch', () => {
    expect(firstContentImage('![alt](data:image/png;base64,AAAA)')).toBeNull()
  })

  it('returns null for a body with no images', () => {
    expect(firstContentImage('Just prose, and a [link](https://example.com).')).toBeNull()
  })
})

describe('resolveShareImage', () => {
  it('prefers the cover image', () => {
    expect(
      resolveShareImage({ coverImage: COVER, galleryImages: ['g.jpg'], content: `![a](${IN_BODY})` }),
    ).toBe(COVER)
  })

  it('falls back to the gallery when there is no cover', () => {
    expect(
      resolveShareImage({ coverImage: null, galleryImages: [IN_BODY], content: '' }),
    ).toBe(IN_BODY)
  })

  it("uses the body's first image when there is no cover or gallery", () => {
    expect(
      resolveShareImage({ coverImage: null, galleryImages: [], content: `Hi\n\n![a](${IN_BODY})` }),
    ).toBe(IN_BODY)
  })

  it('treats a blank cover image as absent', () => {
    expect(
      resolveShareImage({ coverImage: '   ', galleryImages: [], content: `![a](${IN_BODY})` }),
    ).toBe(IN_BODY)
  })

  it('falls back to the site image only when the post has no picture at all', () => {
    expect(resolveShareImage({ coverImage: null, galleryImages: [], content: 'Prose only.' })).toBe(
      DEFAULT_SHARE_IMAGE,
    )
  })
})
