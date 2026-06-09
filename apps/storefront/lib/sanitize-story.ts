import sanitizeHtml from 'sanitize-html'

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'em', 'u', 's', 'i', 'b',
    'a', 'ul', 'ol', 'li', 'blockquote',
    'img', 'figure', 'figcaption',
    'hr', 'span', 'div',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    span: ['class'],
    div: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'nofollow noopener noreferrer',
      target: '_blank',
    }),
  },
}

export function sanitizeStoryHtml(html: string | null | undefined): string {
  if (!html) return ''
  return sanitizeHtml(html, OPTIONS)
}
