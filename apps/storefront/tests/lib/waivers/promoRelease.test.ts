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
const SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function record(overrides: Record<string, unknown> = {}, now = new Date('2026-09-24T16:30:00Z')) {
  const submission = promoReleaseSubmissionSchema.parse({
    decision: 'agree',
    signature: SIGNATURE,
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
  it('accepts an anonymous signed agreement and drops empty optionals', () => {
    const parsed = promoReleaseSubmissionSchema.parse({
      decision: 'agree',
      signature: SIGNATURE,
      fullName: '  ',
      email: '',
      minorName: '',
      event: '',
    })
    expect(parsed).toEqual({
      decision: 'agree',
      signature: SIGNATURE,
      fullName: undefined,
      email: undefined,
      signingForMinor: false,
      minorName: undefined,
      event: undefined,
    })
  })

  it('accepts an anonymous decline with no signature', () => {
    const parsed = promoReleaseSubmissionSchema.parse({ decision: 'decline' })
    expect(parsed.decision).toBe('decline')
    expect(parsed.signature).toBeUndefined()
  })

  it('requires a signature to agree', () => {
    const result = promoReleaseSubmissionSchema.safeParse({ decision: 'agree' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['signature'])
  })

  it('discards a signature sent with a decline', () => {
    const parsed = promoReleaseSubmissionSchema.parse({ decision: 'decline', signature: SIGNATURE })
    expect(parsed.signature).toBeUndefined()
  })

  it('rejects signatures that are not PNG data URLs', () => {
    for (const signature of ['data:image/svg+xml;base64,PHN2Zz4=', 'https://example.com/sig.png', 'data:image/png;base64,<script>']) {
      expect(promoReleaseSubmissionSchema.safeParse({ decision: 'agree', signature }).success).toBe(false)
    }
  })

  it('normalizes an optional email and rejects a bad one or a one-letter name', () => {
    expect(
      promoReleaseSubmissionSchema.parse({ decision: 'decline', email: 'Maria@Example.COM' }).email,
    ).toBe('maria@example.com')
    expect(promoReleaseSubmissionSchema.safeParse({ decision: 'decline', email: 'nope' }).success).toBe(false)
    expect(promoReleaseSubmissionSchema.safeParse({ decision: 'decline', fullName: 'M' }).success).toBe(false)
  })

  it("keeps the child's name optional and only when signing for a minor", () => {
    expect(
      promoReleaseSubmissionSchema.safeParse({ decision: 'agree', signature: SIGNATURE, signingForMinor: true }).success,
    ).toBe(true)
    expect(
      promoReleaseSubmissionSchema.parse({ decision: 'agree', signature: SIGNATURE, minorName: 'Sofia Lopez' }).minorName,
    ).toBeUndefined()
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
  it('files anonymous records by Eastern date, decision, and short id', () => {
    expect(buildPromoReleasePathname(record())).toBe(
      'waivers/promotional-release/2026/09/2026-09-24-agree-anonymous-1a2b3c4d',
    )
  })

  it('uses an ascii slug of the name when one is given', () => {
    expect(buildPromoReleasePathname(record({ fullName: 'María López' }))).toBe(
      'waivers/promotional-release/2026/09/2026-09-24-agree-maria-lopez-1a2b3c4d',
    )
  })

  it('uses the Eastern calendar day for late-evening signings', () => {
    // 01:30 UTC on the 25th is 21:30 on the 24th in Ohio.
    const late = record({ decision: 'decline' }, new Date('2026-09-25T01:30:00Z'))
    expect(buildPromoReleasePathname(late)).toBe(
      'waivers/promotional-release/2026/09/2026-09-24-decline-anonymous-1a2b3c4d',
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
  it('renders a loadable PDF for anonymous, named, decline, and minor records', async () => {
    const variants = [
      record(),
      record({ fullName: 'María López', email: 'm@example.com', event: 'Zanesville Farmers Market' }),
      record({ decision: 'decline' }),
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
