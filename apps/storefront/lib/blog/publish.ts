import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

const SITE_URL = process.env.NEXTAUTH_URL ?? 'https://www.josemadrid.net'
const GLOBAL_LIST_NAME = 'Heat Index'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface RecipientRow {
  email: string
  firstName: string | null
}

function dedupeByEmail(rows: RecipientRow[]): RecipientRow[] {
  const seen = new Map<string, RecipientRow>()
  for (const r of rows) {
    const key = r.email.toLowerCase()
    if (!seen.has(key)) seen.set(key, r)
  }
  return Array.from(seen.values())
}

/**
 * Find or create a MailingList by name. Used to lazily provision the global
 * Heat Index list and a per-series list the first time anyone subscribes or
 * the first time a post is published in that series.
 */
export async function getOrCreateMailingList(name: string): Promise<string> {
  const existing = await prisma.mailingList.findFirst({ where: { name } })
  if (existing) return existing.id
  const created = await prisma.mailingList.create({ data: { name } })
  return created.id
}

/**
 * Compose the publish-notification email for a single subscriber and a post.
 */
function renderPostEmail(post: {
  title: string
  excerpt: string
  slug: string
  coverImage: string | null
  series: { name: string } | null
}, firstName: string | null): { subject: string; html: string; text: string } {
  const url = `${SITE_URL}/heat-index/${post.slug}`
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,'
  const seriesLine = post.series
    ? `New chapter in <strong>${escapeHtml(post.series.name)}</strong>`
    : 'New on The Heat Index'

  const subject = post.series
    ? `${post.series.name}: ${post.title}`
    : `The Heat Index: ${post.title}`

  const html = `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#fff8ef;font-family:Georgia,'Times New Roman',serif;color:#1f1f1f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(69,10,10,0.08);">
          <tr><td style="padding:24px 32px;background:linear-gradient(135deg,#d53030,#7f1d1d);color:#fff;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;opacity:0.85;">${seriesLine}</div>
            <div style="margin-top:8px;font-size:28px;font-weight:700;line-height:1.15;">The Heat Index</div>
          </td></tr>
          ${post.coverImage
            ? `<tr><td><img src="${escapeHtml(post.coverImage.startsWith('http') ? post.coverImage : SITE_URL + post.coverImage)}" alt="" style="display:block;width:100%;height:auto;" /></td></tr>`
            : ''}
          <tr><td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;">${greeting}</p>
            <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#1f1f1f;">${escapeHtml(post.title)}</h1>
            <p style="margin:0 0 24px;color:#555;font-size:16px;line-height:1.5;">${escapeHtml(post.excerpt)}</p>
            <p style="margin:0 0 24px;">
              <a href="${url}" style="display:inline-block;padding:12px 24px;background:#d53030;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Read the story →</a>
            </p>
            <p style="margin:32px 0 0;color:#888;font-size:12px;line-height:1.5;">
              You're receiving this because you subscribed to The Heat Index.
              <a href="${SITE_URL}/unsubscribe" style="color:#888;">Unsubscribe</a> ·
              <a href="${SITE_URL}/heat-index" style="color:#888;">Browse all stories</a>
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim()

  const text = [
    greeting,
    '',
    post.series ? `New chapter in ${post.series.name}:` : 'New on The Heat Index:',
    '',
    post.title,
    '',
    post.excerpt,
    '',
    `Read: ${url}`,
    '',
    '---',
    'You are receiving this because you subscribed to The Heat Index.',
    `Unsubscribe: ${SITE_URL}/unsubscribe`,
  ].join('\n')

  return { subject, html, text }
}

/**
 * Publish a post — send notification email to all relevant subscribers.
 * Idempotent at the post level: skips if the post is not PUBLISHED or has no
 * subscribers configured. Email send failures are logged but do not throw.
 */
export async function publishBlogPost(postId: string): Promise<{
  sent: number
  skipped: boolean
  reason?: string
}> {
  const post = await prisma.blogPost.findUnique({
    where: { id: postId },
    include: { series: { select: { id: true, slug: true, name: true } } },
  })

  if (!post) return { sent: 0, skipped: true, reason: 'post not found' }
  if (post.status !== 'PUBLISHED') return { sent: 0, skipped: true, reason: 'not published' }

  const listNames = [GLOBAL_LIST_NAME]
  if (post.series) listNames.push(`${GLOBAL_LIST_NAME} · ${post.series.name}`)

  const lists = await prisma.mailingList.findMany({ where: { name: { in: listNames } } })
  if (lists.length === 0) return { sent: 0, skipped: true, reason: 'no lists' }

  const subscribers = await prisma.mailingListSubscriber.findMany({
    where: { listId: { in: lists.map((l) => l.id) }, status: 'SUBSCRIBED' },
    select: { email: true, firstName: true },
  })

  const recipients = dedupeByEmail(subscribers)
  if (recipients.length === 0) return { sent: 0, skipped: true, reason: 'no subscribers' }

  let sent = 0
  for (const r of recipients) {
    const { subject, html, text } = renderPostEmail(
      {
        title: post.title,
        excerpt: post.excerpt,
        slug: post.slug,
        coverImage: post.coverImage,
        series: post.series ? { name: post.series.name } : null,
      },
      r.firstName
    )
    const result = await sendEmail({ to: r.email, subject, html, text })
    if (!('error' in result) || !result.error) {
      sent += 1
    }
  }

  return { sent, skipped: false }
}
