import { describe, expect, it } from 'vitest'
import {
  classifySensitivity,
  parseArchiveYear,
} from '@/lib/archive/document-classify'

describe('classifySensitivity', () => {
  it('marks the whole HR and Taxes folders sensitive', () => {
    expect(classifySensitivity('10 People & HR/Chrissy Child Support.docx', '10 People & HR')).toBe('SENSITIVE')
    expect(classifySensitivity('02 Taxes/2024/return.pdf', '02 Taxes')).toBe('SENSITIVE')
  })

  it('marks financial account-level subfolders sensitive', () => {
    expect(classifySensitivity('01 Financial/Bank Statements/chase-jan.pdf', '01 Financial')).toBe('SENSITIVE')
    expect(classifySensitivity('01 Financial/POS & 1099-K/2022.pdf', '01 Financial')).toBe('SENSITIVE')
  })

  it('catches sensitive keywords regardless of folder', () => {
    expect(classifySensitivity('12 Correspondence/Kevin W-2.pdf', '12 Correspondence')).toBe('SENSITIVE')
    expect(classifySensitivity('99 System & Misc/old resume.docx', '99 System & Misc')).toBe('SENSITIVE')
    expect(classifySensitivity('03 Fundraisers/2024/1099 form.pdf', '03 Fundraisers')).toBe('SENSITIVE')
  })

  it('leaves ordinary business files internal, not sensitive', () => {
    expect(classifySensitivity('06 Products/labels/mango.pdf', '06 Products')).toBe('INTERNAL')
    expect(classifySensitivity('01 Financial/Mileage/2020/Master.xlsx', '01 Financial')).toBe('INTERNAL')
    expect(classifySensitivity('04 Shows & Events/2024/app.pdf', '04 Shows & Events')).toBe('INTERNAL')
  })

  it('does not treat a mid-word coincidence as a bank statement', () => {
    // "banking" the folder is sensitive, but an unrelated word should not trip it
    expect(classifySensitivity('08 Marketing/brochure.pdf', '08 Marketing')).toBe('INTERNAL')
  })
})

describe('parseArchiveYear', () => {
  it('reads a YYYY path segment', () => {
    expect(parseArchiveYear('03 Fundraisers/2024/Troop 273/order.pdf')).toBe(2024)
    expect(parseArchiveYear('01 Financial/Mileage/2020/Master.xlsx')).toBe(2020)
  })

  it('returns null when the file is not filed by year', () => {
    expect(parseArchiveYear('06 Products/labels/mango.pdf')).toBeNull()
  })

  it('does not mistake a long number for a year', () => {
    expect(parseArchiveYear('04 Shows & Events/contact_export_1123721182794.csv')).toBeNull()
  })
})
