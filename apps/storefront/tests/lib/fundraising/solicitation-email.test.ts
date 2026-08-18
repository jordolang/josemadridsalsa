import { describe, expect, it } from 'vitest'

import {
  buildSolicitationEmail,
  formatYears,
  historyLine,
  type SolicitationRecipient,
} from '@/lib/fundraising/solicitation-email'

function recipient(overrides: Partial<SolicitationRecipient> = {}): SolicitationRecipient {
  return {
    organizationName: 'Anderson HS Band',
    contactName: 'Pat Rivera',
    email: 'pat@anderson.org',
    totalJars: 1240,
    years: [2022, 2023],
    ...overrides,
  }
}

describe('formatYears', () => {
  it('reads as prose rather than an array dump', () => {
    expect(formatYears([2022])).toBe('2022')
    expect(formatYears([2022, 2023])).toBe('2022 and 2023')
    expect(formatYears([2023, 2021, 2022])).toBe('2021, 2022 and 2023')
    expect(formatYears([2022, 2022])).toBe('2022')
    expect(formatYears([])).toBe('')
  })
})

describe('historyLine', () => {
  it('states the jars and the years when both are known', () => {
    expect(historyLine(recipient())).toContain('sold 1,240 jars with us in 2022 and 2023')
  })

  it('omits the years when only the jar count survived', () => {
    const line = historyLine(recipient({ years: [] }))
    expect(line).toContain('sold 1,240 jars')
    expect(line).not.toContain('in ')
  })

  it('falls back to the years alone when no jar count survived', () => {
    expect(historyLine(recipient({ totalJars: 0 }))).toContain('ran a salsa fundraiser with us in')
  })

  it('says nothing rather than claiming zero jars for a mailing-list contact', () => {
    expect(historyLine(recipient({ totalJars: 0, years: [] }))).toBeNull()
  })
})

describe('buildSolicitationEmail', () => {
  it('greets a person by name', () => {
    expect(buildSolicitationEmail(recipient()).text).toContain('Hi Pat Rivera,')
  })

  it('does not greet an organization as if it were a person', () => {
    // The archive stores some coordinator cells as the group's own name.
    const mail = buildSolicitationEmail(recipient({ contactName: 'Anderson HS Band' }))
    expect(mail.text).toContain('Hello,')
    expect(mail.text).not.toContain('Hi Anderson HS Band')
  })

  it('greets generically when no contact name survived', () => {
    expect(buildSolicitationEmail(recipient({ contactName: null })).text).toContain('Hello,')
  })

  it('carries a working one-click unsubscribe in both the header and the body', () => {
    const mail = buildSolicitationEmail(recipient())
    const header = mail.headers['List-Unsubscribe']

    expect(header).toMatch(/^<https?:\/\/.+\/unsubscribe\?email=.+&token=.+>$/)
    expect(mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    // Header and footer must resolve to the same link, or an unsubscribe click and a
    // one-click unsubscribe would record different things.
    const url = header.slice(1, -1)
    expect(mail.text).toContain(url)
    expect(mail.html).toContain(url)
  })

  it('includes the postal address CAN-SPAM requires', () => {
    const mail = buildSolicitationEmail(recipient())
    expect(mail.text).toContain('Zanesville')
    expect(mail.html).toContain('Zanesville')
  })

  it('says why the recipient is being emailed', () => {
    const mail = buildSolicitationEmail(recipient())
    expect(mail.text).toContain('You are receiving this because')
    expect(mail.html).toContain('previously ran a fundraiser')
  })

  it('escapes an organization name so it cannot inject markup', () => {
    const mail = buildSolicitationEmail(
      recipient({ organizationName: '<script>alert(1)</script> Band' }),
    )
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('personalizes the history for a contact that has one', () => {
    expect(buildSolicitationEmail(recipient()).html).toContain('1,240 jars')
  })

  it('still produces a complete email for a contact with no history', () => {
    const mail = buildSolicitationEmail(recipient({ totalJars: 0, years: [] }))
    expect(mail.subject).toBeTruthy()
    expect(mail.text).toContain('has fundraised with Jose Madrid Salsa before')
    expect(mail.html).toContain('has fundraised with Jose Madrid Salsa before')
  })
})
