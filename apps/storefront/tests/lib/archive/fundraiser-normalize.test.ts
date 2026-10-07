import { describe, expect, it } from 'vitest'
import {
  cleanOrgName,
  isBusinessEmail,
  looksLikeSalsaFlavors,
  normalizeFundraiser,
  parseFormDate,
  type RawFundraiser,
} from '@/lib/archive/fundraiser-normalize'

describe('cleanOrgName', () => {
  it('strips trailing dates and keywords', () => {
    expect(cleanOrgName('Morgan hs marching band 5-20-24')).toBe('Morgan hs marching band')
    expect(cleanOrgName('HKMS order 12-2-24')).toBe('HKMS')
    expect(cleanOrgName('youth foundation sales 9-30-27')).toBe('youth foundation')
    expect(cleanOrgName('Oak Harbor Marine Science Order (2024)')).toBe('Oak Harbor Marine Science')
  })

  it('leaves a clean name untouched', () => {
    expect(cleanOrgName('Wilmington College')).toBe('Wilmington College')
  })

  it('never returns an empty string', () => {
    expect(cleanOrgName('2024')).toBe('2024')
  })
})

describe('parseFormDate', () => {
  it('parses MM/DD/YYYY', () => {
    expect(parseFormDate('11/12/2025')).toBe('2025-11-12')
    expect(parseFormDate('4/8/25')).toBe('2025-04-08')
  })
  it('parses "Month D, YYYY"', () => {
    expect(parseFormDate('April 8, 2025')).toBe('2025-04-08')
  })
  it('returns null for blanks and junk', () => {
    expect(parseFormDate('')).toBeNull()
    expect(parseFormDate('sometime')).toBeNull()
    expect(parseFormDate(null)).toBeNull()
  })
})

describe('isBusinessEmail', () => {
  it('flags Jose Madrid addresses', () => {
    expect(isBusinessEmail('mike@josemadridsalsa.com and mail check')).toBe(true)
    expect(isBusinessEmail('info@josemadridsalsa.com')).toBe(true)
  })
  it('passes a real organizer email', () => {
    expect(isBusinessEmail('gerard.grimm@school.org')).toBe(false)
  })
})

describe('normalizeFundraiser', () => {
  const exportRaw: RawFundraiser = {
    sourceFile: '03 Fundraisers/2021/BGSU Equestrian/BGSU Sales.xlsx',
    sourceMd5: 'm1',
    year: 2021,
    folderOrg: 'BGSU Equestrian',
    fileBase: 'BGSU Sales 11-17-21',
    shape: 'ORDER_EXPORT',
    orderCount: 25,
    totalJars: 164,
    dateMin: '2021-10-14T00:00:00',
    dateMax: '2021-11-10T00:00:00',
    groupName: "BGSU Equestrian Fall '21",
  }

  it('summarizes an order-export, preferring the group name and latest date', () => {
    const n = normalizeFundraiser(exportRaw)
    expect(n.organizationName).toBe("BGSU Equestrian Fall '21")
    expect(n.formType).toBe('ORDER_EXPORT')
    expect(n.totalJars).toBe(164)
    expect(n.orderCount).toBe(25)
    expect(n.orderDate).toBe('2021-11-10')
    expect(n.year).toBe(2021)
  })

  const formRaw: RawFundraiser = {
    sourceFile: '03 Fundraisers/2025/Southern Local.xlsx',
    sourceMd5: 'm2',
    year: 2025,
    folderOrg: null,
    fileBase: 'Southern Local - 2025 JMS Fundraiser Order Form',
    shape: 'ORDER_FORM',
    labels: {
      organization: 'Southern Local High School',
      date: '11/12/2025',
      'submitted by': 'Gerard Grimm',
      'e-mail': 'gerard.grimm@school.org',
      phone: '3306798921',
    },
    flavors: { 'Raspberry Mild': 17, 'Peach Mild': 16, 'Strawberry Mild': 11 },
    totalJars: 44,
  }

  it('summarizes an order-form template with labels and flavors', () => {
    const n = normalizeFundraiser(formRaw)
    expect(n.organizationName).toBe('Southern Local High School')
    expect(n.orderDate).toBe('2025-11-12')
    expect(n.submittedBy).toBe('Gerard Grimm')
    expect(n.contactEmail).toBe('gerard.grimm@school.org')
    expect(n.contactPhone).toBe('3306798921')
    expect(n.totalJars).toBe(44)
    expect(n.flavorsJson).toEqual({ 'Raspberry Mild': 17, 'Peach Mild': 16, 'Strawberry Mild': 11 })
  })

  it('drops Jose Madrid\'s own email off the blank template', () => {
    const n = normalizeFundraiser({
      sourceFile: '03 Fundraisers/$6.00 forms/order form $6.xlsx',
      sourceMd5: 'm3',
      year: null,
      folderOrg: '$6.00 forms',
      fileBase: 'order form $6',
      shape: 'ORDER_FORM',
      labels: { 'e-mail': 'mike@josemadridsalsa.com and mail check' },
      flavors: {},
    })
    expect(n.contactEmail).toBeNull()
    expect(n.notes).toMatch(/blank order-form template/i)
    // A template folder must not become the org name.
    expect(n.organizationName).toBe('order form $6')
  })
})

describe('looksLikeSalsaFlavors', () => {
  it('accepts the order-form template, whose flavors all name a heat level', () => {
    expect(
      looksLikeSalsaFlavors({
        'Raspberry Mild': 34,
        'Peach Mild': 41,
        'Cherry Chocolate Hot': 4,
        'Mango Habanero Hot': 22,
      })
    ).toBe(true)
  })

  it('rejects coordinator names picked up off a tracking sheet', () => {
    expect(looksLikeSalsaFlavors({ Randy: 6, Cheryl: 9078, Karen: 19249 })).toBe(false)
    expect(looksLikeSalsaFlavors({ 'Mandy Boyd': 2023, 'Miranda Galloway': 7214 })).toBe(false)
  })

  it('rejects an empty column set', () => {
    expect(looksLikeSalsaFlavors({})).toBe(false)
  })
})

describe('normalizeFundraiser — multi-campaign tracking sheets', () => {
  // "5 year completed JMSFundraisers.xlsx" alone claimed 7,172,093 jars: the
  // extractor read a roster of coordinators as one campaign's flavor columns.
  const trackingRaw: RawFundraiser = {
    sourceFile: '03 Fundraisers/Undated/5 year completed JMSFundraisers.xlsx',
    sourceMd5: 'm3',
    year: null,
    folderOrg: null,
    fileBase: '5 year completed JMSFundraisers',
    shape: 'ORDER_FORM',
    totalJars: 7172093,
    labels: { organization: 'Moundbuilders DeMolay' },
    flavors: { Randy: 6, Cheryl: 9078, Karen: 19249, Amanda: 45769 },
  }

  it('demotes the sheet to UNKNOWN and drops its rolled-up figures', () => {
    const n = normalizeFundraiser(trackingRaw)
    expect(n.formType).toBe('UNKNOWN')
    expect(n.totalJars).toBeNull()
    expect(n.orderCount).toBeNull()
    expect(n.flavorsJson).toBeNull()
    expect(n.notes).toMatch(/tracking sheet/i)
  })

  it('leaves a genuine order form untouched', () => {
    const n = normalizeFundraiser({
      ...trackingRaw,
      sourceFile: '03 Fundraisers/2021/Tinora/Tinora Order 4-23-21.xlsx',
      totalJars: 690,
      labels: { organization: 'Tinora Middle School', date: '4/23/21' },
      flavors: { 'Raspberry Mild': 34, 'Peach Mild': 41, 'Cherry Hot': 16 },
    })
    expect(n.formType).toBe('ORDER_FORM')
    expect(n.totalJars).toBe(690)
    expect(n.notes).toBeNull()
  })
})
