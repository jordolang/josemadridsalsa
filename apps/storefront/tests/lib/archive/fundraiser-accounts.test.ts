/**
 * Fundraiser account normalization tests
 */

import { describe, it, expect } from 'vitest'
import {
  buildFundraiserAccounts,
  canonicalizeOrganizationName,
  isLikelyOrganizationName,
  repairMojibake,
  type ArchivedFundraiserRow,
} from '@/lib/archive/fundraiser-accounts'

function row(over: Partial<ArchivedFundraiserRow> = {}): ArchivedFundraiserRow {
  return {
    organizationName: 'Test Org',
    contactEmail: null,
    submittedBy: null,
    year: null,
    orderDate: null,
    sourceFile: 'a.xlsx',
    ...over,
  }
}

describe('repairMojibake', () => {
  it('restores a curly apostrophe mangled through Latin-1', () => {
    expect(repairMojibake('Brealynn Gardnerâ€™s Rodeo')).toBe(
      'Brealynn Gardner’s Rodeo'
    )
  })

  it('leaves clean text untouched', () => {
    expect(repairMojibake('BSA Troop 100')).toBe('BSA Troop 100')
    expect(repairMojibake("Ernie's Duckies")).toBe("Ernie's Duckies")
  })
})

describe('canonicalizeOrganizationName', () => {
  it('strips a trailing year', () => {
    expect(canonicalizeOrganizationName('BGSU Equestrian 2023')).toBe('BGSU Equestrian')
  })

  it('strips a season and year together', () => {
    expect(canonicalizeOrganizationName("BGSU Equestrian Fall '21")).toBe('BGSU Equestrian')
    expect(canonicalizeOrganizationName('Avon High School Crew Spring 2023')).toBe(
      'Avon High School Crew'
    )
  })

  it('strips a two-digit apostrophe year', () => {
    expect(canonicalizeOrganizationName("Auntie V's '23")).toBe("Auntie V's")
  })

  it('collapses the year-suffixed variants of one group to a single name', () => {
    const variants = [
      'Barberton MS 8th Grade Trip',
      'Barberton MS 8th Grade Trip 2024',
      'Barberton MS 8th Grade Trip 2025',
      'Barberton MS 8th Grade Trip 2026',
    ].map(canonicalizeOrganizationName)

    expect(new Set(variants).size).toBe(1)
  })

  it('normalizes whitespace', () => {
    expect(canonicalizeOrganizationName('  BSA   Troop  100 ')).toBe('BSA Troop 100')
  })

  it('keeps a number that is part of the identity', () => {
    // The troop number is the name — only a *trailing year* should be removed.
    expect(canonicalizeOrganizationName('BSA Troop 100')).toBe('BSA Troop 100')
    expect(canonicalizeOrganizationName('Butler Pack 53')).toBe('Butler Pack 53')
  })

  it('never strips a name down to nothing', () => {
    expect(canonicalizeOrganizationName('2024')).toBe('2024')
  })

  it('drops order-form boilerplate taken from a filename', () => {
    expect(
      canonicalizeOrganizationName('Southern Local - 2025 JMS Fundraiser Order Form 25 Flavor')
    ).toBe('Southern Local')
  })

  it('strips a duplicate-download suffix', () => {
    expect(canonicalizeOrganizationName('Maysville Key Club (2)')).toBe(
      'Maysville Key Club'
    )
  })

  it('leaves a name that is nothing but boilerplate for the artifact check', () => {
    // Stripping to empty would lose the evidence that this is not an org, so
    // the raw value survives canonicalization and is rejected downstream.
    const name = 'JMS Fundraiser Order Form 25 Flavor 2026 (1)'
    expect(isLikelyOrganizationName(name)).toBe(false)
  })
})

describe('isLikelyOrganizationName', () => {
  it.each([
    'BSA Troop 100',
    '4-Ever Kids 4-H Club',
    'Amboy HS Cheer',
    "Ernie's Duckies for CF",
    'CHUP Co-Op Preschool',
  ])('accepts %s', (name) => {
    expect(isLikelyOrganizationName(name)).toBe(true)
  })

  it.each([
    '16',
    '25',
    '9',
    '2018 Fundraisers for filing',
    '2024 Fundraiser Totals',
    '2021 Online FR 060221',
    'Tracking $6',
    'order form $6',
    '',
  ])('rejects %s', (name) => {
    expect(isLikelyOrganizationName(name)).toBe(false)
  })
})

describe('buildFundraiserAccounts', () => {
  it('groups campaigns sharing a contact address into one account', () => {
    const accounts = buildFundraiserAccounts([
      row({
        organizationName: 'Avondale MS NJHS 2022',
        contactEmail: 'Rachel.Pedersen@avondaleschools.org',
        year: 2022,
        sourceFile: 'a.xlsx',
      }),
      row({
        organizationName: 'Avondale MS NJHS 2023',
        contactEmail: 'rachel.pedersen@avondaleschools.org',
        year: 2023,
        sourceFile: 'b.xlsx',
      }),
    ])

    expect(accounts).toHaveLength(1)
    expect(accounts[0].email).toBe('rachel.pedersen@avondaleschools.org')
    expect(accounts[0].campaignCount).toBe(2)
    expect(accounts[0].years).toEqual([2022, 2023])
    expect(accounts[0].sourceFiles).toEqual(['a.xlsx', 'b.xlsx'])
  })

  it('groups emailless campaigns by canonical organization name', () => {
    const accounts = buildFundraiserAccounts([
      row({ organizationName: 'BGSU Equestrian', sourceFile: 'a.xlsx' }),
      row({ organizationName: 'BGSU Equestrian 2023', sourceFile: 'b.xlsx' }),
      row({ organizationName: "BGSU Equestrian Fall '21", sourceFile: 'c.xlsx' }),
    ])

    expect(accounts).toHaveLength(1)
    expect(accounts[0].organizationName).toBe('BGSU Equestrian')
    expect(accounts[0].email).toBeNull()
    expect(accounts[0].campaignCount).toBe(3)
  })

  it('keeps an emailed account separate from a same-named emailless one', () => {
    // Grouping by address is deliberate: the address is the stronger identity,
    // and only addressed accounts can become Customer records.
    const accounts = buildFundraiserAccounts([
      row({ organizationName: 'Ace of Clubs', contactEmail: 'a@b.com' }),
      row({ organizationName: 'Ace of Clubs', sourceFile: 'z.xlsx' }),
    ])

    expect(accounts).toHaveLength(2)
    expect(accounts.filter((a) => a.email).length).toBe(1)
  })

  it('drops filing artifacts', () => {
    const accounts = buildFundraiserAccounts([
      row({ organizationName: '2024 Fundraiser Totals' }),
      row({ organizationName: '16' }),
      row({ organizationName: 'Real Booster Club' }),
    ])

    expect(accounts.map((a) => a.organizationName)).toEqual(['Real Booster Club'])
  })

  it('parses a submitter into first and last name', () => {
    const [account] = buildFundraiserAccounts([
      row({ organizationName: 'Cub Scout Pack 77', submittedBy: 'Dee Hartley' }),
    ])

    expect(account.firstName).toBe('Dee')
    expect(account.lastName).toBe('Hartley')
  })

  it('ignores a submitter field holding an address or label', () => {
    const [account] = buildFundraiserAccounts([
      row({ organizationName: 'Cub Scout Pack 77', submittedBy: 'E-Mail: x@y.com' }),
    ])

    expect(account.firstName).toBeNull()
    expect(account.lastName).toBeNull()
  })

  it('prefers the most frequent spelling of a name', () => {
    const [account] = buildFundraiserAccounts([
      row({ organizationName: 'Amboy HS Cheer', contactEmail: 'c@d.com' }),
      row({ organizationName: 'Amboy HS Cheer', contactEmail: 'c@d.com' }),
      row({ organizationName: 'Amboy High School Cheerleading', contactEmail: 'c@d.com' }),
    ])

    expect(account.organizationName).toBe('Amboy HS Cheer')
  })

  it('falls back to the order date year when year is null', () => {
    const [account] = buildFundraiserAccounts([
      row({
        organizationName: 'Anderson HS Band',
        orderDate: new Date('2022-05-04T00:00:00Z'),
      }),
    ])

    expect(account.years).toEqual([2022])
  })

  it('returns an empty list for no input', () => {
    expect(buildFundraiserAccounts([])).toEqual([])
  })
})
