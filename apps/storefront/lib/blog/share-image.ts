/**
 * Fallback share image for an article that carries no image of its own.
 *
 * og:image must be set unconditionally: Next.js only falls back to a file-based
 * opengraph-image when the page's metadata has no `openGraph.images` key at all,
 * so leaving it off for image-less posts silently swaps in a different image.
 */
export const DEFAULT_SHARE_IMAGE =
  'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/opengraph/josemadridhome.png'

/** Markdown image, tolerating a <bracketed> href and a "title" after the URL. */
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'(][^)]*)?\s*\)/

/**
 * First image embedded in an article's Markdown body, if it has one.
 *
 * Fenced code blocks are removed first so a Markdown sample inside a code block
 * cannot supply the article's share image. `data:` URIs are ignored — Facebook
 * and Google fetch an og:image by URL and cannot read an inline one.
 */
export function firstContentImage(markdown: string): string | null {
  const prose = markdown.replace(/```[\s\S]*?```/g, '')
  const match = prose.match(MARKDOWN_IMAGE)
  const url = match?.[1]?.trim()
  if (!url || url.toLowerCase().startsWith('data:')) return null
  return url
}

/**
 * The image that represents an article when it is shared — the og:image, and so
 * the picture on the Facebook link card.
 *
 * Prefers the cover image, because that is the one the editor sets deliberately
 * for this purpose. An article can perfectly well be published without one
 * though: the cover field is optional and the writer may have put the picture in
 * the body instead. Falling straight to the site default there is what put the
 * homepage graphic on articles that plainly had a picture of their own, so the
 * gallery and then the body are searched before giving up on it.
 */
export function resolveShareImage(post: {
  coverImage?: string | null
  galleryImages?: string[]
  content?: string | null
}): string {
  const cover = post.coverImage?.trim()
  if (cover) return cover

  const gallery = post.galleryImages?.find((url) => url.trim())?.trim()
  if (gallery) return gallery

  return (post.content ? firstContentImage(post.content) : null) ?? DEFAULT_SHARE_IMAGE
}
