import { describe, expect, it } from 'vitest'
import {
  customerDisplayName,
  parseCustomerCsv,
} from '@/lib/customers/customer-import'

/** The Constant Contact export header we already have on file. */
const CC_HEADER =
  'Email address,First name,Last name,Email status,Email permission status,Source Name,Created At'

describe('parseCustomerCsv', () => {
  it('auto-detects the Constant Contact export columns', () => {
    const csv = `${CC_HEADER}\njholderman.jh@gmail.com,Janette,Holderman,Active,Express,BigCommerce,2021-11-15 19:42:23 +0000\n`
    const { mapping, rows, missingRequired } = parseCustomerCsv(csv)

    expect(missingRequired).toEqual([])
    expect(mapping.email).toBe('Email address')
    expect(mapping.firstName).toBe('First name')
    expect(rows[0]).toMatchObject({
      email: 'jholderman.jh@gmail.com',
      firstName: 'Janette',
      lastName: 'Holderman',
      emailStatus: 'Active',
      emailPermissionStatus: 'Express',
      sourceName: 'BigCommerce',
      error: null,
    })
  })

  it('lowercases the email so it is a stable upsert key', () => {
    const { rows } = parseCustomerCsv(`${CC_HEADER}\nMixed@CASE.com,,,,,,`)
    expect(rows[0].email).toBe('mixed@case.com')
  })

  it('flags a missing email', () => {
    const { rows } = parseCustomerCsv(`${CC_HEADER}\n,No,Email,,,,`)
    expect(rows[0].error).toBe('Missing email')
  })

  it('flags a malformed email', () => {
    const { rows } = parseCustomerCsv(`${CC_HEADER}\nnot-an-email,,,,,,`)
    expect(rows[0].error).toMatch(/Invalid email/)
  })

  it('reports email as missing-required when no column maps to it', () => {
    const { missingRequired } = parseCustomerCsv('Name,City\nAnn,Zanesville')
    expect(missingRequired).toEqual(['email'])
  })

  it('honors a manual mapping override', () => {
    const csv = 'Contact,Primary\nAda Lovelace,ada@calc.org'
    const { rows } = parseCustomerCsv(csv, { email: 'Primary', firstName: 'Contact' })
    expect(rows[0]).toMatchObject({ email: 'ada@calc.org', firstName: 'Ada Lovelace' })
  })
})

describe('customerDisplayName', () => {
  it('joins first and last name', () => {
    expect(customerDisplayName({ firstName: 'Ann', lastName: 'Herlocher' })).toBe(
      'Ann Herlocher'
    )
  })

  it('returns null when both parts are missing', () => {
    expect(customerDisplayName({ firstName: null, lastName: null })).toBeNull()
  })
})
