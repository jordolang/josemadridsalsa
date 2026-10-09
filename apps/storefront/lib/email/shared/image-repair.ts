/**
 * Repair image URLs in email HTML that was stored before the source templates
 * were fixed.
 *
 * Stored HTML — seeded templates, saved template versions, lead campaign bodies —
 * is a snapshot, so correcting a template file does not correct rows already
 * written. Two faults are repaired: filenames that never existed in
 * public/email-templates, and image origins written while josemadridsalsa.com
 * still ran the old BigCommerce store (which served 404 for /email-templates).
 * Both render as a broken-image placeholder in the recipient's inbox. Every
 * image is now served from the Vercel Blob store, so stored site-origin URLs and
 * hotlinked third-party social icons are rewritten to it as well.
 */

import { getImageBaseUrl, jmsFooter, SOCIAL_ICON_SOURCES } from '@/lib/email/shared/components'

/** Referenced filename → the asset that actually exists in public/email-templates. */
export const FILENAME_REMAP: Record<string, string> = {
  'cart-reminder.png': 'abandoned-cart.png',
  'birthday-celebration.png': 'birthday-header.png',
  'email-verification.png': 'security-notice.png',
  'fall-season.png': 'fall.png',
  'gift-certificate.png': 'email-header.png',
  'holiday-season.png': 'christmas.png',
  'new-product.png': 'product-launch.png',
  'order-ready.png': 'order-update.png',
  'referral-program.png': 'referral.png',
  'summer-season.png': 'summer.png',
  'we-miss-you.png': 'miss-you-letter.png',
}

/** Origins that no longer serve /email-templates. */
const DEAD_ORIGINS = [
  'https://www.josemadridsalsa.com/email-templates',
  'https://josemadridsalsa.com/email-templates',
]

/** Logo paths that 404; the footer logo lives alongside the template images. */
const DEAD_LOGO_URLS = [
  'https://josemadrid.net/images/logo.png',
  'https://www.josemadrid.net/images/logo.png',
]

export function repairImageUrls(html: string): string {
  const base = getImageBaseUrl()
  let out = html

  for (const origin of DEAD_ORIGINS) {
    out = out.split(origin).join(base)
  }
  for (const dead of DEAD_LOGO_URLS) {
    out = out.split(dead).join(`${base}/Jose-Madrid-Profile.png`)
  }
  for (const [name, source] of Object.entries(SOCIAL_ICON_SOURCES)) {
    out = out.split(source).join(`${base}/${name}`)
  }
  for (const [oldName, newName] of Object.entries(FILENAME_REMAP)) {
    out = out.split(`${base}/${oldName}`).join(`${base}/${newName}`)
  }

  return out
}

/** Opening tag of the branded footer table, identical in every template. */
const FOOTER_TABLE_START =
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
  'style="background-color: #f4f1ec;'

/**
 * Find the end of the table that starts at `from`, counting nested tables so the
 * footer's inner tables do not terminate the match early.
 */
function endOfTable(html: string, from: number): number {
  const tag = /<table\b|<\/table\s*>/gi
  tag.lastIndex = from
  let depth = 0

  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[0][1] === '/' ? -1 : 1
    if (depth === 0) return m.index + m[0].length
  }

  return -1
}

/**
 * Replace the stored footer with the current one.
 *
 * Stored HTML carries whatever footer markup was current when the row was
 * written, including the fixed-column layout that broke link labels mid-word on
 * narrow screens. Re-seeding would also fix this, but it replaces the whole
 * template and discards any edit made in the admin panel; this swaps the footer
 * alone. Replacing a current footer with itself is a no-op, so it is safe to
 * re-run.
 */
export function repairFooter(html: string): string {
  const start = html.indexOf(FOOTER_TABLE_START)
  if (start < 0) return html

  const end = endOfTable(html, start)
  if (end < 0) return html

  return html.slice(0, start) + jmsFooter.trim() + html.slice(end)
}

/** Every repair applied to one stored email body. */
export function repairEmailHtml(html: string): string {
  return repairFooter(repairImageUrls(html))
}
