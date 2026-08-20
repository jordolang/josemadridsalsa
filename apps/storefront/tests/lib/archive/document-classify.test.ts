import { describe, expect, it } from 'vitest'
import {
  classifySensitivity,
  parseArchiveYear,
} from '@/lib/archive/document-classify'

describe('classifySensitivity', () => {
  describe('content-based gating', () => {
    it('flags a document whose text contains an SSN, whatever its category', () => {
      // Real case: an SSN sat in 12 Correspondence, which no path rule covers,
      // so it survived into the production import as INTERNAL.
      expect(
        classifySensitivity(
          '12 Correspondence/Dear Sirs.docx',
          '12 Correspondence',
          'Please find enclosed. SSN 123-45-6789 for your records.'
        )
      ).toBe('SENSITIVE')
    })

    it('flags a spelled-out social security number', () => {
      expect(
        classifySensitivity('06 Products/notes.docx', '06 Products', 'Social Security Number: 123456789')
      ).toBe('SENSITIVE')
    })

    it('does not flag ordinary long digit runs', () => {
      // Order numbers, UPCs and tracking numbers must not trip the rule.
      expect(
        classifySensitivity(
          '03 Fundraisers/2024/order.xlsx',
          '03 Fundraisers',
          'Order 100238844991 shipped via 9400111899223817364531'
        )
      ).toBe('INTERNAL')
    })

    it('stays INTERNAL when no text is supplied', () => {
      expect(classifySensitivity('06 Products/label.png', '06 Products')).toBe('INTERNAL')
      expect(classifySensitivity('06 Products/label.png', '06 Products', null)).toBe('INTERNAL')
    })

    it('still gates by path even when the text is clean', () => {
      expect(
        classifySensitivity('02 Taxes/2024/return.pdf', '02 Taxes', 'nothing identifying here')
      ).toBe('SENSITIVE')
    })
  })

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

  it('marks QuickBooks company files and backups sensitive', () => {
    // A .qbw/.qbb is the whole general ledger; the folder name never says so.
    expect(
      classifySensitivity(
        '01 Financial/QuickBooks Desktop (legacy)/Jose Madrid Salsa.QBB',
        '01 Financial'
      )
    ).toBe('SENSITIVE')
    expect(
      classifySensitivity(
        '01 Financial/QuickBooks Desktop (legacy)/Michael Zakany LLC.QBW',
        '01 Financial'
      )
    ).toBe('SENSITIVE')
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
