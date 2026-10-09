import { describe, expect, it } from 'vitest'
import { mergeListSubscribers } from '@/lib/email/all-lists-recipients'

describe('mergeListSubscribers', () => {
  it('lists each address once across lists, case-insensitively', () => {
    const merged = mergeListSubscribers([
      { email: 'Fan@Example.com', firstName: null, lastName: null },
      { email: 'fan@example.com ', firstName: 'Pat', lastName: 'Fan' },
      { email: 'other@example.com', firstName: 'Sam', lastName: null },
    ])
    expect(merged).toEqual([
      { email: 'fan@example.com', name: 'Pat Fan' },
      { email: 'other@example.com', name: 'Sam' },
    ])
  })

  it('keeps the first name it found and skips rows without an address', () => {
    const merged = mergeListSubscribers([
      { email: 'a@example.com', firstName: 'Al', lastName: null },
      { email: 'A@example.com', firstName: 'Alfred', lastName: null },
      { email: 'not-an-email', firstName: 'X', lastName: null },
    ])
    expect(merged).toEqual([{ email: 'a@example.com', name: 'Al' }])
  })
})
