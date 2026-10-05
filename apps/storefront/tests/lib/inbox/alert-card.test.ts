import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {}, default: {} }))

const { emailAlertDetails } = await import('@/lib/inbox/alert-card')
const { TRIAGE_FAILED_SUMMARY } = await import('@/lib/inbox/classifier')

function email(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    gmailThreadId: '1a10e17232838f69',
    fromEmail: 'help@auniva.co',
    fromName: 'Auniva (formerly Alevia)',
    subject: "B12 didn't fix your neuropathy",
    category: 'GENERAL_QUESTION',
    confidence: 0,
    summary: TRIAGE_FAILED_SUMMARY,
    autoReplySent: false,
    steps: [
      { position: 1, instruction: 'Decide what the customer needs and do it.', isOptional: false, completedAt: null },
      { position: 0, instruction: 'Open the email in Gmail and read it in full.', isOptional: false, completedAt: new Date() },
      { position: 2, instruction: 'Reply to the customer.', isOptional: true, completedAt: null },
    ],
    ...overrides,
  } as unknown as Parameters<typeof emailAlertDetails>[0]
}

describe('emailAlertDetails', () => {
  it('splits a failed-triage alert into its parts', () => {
    const details = emailAlertDetails(email())

    expect(details.heading).toBe('General Question from Auniva (formerly Alevia)')
    expect(details.from).toBe('Auniva (formerly Alevia) <help@auniva.co>')
    expect(details.subject).toBe("B12 didn't fix your neuropathy")
    expect(details.summary).toBeNull()
    expect(details.gmailUrl).toBe('https://mail.google.com/mail/u/0/#all/1a10e17232838f69')
    expect(details.classification).toBe('Anthropic Classification Not Available')
  })

  it('orders steps by position and marks the finished ones', () => {
    expect(emailAlertDetails(email()).steps).toEqual([
      { instruction: 'Open the email in Gmail and read it in full.', isOptional: false, done: true },
      { instruction: 'Decide what the customer needs and do it.', isOptional: false, done: false },
      { instruction: 'Reply to the customer.', isOptional: true, done: false },
    ])
  })

  it('reports the confidence and summary when Anthropic read the email', () => {
    const details = emailAlertDetails(
      email({ confidence: 82, summary: 'Wants to know when the order ships', category: 'ORDER_STATUS' }),
    )
    expect(details.classification).toBe('Classified by Anthropic (82% confidence)')
    expect(details.summary).toBe('Wants to know when the order ships')
    expect(details.heading).toBe('Order Status from Auniva (formerly Alevia)')
  })

  it('says when the email was answered automatically', () => {
    const details = emailAlertDetails(email({ confidence: 95, summary: 'Hours', autoReplySent: true }))
    expect(details.classification).toBe('Answered automatically by Anthropic')
  })

  it('falls back to the bare address when there is no sender name', () => {
    const details = emailAlertDetails(email({ fromName: null }))
    expect(details.heading).toBe('General Question from help@auniva.co')
    expect(details.from).toBe('help@auniva.co')
  })
})
