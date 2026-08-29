/**
 * Repair image URLs in email HTML that was stored before the source templates
 * were fixed.
 *
 * Stored HTML — seeded templates, saved template versions, lead campaign bodies —
 * is a snapshot, so correcting a template file does not correct rows already
 * written. Two faults are repaired: filenames that never existed in
 * public/email-templates, and the retired josemadridsalsa.com origin, which
 * serves 404 for the whole /email-templates path. Both render as a broken-image
 * placeholder in the recipient's inbox.
 */

import { getImageBaseUrl } from './components'

/** Referenced filename → the asset that actually exists in public/email-templates. */
export const FILENAME_REMAP: Record<string, string> = {
  'cart-reminder.png': 'abandoned-cart.png',
  'birthday-celebration.png': 'birthday-header.png',
  'email-verification.png': 'email-header.png',
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
  for (const [oldName, newName] of Object.entries(FILENAME_REMAP)) {
    out = out.split(`${base}/${oldName}`).join(`${base}/${newName}`)
  }

  return out
}
