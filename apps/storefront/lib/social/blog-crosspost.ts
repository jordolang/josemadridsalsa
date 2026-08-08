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

const SITE_URL = process.env.NEXTAUTH_URL ?? 'https://www.josemadrid.net'

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
  text = text.replace(/(\*\*|__)(.+?)\1/g, '$2') // bold
  text = text.replace(/(\*|_)(.+?)\1/g, '$2') // italic
  text = text.replace(/~~(.+?)~~/g, '$2') // strikethrough
  text = text.replace(/`([^`]+)`/g, '$1') // inline code

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
  const content = blogPostToSocialText(post)
  const twitterContent = buildTwitterText(post, url)
  const platforms = Array.from(new Set(eligible.map((a) => a.platform)))

  const social = await prisma.socialMediaPost.upsert({
    where: { blogPostId: post.id },
    create: {
      blogPostId: post.id,
      platforms,
      content,
      facebookContent: content,
      twitterContent,
      linkUrl: url,
      hashtags: post.tags,
      status: 'DRAFT',
    },
    update: {
      platforms,
      content,
      facebookContent: content,
      twitterContent,
      linkUrl: url,
      hashtags: post.tags,
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

  const anySucceeded = results.some((r) => r.success)
  await prisma.socialMediaPost.update({
    where: { id: social.id },
    data: {
      status: anySucceeded ? 'PUBLISHED' : 'FAILED',
      publishedAt: anySucceeded ? new Date() : null,
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
