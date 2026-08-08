import type { SocialMediaPlatform } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { publishToAccount } from './publisher'

/**
 * Validates the optional list of social account ids a blog save asks to
 * cross-post to. Kept lenient (ids only) because eligibility and existence are
 * re-checked against the database in crosspostBlogPost.
 */
export const crosspostAccountIdsSchema = z.array(z.string().min(1)).default([])

// Normalize like getSocialBaseUrl: a trailing slash or pasted whitespace in
// NEXTAUTH_URL would otherwise yield "https://host//heat-index/slug". The
// fallback is applied AFTER normalization so a blank/whitespace value still
// resolves to an absolute site URL rather than an empty (relative) one.
const SITE_URL =
  process.env.NEXTAUTH_URL?.trim().replace(/\/+$/, '') || 'https://www.josemadrid.net'

/**
 * Platforms a blog article can be cross-posted to. A cross-post is text + a link
 * back to the article, so only networks that accept a text/link post without an
 * uploaded photo/video are eligible. Instagram and TikTok are excluded because
 * their publish APIs require media.
 */
export const CROSSPOST_PLATFORMS: SocialMediaPlatform[] = [
  'FACEBOOK',
  'TWITTER',
  'GOOGLE_MY_BUSINESS',
]

/**
 * Per-platform maximum body length. A message longer than the network accepts is
 * rejected outright, so the article text is truncated to fit before publishing.
 * Facebook allows ~63k; a Google Business local post summary caps at 1,500.
 * Twitter is handled separately by buildTwitterText.
 */
const PLATFORM_MAX_CHARS: Record<SocialMediaPlatform, number> = {
  FACEBOOK: 63206,
  TWITTER: 280,
  INSTAGRAM: 2200,
  TIKTOK: 2200,
  GOOGLE_MY_BUSINESS: 1500,
}

/**
 * Truncate to a hard character budget at a word boundary, adding an ellipsis.
 */
export function truncateText(text: string, max: number): string {
  if (max <= 0) return ''
  if (text.length <= max) return text
  if (max === 1) return '…'
  const slice = text.slice(0, max - 1)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice
  return cut.replace(/\s+$/, '') + '…'
}

/**
 * The hashtag block publishToAccount appends to every post's body. Its length
 * has to be reserved from each platform's budget so the final message (body +
 * hashtags) still fits.
 */
function hashtagSuffix(tags: string[]): string {
  if (tags.length === 0) return ''
  return '\n\n' + tags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
}

/**
 * Keep only as many tags as fit within a bounded suffix. publishToAccount
 * appends the same hashtag block to every platform, and on Twitter the link
 * plus an unbounded hashtag block could blow the 280-char limit no matter how
 * far the body is trimmed. Capping the suffix keeps every platform's budget
 * solvable while preserving the most important (leading) tags.
 */
export function boundedHashtags(tags: string[], maxSuffixChars = 100): string[] {
  const out: string[] = []
  for (const tag of tags) {
    if (hashtagSuffix([...out, tag]).length > maxSuffixChars) break
    out.push(tag)
  }
  return out
}

export function blogPostUrl(slug: string): string {
  return `${SITE_URL}/heat-index/${slug}`
}

/**
 * Convert the post's Markdown body into readable plain text for a social feed.
 *
 * A feed post can't render the article's HTML (headings, bold, inline images
 * interleaved with prose), so we produce the closest faithful plain-text form:
 * paragraphs and line breaks are preserved, lists become bullets, headings and
 * emphasis markers are stripped to their text, links become "text (url)", and
 * the custom [[youtube|vimeo|video:...]] embeds become plain URLs. Inline
 * images are dropped from the text — the link preview card carries the cover
 * image instead.
 */
export function markdownToPlainText(markdown: string): string {
  let text = markdown

  // Custom embeds → plain URLs (mirrors the shortcodes in blog-content.tsx).
  text = text.replace(/\[\[youtube:([^\]]+)\]\]/g, (_m, id: string) => `https://youtu.be/${id.trim()}`)
  text = text.replace(/\[\[vimeo:([^\]]+)\]\]/g, (_m, id: string) => `https://vimeo.com/${id.trim()}`)
  text = text.replace(/\[\[video:([^\]]+)\]\]/g, (_m, url: string) => url.trim())

  // Protect URLs (including the ones the embeds just produced) with placeholder
  // tokens so the emphasis/list passes below can't mangle underscores, asterisks
  // or leading dashes inside them. Restored at the end.
  const protectedUrls: string[] = []
  text = text.replace(/(?:https?:\/\/|www\.)[^\s)]+/gi, (m) => {
    protectedUrls.push(m)
    return `\u0000${protectedUrls.length - 1}\u0001`
  })

  // Inline images ![alt](url) → dropped (the link card shows the cover image).
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '')

  // Links [text](url) → "text (url)".
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
    const h = href.trim()
    return h ? `${label} (${h})` : label
  })

  // Fenced code blocks ```lang\n...\n``` → keep the inner code, drop the fences.
  text = text.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_m, code: string) => code.replace(/\s+$/, ''))

  // Block-level cleanup, line by line.
  text = text
    .split('\n')
    .map((rawLine) => {
      let line = rawLine
      // Horizontal rules (---, ***, ___) become blank lines.
      if (/^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/.test(line)) return ''
      // Headings: drop the leading #'s.
      line = line.replace(/^\s{0,3}#{1,6}\s+/, '')
      // Blockquotes: drop the leading >.
      line = line.replace(/^\s{0,3}>\s?/, '')
      // Unordered list markers → a bullet.
      line = line.replace(/^\s*[-*+]\s+/, '• ')
      // Ordered list markers keep their number.
      line = line.replace(/^\s*(\d+)\.\s+/, '$1. ')
      return line
    })
    .join('\n')

  // Inline emphasis / code markers: strip the markers, keep the text.
  // Underscore emphasis only counts at word boundaries so intra-word underscores
  // in URLs and identifiers (e.g. https://x/a_b_c) are left untouched.
  text = text.replace(/\*\*(.+?)\*\*/g, '$1') // bold (asterisk)
  text = text.replace(/(^|\W)__(.+?)__(?=\W|$)/g, '$1$2') // bold (underscore)
  text = text.replace(/\*(?!\s)([^*]+?)(?<!\s)\*/g, '$1') // italic (asterisk)
  text = text.replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1$2') // italic (underscore)
  text = text.replace(/~~(.+?)~~/g, '$1') // strikethrough
  text = text.replace(/`([^`]+)`/g, '$1') // inline code

  // Restore protected URLs.
  text = text.replace(/\u0000(\d+)\u0001/g, (_m, i: string) => protectedUrls[Number(i)] ?? '')

  // Trim trailing whitespace per line and collapse runs of blank lines.
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Build the full cross-post body: title, optional subtitle, then the article
 * rendered as plain text. Used as the Facebook / Google Business message; the
 * link back to the article is attached separately as the post's link.
 */
export function blogPostToSocialText(post: {
  title: string
  subtitle?: string | null
  content: string
}): string {
  const parts: string[] = [post.title.trim()]
  if (post.subtitle && post.subtitle.trim()) parts.push(post.subtitle.trim())
  const body = markdownToPlainText(post.content)
  if (body) parts.push(body)
  return parts.join('\n\n')
}

/**
 * Build a length-bounded post for X/Twitter: title (and excerpt if it fits),
 * followed by the article link. Full article text won't fit in a tweet, so this
 * is a hook plus the link rather than the whole body.
 */
export function buildTwitterText(
  post: { title: string; excerpt?: string | null },
  url: string,
  limit = 280,
): string {
  const suffix = ` ${url}`
  const budget = limit - suffix.length
  let base = post.title.trim()
  if (post.excerpt && post.excerpt.trim()) {
    base = `${base} — ${post.excerpt.trim()}`
  }
  if (base.length > budget) {
    base = base.slice(0, Math.max(0, budget - 1)).replace(/\s+$/, '') + '…'
  }
  return `${base}${suffix}`
}

export type CrosspostResult = {
  platform: SocialMediaPlatform
  accountId: string
  accountName: string
  success: boolean
  externalUrl?: string
  error?: string
}

/**
 * Cross-post a published blog article to the selected connected accounts.
 *
 * Reuses the shared social publishing engine: it upserts a single
 * SocialMediaPost linked to the article (so repeated calls reuse it and its
 * per-account idempotency guards, never duplicating a live post) and then
 * publishes to each selected account. Only accounts on a CROSSPOST_PLATFORMS
 * network are attempted.
 */
export async function crosspostBlogPost(
  postId: string,
  accountIds: string[],
): Promise<{ results: CrosspostResult[] }> {
  const post = await prisma.blogPost.findUnique({ where: { id: postId } })
  if (!post) throw new Error('Blog post not found')

  const uniqueIds = Array.from(new Set(accountIds))
  if (uniqueIds.length === 0) return { results: [] }

  const accounts = await prisma.socialAccount.findMany({
    where: { id: { in: uniqueIds }, isActive: true },
  })
  const eligible = accounts.filter((a) => CROSSPOST_PLATFORMS.includes(a.platform))
  if (eligible.length === 0) return { results: [] }

  const url = blogPostUrl(post.slug)
  const fullText = blogPostToSocialText(post)
  // Cap the hashtag block so the URL + hashtags can't exhaust a platform's
  // budget (Twitter especially). The same bounded set is stored and reserved.
  const tags = boundedHashtags(post.tags)
  const reserve = hashtagSuffix(tags).length

  // Reuse the article's existing SocialMediaPost so its platform history isn't
  // lost when this call targets only a subset of channels.
  const existingSocial = await prisma.socialMediaPost.findUnique({
    where: { blogPostId: post.id },
    select: { platforms: true, publishedAt: true },
  })
  const platforms = Array.from(
    new Set<SocialMediaPlatform>([
      ...(existingSocial?.platforms ?? []),
      ...eligible.map((a) => a.platform),
    ]),
  )

  // Truncate each platform's body to its limit, reserving room for the hashtag
  // suffix publishToAccount appends. Facebook uses facebookContent; Google
  // Business falls back to content; Twitter has its own bounded builder.
  const facebookContent = truncateText(fullText, PLATFORM_MAX_CHARS.FACEBOOK - reserve)
  const content = truncateText(fullText, PLATFORM_MAX_CHARS.GOOGLE_MY_BUSINESS - reserve)
  const twitterContent = buildTwitterText(post, url, PLATFORM_MAX_CHARS.TWITTER - reserve)

  const social = await prisma.socialMediaPost.upsert({
    where: { blogPostId: post.id },
    create: {
      blogPostId: post.id,
      platforms,
      content,
      facebookContent,
      twitterContent,
      linkUrl: url,
      hashtags: tags,
      status: 'DRAFT',
    },
    update: {
      platforms,
      content,
      facebookContent,
      twitterContent,
      linkUrl: url,
      hashtags: tags,
    },
  })

  const results: CrosspostResult[] = []
  for (const account of eligible) {
    const result = await publishToAccount(social.id, account.id)
    results.push({
      platform: account.platform,
      accountId: account.id,
      accountName: account.accountName,
      success: result.success,
      externalUrl: result.externalUrl,
      error: result.error,
    })
  }

  // Derive the post's status from every persisted publish row, not just this
  // run's results — a failed retry of one new channel must not flip an article
  // that already published elsewhere back to FAILED — and keep the first
  // published timestamp.
  const publishes = await prisma.socialPostPublish.findMany({
    where: { postId: social.id },
    select: { status: true },
  })
  const anyPublished = publishes.some((p) => p.status === 'PUBLISHED')
  await prisma.socialMediaPost.update({
    where: { id: social.id },
    data: {
      status: anyPublished ? 'PUBLISHED' : 'FAILED',
      publishedAt: existingSocial?.publishedAt ?? (anyPublished ? new Date() : null),
    },
  })

  return { results }
}

export type BlogCrosspostStatus = {
  socialPostId: string | null
  publishes: Array<{
    accountId: string
    accountName: string
    platform: SocialMediaPlatform
    status: string
    externalUrl: string | null
    publishedAt: Date | null
    error: string | null
  }>
}

/**
 * Read the current cross-post status for a blog article: which accounts it has
 * been published to and the outcome of each.
 */
export async function getBlogCrosspostStatus(postId: string): Promise<BlogCrosspostStatus> {
  const social = await prisma.socialMediaPost.findUnique({
    where: { blogPostId: postId },
    include: {
      publishes: {
        include: { account: { select: { accountName: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!social) return { socialPostId: null, publishes: [] }
  return {
    socialPostId: social.id,
    publishes: social.publishes.map((p) => ({
      accountId: p.accountId,
      accountName: p.account.accountName,
      platform: p.platform,
      status: p.status,
      externalUrl: p.externalUrl,
      publishedAt: p.publishedAt,
      error: p.errorMessage,
    })),
  }
}
