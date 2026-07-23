import { describe, expect, it } from 'vitest'
import { detectMapping, mappedCell, parseCsv, toCsv } from '@/lib/csv'

describe('toCsv', () => {
  it('quotes every cell and joins with CRLF', () => {
    const out = toCsv(['A', 'B'], [['1', '2']])
    expect(out).toBe('"A","B"\r\n"1","2"')
  })

  it('escapes embedded quotes by doubling them', () => {
    const out = toCsv(['Name'], [['She said "hi"']])
    expect(out).toBe('"Name"\r\n"She said ""hi"""')
  })

  it('preserves commas and newlines inside a cell', () => {
    const out = toCsv(['V'], [['a,b\nc']])
    // The whole value stays within one quoted field.
    expect(out).toBe('"V"\r\n"a,b\nc"')
  })

  it('renders null/undefined as empty strings and stringifies numbers', () => {
    const out = toCsv(['a', 'b', 'c'], [[null, undefined, 42]])
    expect(out).toBe('"a","b","c"\r\n"","","42"')
  })

  it('round-trips a tricky value back through the parser', () => {
    const value = 'quote " comma , newline \n end'
    const csv = toCsv(['field'], [[value]])
    const { rows } = parseCsv(csv)
    expect(rows[0].field).toBe(value)
  })
})

describe('parseCsv', () => {
  it('returns trimmed headers and header-keyed rows', () => {
    const { headers, rows } = parseCsv(' Email , Name \na@b.com,Ann\n')
    expect(headers).toEqual(['Email', 'Name'])
    expect(rows[0]).toEqual({ Email: 'a@b.com', Name: 'Ann' })
  })

  it('skips blank lines', () => {
    const { rows } = parseCsv('Email\n\na@b.com\n\n')
    expect(rows).toHaveLength(1)
  })
})

describe('detectMapping', () => {
  const aliases = {
    email: ['emailaddress', 'email'],
    firstName: ['firstname', 'first'],
  }

  it('prefers exact alias matches over partial ones', () => {
    const mapping = detectMapping(['First Name', 'First Contact'], aliases)
    expect(mapping.firstName).toBe('First Name')
  })

  it('claims each header for at most one field', () => {
    const mapping = detectMapping(['Email Address'], aliases)
    expect(mapping.email).toBe('Email Address')
    expect(mapping.firstName).toBeUndefined()
  })

  it('normalizes punctuation and case when matching', () => {
    const mapping = detectMapping(['E-mail Address'], aliases)
    expect(mapping.email).toBe('E-mail Address')
  })
})

describe('mappedCell', () => {
  it('returns null for an unmapped or empty column', () => {
    expect(mappedCell({ a: 'x' }, undefined)).toBeNull()
    expect(mappedCell({ a: '   ' }, 'a')).toBeNull()
  })

  it('trims the mapped value', () => {
    expect(mappedCell({ a: '  hi  ' }, 'a')).toBe('hi')
  })
})
