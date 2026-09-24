import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  PROMO_RELEASE_VERSION,
  buildPromoReleaseCsv,
  buildPromoReleasePathname,
  buildPromoReleasePdf,
  createPromoReleaseRecord,
  easternDateKey,
  formatPromoReleaseLocation,
  networkLocationFromHeaders,
  promoReleaseCode,
  promoReleaseDayPrefix,
  promoReleaseSubmissionSchema,
  toPdfSafeText,
  toPromoReleaseLogEntry,
} from '@/lib/waivers/promoRelease'

const FIXED_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const GPS = {
  latitude: 39.940253,
  longitude: -82.013191,
  accuracyMeters: 8.4,
  capturedAt: '2026-09-24T16:29:55.000Z',
}

function record(overrides: Record<string, unknown> = {}, now = new Date('2026-09-24T16:30:12Z')) {
  const submission = promoReleaseSubmissionSchema.parse({
    decision: 'agree',
    signature: SIGNATURE,
    ...overrides,
  })
  return createPromoReleaseRecord(submission, {
    collectedBy: 'staff@example.com',
    ipAddress: '203.0.113.7',
    userAgent: 'iPad',
    networkLocation: { city: 'Zanesville', region: 'OH', country: 'US' },
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
  it('stamps version, time, code, collector, and network location', () => {
    const result = record()
    expect(result.version).toBe(PROMO_RELEASE_VERSION)
    expect(result.submittedAt).toBe('2026-09-24T16:30:12.000Z')
    expect(result.collectedBy).toBe('staff@example.com')
    expect(result.id).toBe(FIXED_ID)
    expect(result.code).toBe('JM-1A2B3C')
    expect(result.networkLocation).toEqual({ city: 'Zanesville', region: 'OH', country: 'US' })
  })

  it('keeps the iPad clock and GPS fix alongside the server time', () => {
    const result = record({ clientSubmittedAt: '2026-09-24T16:30:11.480Z', location: GPS })
    expect(result.clientSubmittedAt).toBe('2026-09-24T16:30:11.480Z')
    expect(result.location).toEqual(GPS)
  })

  it('rejects out-of-range coordinates and non-ISO device times', () => {
    expect(
      promoReleaseSubmissionSchema.safeParse({ decision: 'decline', location: { ...GPS, latitude: 120 } }).success,
    ).toBe(false)
    expect(
      promoReleaseSubmissionSchema.safeParse({ decision: 'decline', clientSubmittedAt: 'yesterday' }).success,
    ).toBe(false)
  })
})

describe('promoReleaseCode', () => {
  it('is JM- plus the first six hex digits of the id', () => {
    expect(promoReleaseCode('abcdef12-3456-4789-8abc-def012345678')).toBe('JM-ABCDEF')
  })
})

describe('networkLocationFromHeaders', () => {
  it('reads and decodes the Vercel geo headers', () => {
    const headers = new Headers({
      'x-vercel-ip-city': 'San%20Jos%C3%A9',
      'x-vercel-ip-country-region': 'CA',
      'x-vercel-ip-country': 'US',
    })
    expect(networkLocationFromHeaders(headers)).toEqual({ city: 'San José', region: 'CA', country: 'US' })
  })

  it('returns null without geo headers', () => {
    expect(networkLocationFromHeaders(new Headers())).toBeNull()
  })
})

describe('formatPromoReleaseLocation', () => {
  it('prefers GPS and falls back to the network location', () => {
    expect(formatPromoReleaseLocation(record({ location: GPS }))).toBe('39.940253, -82.013191 (±8 m, GPS)')
    expect(formatPromoReleaseLocation(record())).toBe('Zanesville, OH, US (approximate, from network)')
    expect(formatPromoReleaseLocation({ location: undefined, networkLocation: null })).toBe('Not available')
  })
})

describe('buildPromoReleasePathname', () => {
  it('leads with the Eastern date and time to the second, then decision, name, and code', () => {
    expect(buildPromoReleasePathname(record())).toBe(
      'waivers/promotional-release/2026/09/2026-09-24-123012-agree-anonymous-jm-1a2b3c',
    )
  })

  it('uses an ascii slug of the name when one is given', () => {
    expect(buildPromoReleasePathname(record({ fullName: 'María López' }))).toBe(
      'waivers/promotional-release/2026/09/2026-09-24-123012-agree-maria-lopez-jm-1a2b3c',
    )
  })

  it('uses the Eastern calendar day for late-evening signings', () => {
    // 01:30 UTC on the 25th is 21:30 on the 24th in Ohio.
    const late = record({ decision: 'decline' }, new Date('2026-09-25T01:30:00Z'))
    expect(buildPromoReleasePathname(late)).toBe(
      'waivers/promotional-release/2026/09/2026-09-24-213000-decline-anonymous-jm-1a2b3c',
    )
    expect(easternDateKey(late.submittedAt)).toBe('2026-09-24')
    expect(buildPromoReleasePathname(late).startsWith(promoReleaseDayPrefix('2026-09-24'))).toBe(true)
  })

  it('falls back when the name has no ascii letters', () => {
    expect(buildPromoReleasePathname(record({ fullName: '李小龍' }))).toContain('-agree-unnamed-')
  })
})

describe('buildPromoReleaseCsv', () => {
  it('writes one row per waiver, oldest first, without the signature', () => {
    const early = toPromoReleaseLogEntry(record({ location: GPS, event: 'Farmers Market' }), 'https://blob.test/a.pdf')
    const late = toPromoReleaseLogEntry(
      createPromoReleaseRecord(promoReleaseSubmissionSchema.parse({ decision: 'decline', fullName: '=HYPERLINK("x")' }), {
        collectedBy: 'staff@example.com',
        now: new Date('2026-09-24T17:05:00Z'),
        id: 'ffffff00-0000-4000-8000-000000000000',
      }),
      null,
    )
    const lines = buildPromoReleaseCsv([late, early]).trim().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]?.startsWith('time_eastern,submitted_utc,device_time_utc,code,decision,signed')).toBe(true)
    expect(lines[1]).toContain('JM-1A2B3C,agree,true')
    expect(lines[1]).toContain('39.940253,-82.013191,8')
    expect(lines[1]).toContain('https://blob.test/a.pdf')
    expect(lines[1]).not.toContain('data:image')
    expect(lines[2]).toContain('JM-FFFFFF,decline,false')
    // Formula injection is neutralised.
    expect(lines[2]).toContain(`"'=HYPERLINK(""x"")"`)
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
