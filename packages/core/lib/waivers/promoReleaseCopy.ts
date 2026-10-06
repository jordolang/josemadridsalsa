/**
 * Photo & video release collected on the in-person waiver kiosk (/waiver).
 *
 * Bump PROMO_RELEASE_VERSION whenever the wording below changes, so every
 * stored record says exactly which text the person agreed to.
 */
export const PROMO_RELEASE_VERSION = '2026-09'
export const PROMO_RELEASE_CONTACT_EMAIL = 'mike@josemadridsalsa.com'
export const PROMO_RELEASE_BLOB_DIRECTORY = 'waivers/promotional-release'

export const PROMO_RELEASE_TITLE = 'Photo & Video Release'

export const PROMO_RELEASE_INTRO =
  'Jose Madrid Salsa would love to share photos and videos from today on our website, social media, and marketing materials.'

export const PROMO_RELEASE_TERMS: readonly string[] = [
  'If you agree, you give Jose Madrid Salsa permission to photograph, film, and record you, and to use those images, video, audio, your first name, and anything you say on camera (like a taste-test reaction) on our website, social media, email, ads, packaging, signage, and other promotional materials.',
  'This permission is free of charge, worldwide, and has no expiration date. You will not be paid, and you will not get to approve the final materials.',
  'You can withdraw your permission at any time by emailing ' +
    PROMO_RELEASE_CONTACT_EMAIL +
    '. We will stop using your likeness in anything new; items already printed or published may stay in use.',
  'If you decline, we will not knowingly feature you in our website or promotional materials.',
  'If you are signing for a child under 18, you confirm you are their parent or legal guardian and give this permission on their behalf.',
]

export const PROMO_RELEASE_DECISIONS = ['agree', 'decline'] as const
export type PromoReleaseDecision = (typeof PROMO_RELEASE_DECISIONS)[number]
