import { describe, it, expect } from 'vitest'
import { DATA_ERASURE_EMAILS, canEraseData } from '@/lib/developer/constants'

describe('canEraseData', () => {
  it('allows the two owner accounts', () => {
    expect(canEraseData('jordolang@gmail.com')).toBe(true)
    expect(canEraseData('mike@josemadridsalsa.com')).toBe(true)
  })

  it('ignores case and surrounding whitespace', () => {
    expect(canEraseData('Mike@JoseMadridSalsa.com')).toBe(true)
    expect(canEraseData('  jordolang@gmail.com  ')).toBe(true)
  })

  it('refuses every other account, including other admins', () => {
    expect(canEraseData('staff@josemadridsalsa.com')).toBe(false)
    expect(canEraseData('someone-else@example.com')).toBe(false)
  })

  it('refuses a missing email rather than defaulting open', () => {
    expect(canEraseData(null)).toBe(false)
    expect(canEraseData(undefined)).toBe(false)
    expect(canEraseData('')).toBe(false)
  })

  it('does not match on a lookalike or embedded address', () => {
    expect(canEraseData('mike@josemadridsalsa.com.evil.com')).toBe(false)
    expect(canEraseData('xjordolang@gmail.com')).toBe(false)
  })

  it('lists exactly the two owner accounts', () => {
    expect([...DATA_ERASURE_EMAILS]).toEqual(['jordolang@gmail.com', 'mike@josemadridsalsa.com'])
  })
})
