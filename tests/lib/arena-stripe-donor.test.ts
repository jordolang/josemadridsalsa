import { describe, it, expect } from 'vitest'
import {
  extractFundraiserTeamId,
  resolveDonorFromStripeSession,
  type MinimalStripeSession,
} from '@/lib/arena/stripe-donor'

function session(
  overrides: Partial<MinimalStripeSession>,
): MinimalStripeSession {
  return {
    metadata: null,
    customer_details: null,
    ...overrides,
  }
}

describe('arena/stripe-donor — extractFundraiserTeamId', () => {
  it('returns the teamId when present', () => {
    expect(
      extractFundraiserTeamId(
        session({ metadata: { fundraiserTeamId: 'team_abc123' } }),
      ),
    ).toBe('team_abc123')
  })

  it('returns null when metadata is null', () => {
    expect(extractFundraiserTeamId(session({ metadata: null }))).toBeNull()
  })

  it('returns null when teamId is empty or whitespace', () => {
    expect(
      extractFundraiserTeamId(session({ metadata: { fundraiserTeamId: '' } })),
    ).toBeNull()
    expect(
      extractFundraiserTeamId(
        session({ metadata: { fundraiserTeamId: '   ' } }),
      ),
    ).toBeNull()
  })
})

describe('arena/stripe-donor — resolveDonorFromStripeSession', () => {
  it('uses the JSON donor and its isAnonymous flag to suppress name', () => {
    const d = resolveDonorFromStripeSession(
      session({
        metadata: {
          fundraiserDonor: JSON.stringify({
            userId: 'u_1',
            name: 'Alice',
            email: 'alice@example.com',
            comment: 'Go team!',
            isAnonymous: true,
          }),
        },
      }),
    )
    expect(d).toEqual({
      userId: 'u_1',
      name: null,
      email: 'alice@example.com',
      comment: 'Go team!',
      isAnonymous: true,
    })
  })

  it('returns all fields from the JSON when not anonymous', () => {
    const d = resolveDonorFromStripeSession(
      session({
        metadata: {
          fundraiserDonor: JSON.stringify({
            userId: 'u_1',
            name: 'Alice',
            email: 'alice@example.com',
            comment: 'Thanks for running this!',
            isAnonymous: false,
          }),
        },
      }),
    )
    expect(d).toEqual({
      userId: 'u_1',
      name: 'Alice',
      email: 'alice@example.com',
      comment: 'Thanks for running this!',
      isAnonymous: false,
    })
  })

  it('falls back to customer_details when the JSON is malformed', () => {
    const d = resolveDonorFromStripeSession(
      session({
        metadata: { fundraiserDonor: '{not json' },
        customer_details: { name: 'Bob', email: 'bob@example.com' },
      }),
    )
    expect(d).toEqual({
      userId: null,
      name: 'Bob',
      email: 'bob@example.com',
      comment: null,
      isAnonymous: false,
    })
  })

  it('falls back to customer_details for missing JSON fields', () => {
    const d = resolveDonorFromStripeSession(
      session({
        metadata: {
          fundraiserDonor: JSON.stringify({
            name: null,
            email: null,
            isAnonymous: false,
          }),
        },
        customer_details: { name: 'Bob', email: 'bob@example.com' },
      }),
    )
    expect(d).toEqual({
      userId: null,
      name: 'Bob',
      email: 'bob@example.com',
      comment: null,
      isAnonymous: false,
    })
  })

  it('returns a pure customer_details donor when no JSON metadata', () => {
    const d = resolveDonorFromStripeSession(
      session({
        metadata: null,
        customer_details: { name: 'Chi', email: 'chi@example.com' },
      }),
    )
    expect(d).toEqual({
      userId: null,
      name: 'Chi',
      email: 'chi@example.com',
      comment: null,
      isAnonymous: false,
    })
  })

  it('normalizes empty and whitespace strings to null', () => {
    const d = resolveDonorFromStripeSession(
      session({
        metadata: {
          fundraiserDonor: JSON.stringify({
            userId: '   ',
            name: '',
            email: '',
            comment: '   ',
            isAnonymous: false,
          }),
        },
      }),
    )
    expect(d).toEqual({
      userId: null,
      name: null,
      email: null,
      comment: null,
      isAnonymous: false,
    })
  })
})
