import { describe, expect, it } from 'vitest'
import { parseUserCsv } from '@/lib/users/user-import'

const HEADER = 'Email,Name,Phone,Role'

describe('parseUserCsv', () => {
  it('maps the users-export columns and lowercases email', () => {
    const { rows, missingRequired } = parseUserCsv(
      `${HEADER}\nAda@Calc.org,Ada Lovelace,555-1234,CUSTOMER`
    )
    expect(missingRequired).toEqual([])
    expect(rows[0]).toMatchObject({
      email: 'ada@calc.org',
      name: 'Ada Lovelace',
      phone: '555-1234',
      role: 'CUSTOMER',
      error: null,
    })
  })

  it('defaults an unspecified role to CUSTOMER', () => {
    const { rows } = parseUserCsv(`${HEADER}\na@b.org,Ann,,`)
    expect(rows[0].role).toBe('CUSTOMER')
    expect(rows[0].error).toBeNull()
  })

  it('accepts WHOLESALE and FUNDRAISER roles', () => {
    const { rows } = parseUserCsv(
      `${HEADER}\na@b.org,A,,wholesale\nc@d.org,C,,Fundraiser`
    )
    expect(rows[0].role).toBe('WHOLESALE')
    expect(rows[1].role).toBe('FUNDRAISER')
  })

  it('rejects rows requesting a privileged role', () => {
    const { rows } = parseUserCsv(`${HEADER}\nhacker@evil.org,H,,ADMIN`)
    expect(rows[0].error).toMatch(/can't be assigned by import/)
  })

  it('rejects an unknown role', () => {
    const { rows } = parseUserCsv(`${HEADER}\na@b.org,A,,wizard`)
    expect(rows[0].error).toMatch(/Unknown role/)
  })

  it('flags a missing email column as required', () => {
    const { missingRequired } = parseUserCsv('Name,Phone\nAnn,555')
    expect(missingRequired).toEqual(['email'])
  })
})
