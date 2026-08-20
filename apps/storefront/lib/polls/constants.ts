/**
 * Shared constants and the standing advisory copy for the community polls
 * feature. The advisory text lives here rather than in the page so the poll
 * form, the admin preview and the tests all quote the same words.
 */

/** Character cap on a written answer, per question. Admins may lower it. */
export const MAX_COMMENT_LENGTH = 1500

/** Cap on the name fields — long enough for any real name, short enough to store. */
export const MAX_NAME_LENGTH = 80

/** Highest value an admin may set for a rating scale. */
export const MAX_RATING_SCALE = 10

/**
 * The participation advisory every poll shows above the name fields. Admins can
 * replace it per poll via `Poll.consentNotice`, but this is what they get by
 * default and what the checkbox refers to.
 */
export const DEFAULT_CONSENT_NOTICE =
  'Your participation is genuinely appreciated — thank you for taking the time. ' +
  'Please note that the answers you give here may be used in our promotional ' +
  'material or internally at Jose Madrid Salsa, which means they can be seen by ' +
  'people who may not share your opinions or feelings. Keep that in mind when ' +
  'deciding whether to include your full name, and use the button below if you would ' +
  'rather we credit you anonymously.'

/** Label on the toggle that asks us to strip identifying details before publishing. */
export const ANONYMOUS_REQUEST_LABEL = 'Keep me anonymous if you share my answers publicly'

export const ANONYMOUS_REQUEST_HELP =
  'We will remove your name and any contact details before your words appear anywhere public.'

/** Helper text shown inside the name fields. */
export const FIRST_NAME_PLACEHOLDER = 'First name (required)'
export const LAST_NAME_PLACEHOLDER = 'Last name (optional — first name alone is fine)'

/**
 * Accent keys an admin can choose per poll. Each maps to a gradient pair in
 * `accentClasses`, so the card art stays inside the brand palette instead of
 * accepting arbitrary CSS.
 */
export const POLL_ACCENTS = ['salsa', 'verde', 'amber', 'midnight', 'clay'] as const

export type PollAccent = (typeof POLL_ACCENTS)[number]

interface AccentClasses {
  /** Gradient behind the card header. */
  gradient: string
  /** Selected-pill background. */
  pill: string
  /** Text/icon colour on a light background. */
  text: string
  /** Border for a selected control. */
  border: string
  /** Fill of a results bar. */
  bar: string
}

const ACCENT_CLASSES: Record<PollAccent, AccentClasses> = {
  salsa: {
    gradient: 'from-salsa-700 to-amber-500',
    pill: 'bg-salsa-700 text-white',
    text: 'text-salsa-700',
    border: 'border-salsa-700',
    bar: 'bg-salsa-600',
  },
  verde: {
    gradient: 'from-verde-800 to-verde-500',
    pill: 'bg-verde-700 text-white',
    text: 'text-verde-700',
    border: 'border-verde-700',
    bar: 'bg-verde-600',
  },
  amber: {
    gradient: 'from-amber-600 to-amber-400',
    pill: 'bg-amber-600 text-white',
    text: 'text-amber-700',
    border: 'border-amber-600',
    bar: 'bg-amber-500',
  },
  midnight: {
    gradient: 'from-stone-900 to-salsa-800',
    pill: 'bg-stone-900 text-white',
    text: 'text-stone-800',
    border: 'border-stone-800',
    bar: 'bg-stone-800',
  },
  clay: {
    gradient: 'from-orange-800 to-amber-500',
    pill: 'bg-orange-800 text-white',
    text: 'text-orange-800',
    border: 'border-orange-800',
    bar: 'bg-orange-700',
  },
}

/** Accent classes for a poll, falling back to the house red for unknown keys. */
export function accentClasses(accent: string | null | undefined): AccentClasses {
  return ACCENT_CLASSES[(accent ?? '') as PollAccent] ?? ACCENT_CLASSES.salsa
}
