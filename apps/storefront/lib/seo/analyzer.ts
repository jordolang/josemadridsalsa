export type SeoCheckStatus = 'pass' | 'warn' | 'fail'

export interface SeoCheck {
  id: string
  label: string
  status: SeoCheckStatus
  message: string
}

export interface PageSeoInput {
  /** The meta/page title as it would render in search results. */
  title?: string | null
  /** The meta description. */
  description?: string | null
  /** URL slug (last path segment), if applicable. */
  slug?: string | null
  /** Primary/OG image URL, if any. */
  image?: string | null
  /** Site keywords to check presence of (any match counts). */
  keywords?: string[]
  /** Whether the page emits JSON-LD structured data. Omit to skip the check. */
  hasStructuredData?: boolean
}

export interface SeoAnalysis {
  /** 0-100, weighted across executed checks. */
  score: number
  checks: SeoCheck[]
  /** Human-readable suggestions derived from warn/fail checks. */
  recommendations: string[]
}

/**
 * Snippet-length thresholds. Exported so that editors and write-path validation
 * enforce exactly what the analyzer scores — a value the schema accepts must
 * never be one the analyzer then flags.
 */
export const TITLE_MIN = 30
export const TITLE_MAX = 60
export const DESC_MIN = 70
export const DESC_MAX = 160
const SLUG_MAX = 75
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Run rule-based SEO checks against a page's metadata.
 * Pure function — callers assemble the input from whatever source they have.
 */
export function analyzePage(input: PageSeoInput): SeoAnalysis {
  const checks: SeoCheck[] = []

  const title = input.title?.trim() ?? ''
  if (!title) {
    checks.push({
      id: 'title',
      label: 'Meta title',
      status: 'fail',
      message: 'Missing meta title. Every page needs a unique, descriptive title.',
    })
  } else if (title.length < TITLE_MIN) {
    checks.push({
      id: 'title',
      label: 'Meta title',
      status: 'warn',
      message: `Title is ${title.length} characters — aim for ${TITLE_MIN}-${TITLE_MAX} to use the available search snippet space.`,
    })
  } else if (title.length > TITLE_MAX) {
    checks.push({
      id: 'title',
      label: 'Meta title',
      status: 'warn',
      message: `Title is ${title.length} characters and may be truncated in search results — keep it under ${TITLE_MAX}.`,
    })
  } else {
    checks.push({
      id: 'title',
      label: 'Meta title',
      status: 'pass',
      message: `Title length (${title.length}) is within the recommended ${TITLE_MIN}-${TITLE_MAX} characters.`,
    })
  }

  const description = input.description?.trim() ?? ''
  if (!description) {
    checks.push({
      id: 'description',
      label: 'Meta description',
      status: 'fail',
      message: 'Missing meta description. Search engines will pick arbitrary page text instead.',
    })
  } else if (description.length < DESC_MIN) {
    checks.push({
      id: 'description',
      label: 'Meta description',
      status: 'warn',
      message: `Description is ${description.length} characters — aim for ${DESC_MIN}-${DESC_MAX} for a fuller snippet.`,
    })
  } else if (description.length > DESC_MAX) {
    checks.push({
      id: 'description',
      label: 'Meta description',
      status: 'warn',
      message: `Description is ${description.length} characters and will be truncated — keep it under ${DESC_MAX}.`,
    })
  } else {
    checks.push({
      id: 'description',
      label: 'Meta description',
      status: 'pass',
      message: `Description length (${description.length}) is within the recommended ${DESC_MIN}-${DESC_MAX} characters.`,
    })
  }

  if (input.slug != null) {
    const slug = input.slug
    if (!SLUG_PATTERN.test(slug)) {
      checks.push({
        id: 'slug',
        label: 'URL slug',
        status: 'warn',
        message: `Slug "${slug}" should be lowercase words separated by hyphens (no spaces, underscores, or special characters).`,
      })
    } else if (slug.length > SLUG_MAX) {
      checks.push({
        id: 'slug',
        label: 'URL slug',
        status: 'warn',
        message: `Slug is ${slug.length} characters — shorter URLs are easier to read and share.`,
      })
    } else {
      checks.push({
        id: 'slug',
        label: 'URL slug',
        status: 'pass',
        message: 'Slug is well-formed.',
      })
    }
  }

  if (input.image !== undefined) {
    checks.push(
      input.image
        ? {
            id: 'image',
            label: 'Social image',
            status: 'pass',
            message: 'Page has an image for social sharing and rich results.',
          }
        : {
            id: 'image',
            label: 'Social image',
            status: 'warn',
            message: 'No featured/OG image set — links shared on social media will render without a preview.',
          }
    )
  }

  if (input.keywords && input.keywords.length > 0) {
    const haystack = `${title} ${description}`.toLowerCase()
    const matched = input.keywords.filter((k) => k && haystack.includes(k.toLowerCase()))
    checks.push(
      matched.length > 0
        ? {
            id: 'keywords',
            label: 'Keyword usage',
            status: 'pass',
            message: `Title/description mention configured keywords (${matched.slice(0, 3).join(', ')}).`,
          }
        : {
            id: 'keywords',
            label: 'Keyword usage',
            status: 'warn',
            message: 'None of the configured site keywords appear in the title or description.',
          }
    )
  }

  if (input.hasStructuredData !== undefined) {
    checks.push(
      input.hasStructuredData
        ? {
            id: 'structured-data',
            label: 'Structured data',
            status: 'pass',
            message: 'Page emits JSON-LD structured data.',
          }
        : {
            id: 'structured-data',
            label: 'Structured data',
            status: 'warn',
            message: 'No structured data — adding JSON-LD makes the page eligible for rich results.',
          }
    )
  }

  const points = checks.reduce(
    (sum, check) => sum + (check.status === 'pass' ? 1 : check.status === 'warn' ? 0.5 : 0),
    0
  )
  const score = checks.length > 0 ? Math.round((points / checks.length) * 100) : 100

  return {
    score,
    checks,
    recommendations: checks.filter((c) => c.status !== 'pass').map((c) => c.message),
  }
}
