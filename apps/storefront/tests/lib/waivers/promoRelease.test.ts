import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  PROMO_RELEASE_VERSION,
  buildPromoReleasePathname,
  buildPromoReleasePdf,
  createPromoReleaseRecord,
  promoReleaseSubmissionSchema,
  toPdfSafeText,
} from '@/lib/waivers/promoRelease'

const FIXED_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

function record(overrides: Record<string, unknown> = {}, now = new Date('2026-09-24T16:30:00Z')) {
  const submission = promoReleaseSubmissionSchema.parse({
    fullName: 'María López',
    decision: 'agree',
    ...overrides,
  })
  return createPromoReleaseRecord(submission, {
    collectedBy: 'staff@example.com',
    ipAddress: '203.0.113.7',
    userAgent: 'iPad',
    now,
    id: FIXED_ID,
  })
}

describe('promoReleaseSubmissionSchema', () => {
  it('accepts a minimal agree submission and drops empty optionals', () => {
    const parsed = promoReleaseSubmissionSchema.parse({
      fullName: '  Maria Lopez ',
      email: '',
      decision: 'agree',
      minorName: '',
      event: '',
    })
    expect(parsed).toEqual({
      fullName: 'Maria Lopez',
      email: undefined,
      decision: 'agree',
      signingForMinor: false,
      minorName: undefined,
      event: undefined,
    })
  })

  it('normalizes email case', () => {
    const parsed = promoReleaseSubmissionSchema.parse({
      fullName: 'Maria Lopez',
      email: 'Maria@Example.COM',
      decision: 'decline',
    })
    expect(parsed.email).toBe('maria@example.com')
  })

  it('rejects a missing decision, a short name, and a bad email', () => {
    expect(promoReleaseSubmissionSchema.safeParse({ fullName: 'Maria Lopez' }).success).toBe(false)
    expect(promoReleaseSubmissionSchema.safeParse({ fullName: 'M', decision: 'agree' }).success).toBe(false)
    expect(
      promoReleaseSubmissionSchema.safeParse({ fullName: 'Maria Lopez', email: 'nope', decision: 'agree' }).success,
    ).toBe(false)
  })

  it("requires the child's name when signing for a minor", () => {
    const result = promoReleaseSubmissionSchema.safeParse({
      fullName: 'Maria Lopez',
      decision: 'agree',
      signingForMinor: true,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['minorName'])
    }
  })

  it('discards a stray child name when not signing for a minor', () => {
    const parsed = promoReleaseSubmissionSchema.parse({
      fullName: 'Maria Lopez',
      decision: 'agree',
      signingForMinor: false,
      minorName: 'Sofia Lopez',
    })
    expect(parsed.minorName).toBeUndefined()
  })
})

describe('createPromoReleaseRecord', () => {
  it('stamps version, time, and collector', () => {
    const result = record()
    expect(result.version).toBe(PROMO_RELEASE_VERSION)
    expect(result.submittedAt).toBe('2026-09-24T16:30:00.000Z')
    expect(result.collectedBy).toBe('staff@example.com')
    expect(result.id).toBe(FIXED_ID)
  })
})

describe('buildPromoReleasePathname', () => {
  it('files by Eastern date with decision, ascii name slug, and short id', () => {
    expect(buildPromoReleasePathname(record())).toBe(
      'waivers/promotional-release/2026/09/2026-09-24-agree-maria-lopez-1a2b3c4d',
    )
  })

  it('uses the Eastern calendar day for late-evening signings', () => {
    // 01:30 UTC on the 25th is 21:30 on the 24th in Ohio.
    const late = record({ decision: 'decline' }, new Date('2026-09-25T01:30:00Z'))
    expect(buildPromoReleasePathname(late)).toBe(
      'waivers/promotional-release/2026/09/2026-09-24-decline-maria-lopez-1a2b3c4d',
    )
  })

  it('falls back when the name has no ascii letters', () => {
    expect(buildPromoReleasePathname(record({ fullName: '李小龍' }))).toContain('-agree-unnamed-')
  })
})

describe('toPdfSafeText', () => {
  it('keeps Latin-1 accents and replaces characters the standard font cannot encode', () => {
    expect(toPdfSafeText('María 🌶️ Lopez')).toMatch(/^María \?+ Lopez$/)
    expect(toPdfSafeText('line\nbreak')).toBe('line break')
  })
})

describe('buildPromoReleasePdf', () => {
  it('renders a loadable PDF for agree, decline, and minor records', async () => {
    const variants = [
      record(),
      record({ decision: 'decline', email: 'm@example.com', event: 'Zanesville Farmers Market' }),
      record({ signingForMinor: true, minorName: 'Sofía López 🎉' }),
    ]
    for (const variant of variants) {
      const bytes = await buildPromoReleasePdf(variant)
      expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-')
      const loaded = await PDFDocument.load(bytes)
      expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1)
      expect(loaded.getTitle()).toContain('Photo & Video Release')
    }
  })
})
