import { describe, expect, it } from 'vitest'
import { parseFundraiserCsv, slugify } from '@/lib/fundraisers/fundraiser-import'

const HEADER =
  'Name,Organization,Contact Email,Start Date,End Date,Commission Rate,Goal'

const ROW = 'Spring Band Drive,Zanesville HS,band@zhs.org,03/01/2019,04/15/2019,10,5000'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Spring 2019 Band Drive!')).toBe('spring-2019-band-drive')
  })
})

describe('parseFundraiserCsv', () => {
  it('maps a typical spreadsheet and parses values', () => {
    const { rows, missingRequired } = parseFundraiserCsv(`${HEADER}\n${ROW}`)
    expect(missingRequired).toEqual([])
    expect(rows[0]).toMatchObject({
      name: 'Spring Band Drive',
      slug: 'spring-band-drive',
      organizationName: 'Zanesville HS',
      contactEmail: 'band@zhs.org',
      goal: 5000,
      commissionRate: 10,
      status: 'DRAFT',
      error: null,
    })
    expect(rows[0].startDate?.getFullYear()).toBe(2019)
  })

  it('generates a slug from the name when no slug column exists', () => {
    const { rows } = parseFundraiserCsv(`${HEADER}\n${ROW}`)
    expect(rows[0].slug).toBe('spring-band-drive')
  })

  it('rejects an end date before the start date', () => {
    const bad =
      'Fall Drive,Org,a@b.org,04/15/2019,03/01/2019,10,'
    const { rows } = parseFundraiserCsv(`${HEADER}\n${bad}`)
    expect(rows[0].error).toMatch(/before start/)
  })

  it('flags a missing commission rate', () => {
    const bad = 'Drive,Org,a@b.org,03/01/2019,04/15/2019,,'
    const { rows } = parseFundraiserCsv(`${HEADER}\n${bad}`)
    expect(rows[0].error).toMatch(/commission/)
  })

  it('normalizes an unknown status to DRAFT and keeps known ones', () => {
    const withStatus = `${HEADER},Status\n${ROW},active`
    const { rows } = parseFundraiserCsv(withStatus)
    expect(rows[0].status).toBe('ACTIVE')

    const bogus = `${HEADER},Status\n${ROW},whoknows`
    expect(parseFundraiserCsv(bogus).rows[0].status).toBe('DRAFT')
  })

  it('lists required fields with no column mapped', () => {
    const { missingRequired } = parseFundraiserCsv('Foo,Bar\n1,2')
    expect(missingRequired).toEqual(
      expect.arrayContaining(['name', 'organizationName', 'contactEmail'])
    )
  })
})
