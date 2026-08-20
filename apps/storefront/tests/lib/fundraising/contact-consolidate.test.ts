import { describe, expect, it } from 'vitest'

import {
  cleanOrganizationName,
  consolidateArchiveRows,
  formatPhone,
  isNonOrganizationName,
  mergeListRows,
  normalizeEmail,
  normalizePhone,
  organizationKey,
  type ArchiveRow,
  type ListRow,
} from '@/lib/fundraising/contact-consolidate'

function archiveRow(overrides: Partial<ArchiveRow> = {}): ArchiveRow {
  return {
    organizationName: 'Anderson HS Band',
    year: 2022,
    orderDate: new Date('2022-11-06T00:00:00Z'),
    submittedBy: 'Judith Rautine',
    contactEmail: 'jrautine@gmail.com',
    contactPhone: '9014842607',
    totalJars: 140,
    orderCount: null,
    formType: 'ORDER_FORM',
    sourceFile: '03 Fundraisers/2022/Anderson/order.xlsx',
    ...overrides,
  }
}

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Rachel.Pedersen@Avondaleschools.ORG ')).toBe(
      'rachel.pedersen@avondaleschools.org',
    )
  })

  it('rejects malformed addresses', () => {
    for (const bad of ['', null, undefined, 'not-an-email', 'a@b', 'a b@c.com']) {
      expect(normalizeEmail(bad)).toBeNull()
    }
  })

  it("drops Jose Madrid's own addresses, which appear on blank templates", () => {
    expect(normalizeEmail('mike@josemadridsalsa.com')).toBeNull()
    expect(normalizeEmail('orders@josemadrid.net')).toBeNull()
  })
})

describe('normalizePhone', () => {
  it('reduces every archive spelling of one number to the same digits', () => {
    for (const raw of ['740-521-4304', '(740) 521-4304', '7405214304', '1-740-521-4304']) {
      expect(normalizePhone(raw)).toBe('7405214304')
    }
  })

  it('rejects wrong-length and placeholder numbers', () => {
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('0000000000')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })

  it('formats for display only', () => {
    expect(formatPhone('7405214304')).toBe('(740) 521-4304')
  })
})

describe('isNonOrganizationName', () => {
  it('rejects the archive filing artifacts', () => {
    const junk = [
      '16',
      '9 Flavors',
      '25 Flavors',
      'Undated',
      '_Undated',
      'Fundraisers',
      'Fundraisers 2022 (2)',
      'Fundraisers for',
      '2018 Fundraisers for filing',
      '2024 Fundraiser Totals',
      '2025 Fundraiser Totals (2)',
      '2021 Online FR 060221',
      'Fundraiser Information',
      'Forms for website',
      'order form $6',
      'Tracking $6',
      'Hospital Fundraising',
      'FFA',
      '4H',
      'Fundraiser Order Form 2022A',
      '',
      null,
    ]
    for (const name of junk) {
      expect(isNonOrganizationName(name), `expected junk: ${name}`).toBe(true)
    }
  })

  it('keeps real organizations, including sparse ones', () => {
    const real = [
      'Anderson HS Band',
      'Avon HS Crew',
      'Cloverleaf HS Girls Soccer',
      'Cub Scout Pack 163',
      'Breckinridge County 4-H Council',
      'FFA Fruit Sale Participation Donation',
      'New Bloomfield PTA',
      "Avondale Middle School National Junior Honor's Society",
      'BGSU Equestrian',
    ]
    for (const name of real) {
      expect(isNonOrganizationName(name), `expected real: ${name}`).toBe(false)
    }
  })
})

describe('organizationKey', () => {
  it('collapses spelling drift onto one key', () => {
    const key = organizationKey('Anderson HS Band')
    expect(organizationKey('anderson hs band')).toBe(key)
    expect(organizationKey('Anderson HS Band (2)')).toBe(key)
    expect(organizationKey('Anderson HS Band 2022')).toBe(key)
  })

  it('normalizes ampersands and punctuation', () => {
    expect(organizationKey('Smith & Sons')).toBe(organizationKey('Smith and Sons'))
    expect(organizationKey("St. Mary's PTA")).toBe(organizationKey('St Marys PTA'))
  })

  it('keeps genuinely different organizations apart', () => {
    expect(organizationKey('Avon HS Crew')).not.toBe(organizationKey('Avon HS Band'))
  })

  it('strips duplicate-file markers for display', () => {
    expect(cleanOrganizationName('Chelsea Co-op (2)')).toBe('Chelsea Co-op')
  })
})

describe('consolidateArchiveRows', () => {
  it('sums jars and orders across an organization every campaign', () => {
    const [contact] = consolidateArchiveRows([
      archiveRow({ year: 2021, totalJars: 100, sourceFile: 'a.xlsx' }),
      archiveRow({ year: 2022, totalJars: 140, sourceFile: 'b.xlsx' }),
      archiveRow({
        year: 2023,
        totalJars: 60,
        orderCount: 12,
        formType: 'ORDER_EXPORT',
        sourceFile: 'c.xlsx',
      }),
    ])

    expect(contact.totalJars).toBe(300)
    expect(contact.totalOrders).toBe(12)
    expect(contact.campaignCount).toBe(3)
    expect(contact.years).toEqual([2021, 2022, 2023])
    expect(contact.sourceFiles).toHaveLength(3)
  })

  it('prefers a year-free display name so it cannot contradict the years column', () => {
    const [contact] = consolidateArchiveRows([
      archiveRow({ organizationName: 'Onsted Sweet Clovers 2024', year: 2024, sourceFile: 'a.xlsx' }),
      archiveRow({ organizationName: 'Onsted Sweet Clovers', year: 2025, sourceFile: 'b.xlsx' }),
    ])

    expect(contact.organizationName).toBe('Onsted Sweet Clovers')
    expect(contact.years).toEqual([2024, 2025])
  })

  it('still prefers the more specific name when neither carries a year', () => {
    // Both spellings reduce to the same organization key, so they are one record and the
    // display name is a real choice between them.
    const contacts = consolidateArchiveRows([
      archiveRow({ organizationName: 'Avon HS Crew', year: 2024, sourceFile: 'a.xlsx' }),
      archiveRow({ organizationName: 'Avon HS Crew Fundraiser', year: 2025, sourceFile: 'b.xlsx' }),
    ])

    expect(contacts).toHaveLength(1)
    expect(contacts[0].organizationName).toBe('Avon HS Crew Fundraiser')
  })

  it('drops filing artifacts instead of turning them into contacts', () => {
    const contacts = consolidateArchiveRows([
      archiveRow({ organizationName: '2024 Fundraiser Totals', contactEmail: null }),
      archiveRow({ organizationName: '16 Flavors', contactEmail: null }),
      archiveRow({ organizationName: 'Anderson HS Band' }),
    ])

    expect(contacts).toHaveLength(1)
    expect(contacts[0].organizationName).toBe('Anderson HS Band')
  })

  it('takes contact details from the most recent campaign that has them', () => {
    const [contact] = consolidateArchiveRows([
      archiveRow({
        year: 2016,
        orderDate: new Date('2016-10-01T00:00:00Z'),
        contactEmail: 'old.coordinator@school.org',
        contactPhone: '7405214304',
        submittedBy: 'Old Coordinator',
        sourceFile: 'old.xlsx',
      }),
      archiveRow({
        year: 2023,
        orderDate: new Date('2023-10-01T00:00:00Z'),
        contactEmail: 'new.coordinator@school.org',
        contactPhone: '5138465286',
        submittedBy: 'New Coordinator',
        sourceFile: 'new.xlsx',
      }),
    ])

    expect(contact.email).toBe('new.coordinator@school.org')
    expect(contact.contactName).toBe('New Coordinator')
    expect(contact.phone).toBe('5138465286')
  })

  it('does not let an undated form displace a dated contact', () => {
    const [contact] = consolidateArchiveRows([
      archiveRow({
        year: 2023,
        orderDate: new Date('2023-10-01T00:00:00Z'),
        contactEmail: 'dated@school.org',
        sourceFile: 'dated.xlsx',
      }),
      archiveRow({
        year: null,
        orderDate: null,
        contactEmail: 'undated@school.org',
        sourceFile: 'undated.xlsx',
      }),
    ])

    expect(contact.email).toBe('dated@school.org')
  })

  it('still recovers a contact from an undated form when nothing else has one', () => {
    const [contact] = consolidateArchiveRows([
      archiveRow({ year: 2023, contactEmail: null, contactPhone: null, submittedBy: null }),
      archiveRow({
        year: null,
        orderDate: null,
        contactEmail: 'only@school.org',
        sourceFile: 'undated.xlsx',
      }),
    ])

    expect(contact.email).toBe('only@school.org')
  })

  it('keys an organization on its name so a coordinator handover does not fork a row', () => {
    const [first] = consolidateArchiveRows([
      archiveRow({ contactEmail: 'old@school.org', sourceFile: 'a.xlsx' }),
    ])
    const [second] = consolidateArchiveRows([
      archiveRow({ contactEmail: 'new@school.org', sourceFile: 'b.xlsx' }),
    ])

    expect(first.dedupeKey).toBe(second.dedupeKey)
    expect(first.dedupeKey).toBe(`org:${organizationKey('Anderson HS Band')}`)
  })

  it('gives two organizations sharing one coordinator separate records', () => {
    const contacts = consolidateArchiveRows([
      archiveRow({ organizationName: 'Avon HS Crew', contactEmail: 'parent@example.com' }),
      archiveRow({ organizationName: 'Avon MS Choir', contactEmail: 'parent@example.com' }),
    ])

    expect(contacts).toHaveLength(2)
    expect(new Set(contacts.map((c) => c.dedupeKey)).size).toBe(2)
  })

  it('keeps a campaign with no recoverable contact as a record with sales history', () => {
    const [contact] = consolidateArchiveRows([
      archiveRow({
        organizationName: 'BGSU Equestrian',
        contactEmail: null,
        contactPhone: null,
        submittedBy: null,
        totalJars: 438,
        orderCount: 48,
        formType: 'ORDER_EXPORT',
      }),
    ])

    expect(contact.email).toBeNull()
    expect(contact.totalJars).toBe(438)
    expect(contact.isActive).toBe(true)
  })
})

describe('mergeListRows', () => {
  const base = () =>
    consolidateArchiveRows([
      archiveRow({ organizationName: 'Anderson HS Band', contactEmail: 'coach@anderson.org' }),
    ])

  function listRow(overrides: Partial<ListRow> = {}): ListRow {
    return {
      email: 'coach@anderson.org',
      firstName: 'Pat',
      lastName: 'Rivera',
      sourceFile: 'Constant contact email lists/Fundraiser list.csv',
      source: 'CONSTANT_CONTACT',
      ...overrides,
    }
  }

  it('enriches an existing organization rather than creating a duplicate', () => {
    const merged = mergeListRows(base(), [listRow({ note: 'completed a fundraiser' })])

    expect(merged).toHaveLength(1)
    expect(merged[0].organizationName).toBe('Anderson HS Band')
    expect(merged[0].sourceFiles).toHaveLength(2)
    expect(merged[0].notes).toBe('completed a fundraiser')
  })

  it('does not overwrite an organization contact name recovered from an order form', () => {
    const merged = mergeListRows(base(), [listRow()])
    expect(merged[0].contactName).toBe('Judith Rautine')
  })

  it('creates a standalone record for an address with no organization behind it', () => {
    const merged = mergeListRows(base(), [
      listRow({ email: 'stranger@example.com', firstName: 'Dana', lastName: 'Webb' }),
    ])

    expect(merged).toHaveLength(2)
    const added = merged[1]
    expect(added.organizationName).toBe('Dana Webb')
    expect(added.campaignCount).toBe(0)
    expect(added.isActive).toBe(true)
    expect(added.dedupeKey).toBe('email:stranger@example.com')
  })

  it('imports website supporters inactive so they are not solicited as coordinators', () => {
    const merged = mergeListRows(base(), [
      listRow({
        email: 'buyer@example.com',
        organizationName: 'Dragon Guard',
        source: 'WEBSITE_EXPORT',
        sourceFile: 'email lists/Fundraiser website customers 4-13-26.csv',
      }),
    ])

    const added = merged[1]
    expect(added.source).toBe('WEBSITE_EXPORT')
    expect(added.isActive).toBe(false)
    expect(added.organizationName).toBe('Dragon Guard')
  })

  it('dedupes repeated addresses across the two mailing lists', () => {
    const merged = mergeListRows(base(), [
      listRow({ email: 'repeat@example.com', sourceFile: 'Fundraiser list.csv' }),
      listRow({
        email: 'repeat@example.com',
        sourceFile: 'completed fundraisers.csv',
        note: 'completed a fundraiser',
      }),
    ])

    const added = merged.filter((c) => c.email === 'repeat@example.com')
    expect(added).toHaveLength(1)
    expect(added[0].sourceFiles).toEqual(['Fundraiser list.csv', 'completed fundraisers.csv'])
    expect(added[0].notes).toBe('completed a fundraiser')
  })

  it('skips rows whose address will never be mailable', () => {
    const merged = mergeListRows(base(), [
      listRow({ email: 'not-an-email' }),
      listRow({ email: 'mike@josemadridsalsa.com' }),
    ])

    expect(merged).toHaveLength(1)
  })
})
