import sanitizeHtml from 'sanitize-html'

/**
 * Sanitiser for CMS rich-text fields.
 *
 * Mirrors the allowlist in `lib/sanitize-story.ts`, but only forces
 * `target="_blank"` on links that leave the site — page body copy routinely
 * links to other storefront pages, and those should navigate in place.
 *
 * Content is authored by staff holding `content:write`, but it is still
 * sanitised before rendering: an account compromise must not become stored
 * XSS on every public page.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'em', 'u', 's', 'i', 'b',
    'a', 'ul', 'ol', 'li', 'blockquote',
    'img', 'figure', 'figcaption',
    'hr', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    span: ['class'],
    div: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? ''
      const isInternal = href.startsWith('/') || href.startsWith('#')
      return {
        tagName,
        attribs: isInternal
          ? attribs
          : { ...attribs, rel: 'nofollow noopener noreferrer', target: '_blank' },
      }
    },
  },
}

export function sanitizeCmsHtml(html: string | null | undefined): string {
  if (!html) return ''
  return sanitizeHtml(html, OPTIONS)
}
