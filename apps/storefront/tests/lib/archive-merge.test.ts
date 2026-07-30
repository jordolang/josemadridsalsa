import { describe, expect, it } from 'vitest'
import {
  type ArchiveSignal,
  type RawArchiveContact,
  designate,
  detectDateOrder,
  isUsableOrgName,
  mergeArchiveContacts,
  mergeEmailStatus,
  parseArchiveDate,
  pickField,
} from '@/lib/customers/archive-merge'

function contact(
  email: string,
  signal: ArchiveSignal,
  sourceFile: string,
  over: Partial<RawArchiveContact> = {}
): RawArchiveContact {
  return {
    email,
    firstName: null,
    lastName: null,
    phone: null,
    company: null,
    group: null,
    emailStatus: null,
    emailPermissionStatus: null,
    sourceName: null,
    orders: null,
    orderTotal: null,
    orderDate: null,
    createdAt: null,
    customerType: null,
    city: null,
    state: null,
    sourceFile,
    mode: 'tabular',
    signal,
    ...over,
  }
}

describe('designate', () => {
  it('defaults to STANDARD with no other evidence', () => {
    expect(designate(['standard'])).toBe('STANDARD')
  })

  it('prefers wholesale over fundraising over standard', () => {
    expect(designate(['standard', 'fundraising'])).toBe('FUNDRAISING')
    expect(designate(['fundraising', 'wholesale'])).toBe('WHOLESALE')
    expect(designate(['wholesale', 'standard', 'fundraising'])).toBe('WHOLESALE')
  })

  it('is independent of the order the evidence arrived in', () => {
    expect(designate(['wholesale', 'fundraising'])).toBe(
      designate(['fundraising', 'wholesale'])
    )
  })

  it('treats an unresolved mixed-file row as standard', () => {
    expect(designate(['mixed'])).toBe('STANDARD')
  })
})

describe('mergeEmailStatus', () => {
  it('keeps an unsubscribe whichever order the sources are merged in', () => {
    expect(mergeEmailStatus(['Unsubscribed', 'Active'])).toBe('Unsubscribed')
    expect(mergeEmailStatus(['Active', 'Unsubscribed'])).toBe('Unsubscribed')
  })

  it('ranks bounced and removed above active', () => {
    expect(mergeEmailStatus(['Active', 'Bounced'])).toBe('Bounced')
    expect(mergeEmailStatus(['Active', 'Removed'])).toBe('Removed')
  })

  it('normalizes loose spellings', () => {
    expect(mergeEmailStatus(['unsub'])).toBe('Unsubscribed')
    expect(mergeEmailStatus(['opt out'])).toBe('Unsubscribed')
    expect(mergeEmailStatus(['bounced-hard'])).toBe('Bounced')
  })

  it('returns null when nothing usable is present', () => {
    expect(mergeEmailStatus([null, '', 'whatever'])).toBeNull()
  })
})

describe('pickField', () => {
  it('takes the value the most sources agree on', () => {
    expect(pickField(['Anne', 'Anne', 'Ann'])).toBe('Anne')
  })

  it('breaks ties toward the fuller value', () => {
    expect(pickField(['H', 'Herlocher'])).toBe('Herlocher')
  })

  it('ignores blanks rather than letting them win', () => {
    expect(pickField([null, '  ', 'Anne'])).toBe('Anne')
    expect(pickField([null, null])).toBeNull()
  })

  it('does not depend on input order', () => {
    expect(pickField(['H', 'Herlocher', 'H'])).toBe(
      pickField(['H', 'H', 'Herlocher'])
    )
  })
})

describe('isUsableOrgName', () => {
  it('accepts a real organization name', () => {
    expect(isUsableOrgName('Hardin Valley MS Band')).toBe(true)
  })

  it('rejects label leftovers and placeholders', () => {
    expect(isUsableOrgName(':')).toBe(false)
    expect(isUsableOrgName('N/A')).toBe(false)
    expect(isUsableOrgName('  ')).toBe(false)
    expect(isUsableOrgName(null)).toBe(false)
    expect(isUsableOrgName('7')).toBe(false)
  })
})

describe('detectDateOrder', () => {
  it('detects day-first from a day component above 12', () => {
    expect(detectDateOrder(['20/04/2020', '13/11/2021'])).toBe('DMY')
  })

  it('detects month-first from a day component in the second position', () => {
    expect(detectDateOrder(['04/20/2020', '11/13/2021'])).toBe('MDY')
  })

  it('falls back to US month-first when every date is ambiguous', () => {
    expect(detectDateOrder(['04/05/2020', '01/02/2021'])).toBe('MDY')
  })
})

describe('parseArchiveDate', () => {
  it('reads the same digits differently per file convention', () => {
    expect(parseArchiveDate('04/20/2020', 'MDY')?.toISOString()).toBe(
      '2020-04-20T00:00:00.000Z'
    )
    expect(parseArchiveDate('20/04/2020', 'DMY')?.toISOString()).toBe(
      '2020-04-20T00:00:00.000Z'
    )
  })

  it('reads ISO timestamps', () => {
    expect(parseArchiveDate('2025-10-13 00:00:00', 'MDY')?.toISOString()).toBe(
      '2025-10-13T00:00:00.000Z'
    )
  })

  it('recovers a row written the other way round to its file', () => {
    expect(parseArchiveDate('20/04/2020', 'MDY')?.toISOString()).toBe(
      '2020-04-20T00:00:00.000Z'
    )
  })

  it('rejects non-dates and implausible years', () => {
    expect(parseArchiveDate('Totals', 'MDY')).toBeNull()
    expect(parseArchiveDate(null, 'MDY')).toBeNull()
    expect(parseArchiveDate('01/01/1902', 'MDY')).toBeNull()
  })
})

describe('mergeArchiveContacts', () => {
  const OPTS = { importedOn: '2026-07-30' }

  it('collapses one address across sources into a single customer', () => {
    const merged = mergeArchiveContacts(
      [
        contact('A.Person@Example.NET', 'standard', 'reg-customers.csv', {
          firstName: 'Anne',
          lastName: 'H',
        }),
        contact('a.person@example.net', 'fundraising', 'fr-customers.csv', {
          lastName: 'Herlocher',
          phone: '740-555-1212',
        }),
      ],
      OPTS
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      email: 'a.person@example.net',
      firstName: 'Anne',
      lastName: 'Herlocher',
      phone: '740-555-1212',
      accountType: 'FUNDRAISING',
    })
    expect(merged[0].sourceFiles).toEqual(['fr-customers.csv', 'reg-customers.csv'])
  })

  it('records every signal in the notes so the choice is auditable', () => {
    const [merged] = mergeArchiveContacts(
      [
        contact('b@example.net', 'fundraising', 'fr.csv', { group: 'Hardin Band' }),
        contact('b@example.net', 'wholesale', 'stores.xls', { company: "Al's Market" }),
      ],
      OPTS
    )

    expect(merged.accountType).toBe('WHOLESALE')
    expect(merged.notes).toContain('Designated WHOLESALE')
    expect(merged.notes).toContain('fundraising, wholesale')
    expect(merged.notes).toContain("Al's Market")
    expect(merged.notes).toContain('Hardin Band')
    expect(merged.notes).toContain('2026-07-30')
  })

  it('surfaces the organization as the source name', () => {
    const [merged] = mergeArchiveContacts(
      [
        contact('c@example.net', 'fundraising', 'form.xlsx', {
          group: 'Cub Scout Pack 77',
          sourceName: 'Added by you',
        }),
      ],
      OPTS
    )
    expect(merged.sourceName).toBe('Cub Scout Pack 77')
  })

  it('falls back to the export source name with no organization', () => {
    const [merged] = mergeArchiveContacts(
      [contact('d@example.net', 'standard', 'cc.csv', { sourceName: 'BigCommerce' })],
      OPTS
    )
    expect(merged.sourceName).toBe('BigCommerce')
  })

  it('counts an order once when the same export is filed twice', () => {
    const rows = ['orders-2026-05-11 (3).csv', 'try this.csv'].map((file) =>
      contact('e@example.net', 'standard', file, {
        orderDate: '05/10/2026',
        orderTotal: '41.00',
      })
    )
    const [merged] = mergeArchiveContacts(rows, OPTS)

    expect(merged.totalOrders).toBe(1)
    expect(merged.totalSpent).toBe(41)
    expect(merged.lastOrderAt?.toISOString()).toBe('2026-05-10T00:00:00.000Z')
  })

  it('sums genuinely distinct orders and keeps the latest date', () => {
    const [merged] = mergeArchiveContacts(
      [
        contact('f@example.net', 'standard', 'orders.csv', {
          orderDate: '01/05/2026',
          orderTotal: '20.00',
        }),
        contact('f@example.net', 'standard', 'orders.csv', {
          orderDate: '03/09/2026',
          orderTotal: '32.50',
        }),
      ],
      OPTS
    )

    expect(merged.totalOrders).toBe(2)
    expect(merged.totalSpent).toBe(52.5)
    expect(merged.lastOrderAt?.toISOString()).toBe('2026-03-09T00:00:00.000Z')
  })

  it("trusts an export's own order count when it is higher", () => {
    const [merged] = mergeArchiveContacts(
      [
        contact('g@example.net', 'standard', 'customers.csv', { orders: '7' }),
        contact('g@example.net', 'standard', 'orders.csv', {
          orderDate: '02/02/2026',
          orderTotal: '15.00',
        }),
      ],
      OPTS
    )
    expect(merged.totalOrders).toBe(7)
  })

  it('resolves ambiguous dates per file, not globally', () => {
    const merged = mergeArchiveContacts(
      [
        // This file proves itself day-first with 20/04.
        contact('h@example.net', 'standard', 'dmy.csv', { orderDate: '20/04/2024' }),
        contact('h@example.net', 'standard', 'dmy.csv', { orderDate: '05/03/2024' }),
        // ...while this one proves itself month-first with 04/20.
        contact('i@example.net', 'standard', 'mdy.csv', { orderDate: '04/20/2024' }),
        contact('i@example.net', 'standard', 'mdy.csv', { orderDate: '05/03/2024' }),
      ],
      OPTS
    )

    const h = merged.find((m) => m.email === 'h@example.net')!
    const i = merged.find((m) => m.email === 'i@example.net')!
    // 05/03 is 5 March in the day-first file and 3 May in the month-first one,
    // so each file's latest order lands on a different date.
    expect(h.lastOrderAt?.toISOString()).toBe('2024-04-20T00:00:00.000Z')
    expect(i.lastOrderAt?.toISOString()).toBe('2024-05-03T00:00:00.000Z')
  })

  it('produces identical output whatever order the records arrive in', () => {
    const rows = [
      contact('j@example.net', 'standard', 'a.csv', {
        firstName: 'Jo',
        emailStatus: 'Active',
      }),
      contact('j@example.net', 'wholesale', 'b.csv', { emailStatus: 'Unsubscribed' }),
      contact('j@example.net', 'fundraising', 'c.csv', { firstName: 'Joanne' }),
    ]
    const forward = mergeArchiveContacts(rows, OPTS)
    const reversed = mergeArchiveContacts([...rows].reverse(), OPTS)
    expect(forward).toEqual(reversed)
    expect(forward[0].emailStatus).toBe('Unsubscribed')
    expect(forward[0].accountType).toBe('WHOLESALE')
  })

  it('returns customers sorted by email', () => {
    const merged = mergeArchiveContacts(
      [
        contact('z@example.net', 'standard', 'a.csv'),
        contact('a@example.net', 'standard', 'a.csv'),
      ],
      OPTS
    )
    expect(merged.map((m) => m.email)).toEqual(['a@example.net', 'z@example.net'])
  })
})
