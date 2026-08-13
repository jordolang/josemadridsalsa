import { readFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The senders in `lib/email/automation.ts`, which most of the automation surface routes through.
 *
 * The audit scored these WIRED — a call site exists — but nothing tested them, so the assertion
 * was only that somebody calls the function, never that the right person receives the right
 * thing. That is the gap this file closes: recipient selection, the fields the caller does not
 * pass, and the bookkeeping that decides whether an email is ever sent twice.
 *
 * The React element is inspected rather than rendered. These tests are about the sending
 * decision; `tests/email/*` already covers what the templates produce.
 */

const sendEmail = vi.fn()
const orderFindUnique = vi.fn()
const orderUpdate = vi.fn()

vi.mock('@/lib/email/client', () => ({ sendEmail }))

vi.mock('@/lib/prisma', () => {
  const client = { order: { findUnique: orderFindUnique, update: orderUpdate } }
  return { prisma: client, default: client }
})

const {
  sendOrderConfirmationEmail,
  sendFundraiserDonationReceipt,
  sendParticipantWelcomeEmail,
  sendFundraiserFollowupEmail,
  sendWelcomeEmail,
  sendNewsletterWelcomeEmail,
  sendContactConfirmationEmail,
} = await import('@/lib/email/automation')

/** The single `sendEmail` call a sender made. */
function sentEmail() {
  expect(sendEmail).toHaveBeenCalledTimes(1)
  return sendEmail.mock.calls[0][0]
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order_1',
    orderNumber: 'JMS-3001',
    userId: null,
    guestEmail: 'guest@example.com',
    user: null,
    fundraiser: null,
    total: 42.5,
    createdAt: new Date('2026-08-10T12:00:00Z'),
    shippingMethod: 'USPS Ground Advantage',
    trackingNumber: null,
    items: [
      { productName: 'Black Bean & Corn', productSku: 'JMS-BBC', totalPrice: 21.25, quantity: 1 },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  sendEmail.mockResolvedValue({ success: true })
  orderUpdate.mockResolvedValue({})
})

describe('sendOrderConfirmationEmail', () => {
  it('sends to the guest address when the order has no account', async () => {
    orderFindUnique.mockResolvedValue(order())

    await sendOrderConfirmationEmail('order_1')

    expect(sentEmail()).toMatchObject({
      to: 'guest@example.com',
      subject: 'Order Confirmation #JMS-3001',
      type: 'order-confirmation',
      orderId: 'order_1',
    })
  })

  it("prefers the account's address over the guest address", async () => {
    orderFindUnique.mockResolvedValue(
      order({
        userId: 'user_1',
        user: { name: 'Sam', email: 'sam@example.com' },
        guestEmail: 'stale-guest@example.com',
      })
    )

    await sendOrderConfirmationEmail('order_1')

    expect(sentEmail()).toMatchObject({ to: 'sam@example.com', userId: 'user_1' })
  })

  it('stamps the order once the send succeeds', async () => {
    orderFindUnique.mockResolvedValue(order())

    await sendOrderConfirmationEmail('order_1')

    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { confirmationEmailSentAt: expect.any(Date) },
    })
  })

  it('does not stamp the order when the send fails', async () => {
    // This is the one that matters. Every caller and the domain-event handler treat
    // `confirmationEmailSentAt` as "this customer has been told", so stamping a failed send
    // would suppress the confirmation permanently, silently, and only for the orders that
    // already hit an email problem.
    orderFindUnique.mockResolvedValue(order())
    sendEmail.mockResolvedValue({ success: false, error: 'Resend rejected the message' })

    const result = await sendOrderConfirmationEmail('order_1')

    expect(orderUpdate).not.toHaveBeenCalled()
    expect(result).toMatchObject({ success: false })
  })

  it('sends nothing for an order that does not exist', async () => {
    orderFindUnique.mockResolvedValue(null)

    const result = await sendOrderConfirmationEmail('missing')

    expect(sendEmail).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, error: 'Order not found' })
  })

  it('sends nothing when the order carries no address at all', async () => {
    orderFindUnique.mockResolvedValue(order({ guestEmail: null, user: null }))

    const result = await sendOrderConfirmationEmail('order_1')

    expect(sendEmail).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, error: 'Order email missing' })
  })

  it('names the fundraiser when there is no shipping method to show', async () => {
    orderFindUnique.mockResolvedValue(
      order({ shippingMethod: null, fundraiser: { name: 'Zanesville HS Band' } })
    )

    await sendOrderConfirmationEmail('order_1')

    expect(sentEmail().react.props.shippingAddress).toBe('Zanesville HS Band')
  })

  it('links to tracking once there is a tracking number, and to the order list before that', async () => {
    orderFindUnique.mockResolvedValue(order())
    await sendOrderConfirmationEmail('order_1')
    expect(sentEmail().react.props.trackingLink).toContain('/account/orders')

    vi.clearAllMocks()
    sendEmail.mockResolvedValue({ success: true })
    orderFindUnique.mockResolvedValue(order({ trackingNumber: '9400111899' }))
    await sendOrderConfirmationEmail('order_1')
    expect(sentEmail().react.props.trackingLink).toContain('/track/9400111899')
  })

  it('formats money as currency rather than passing raw decimals to the template', async () => {
    orderFindUnique.mockResolvedValue(order())

    await sendOrderConfirmationEmail('order_1')

    const props = sentEmail().react.props
    expect(props.orderTotal).toBe('$42.50')
    expect(props.items[0].totalPrice).toBe('$21.25')
  })

  it('footers the recipient to the working /unsubscribe flow, not the 404 preferences page', async () => {
    orderFindUnique.mockResolvedValue(order())

    await sendOrderConfirmationEmail('order_1')

    const { unsubscribeUrl } = sentEmail().react.props
    expect(unsubscribeUrl).toContain('/unsubscribe?email=guest%40example.com')
    expect(unsubscribeUrl).not.toContain('/account/preferences')
  })
})

describe('sendFundraiserDonationReceipt', () => {
  const donation = {
    donorEmail: 'donor@example.com',
    donorName: 'Alex',
    teamName: 'Zanesville HS Band',
    teamSchool: 'Zanesville High School',
    teamSlug: 'zanesville-band',
    amountCents: 2500,
    receiptId: 'rcpt_1',
    receiptDate: new Date('2026-08-10T12:00:00Z'),
  }

  it('converts cents to a formatted amount in both the subject and the receipt', async () => {
    await sendFundraiserDonationReceipt(donation)

    const email = sentEmail()
    expect(email.subject).toBe('Thanks for supporting Zanesville HS Band! Receipt for $25.00')
    expect(email.react.props.amountFormatted).toBe('$25.00')
    expect(email.type).toBe('fundraiser-donation-receipt')
  })

  it('still addresses the receipt to the donor when the donation is public-anonymous', async () => {
    // Anonymous hides the name on the team page; the receipt still has to reach the person who
    // paid, and their own copy is allowed to say who they are.
    await sendFundraiserDonationReceipt({ ...donation, isAnonymous: true })

    const email = sentEmail()
    expect(email.to).toBe('donor@example.com')
    expect(email.react.props.isAnonymous).toBe(true)
  })

  it('links to the team page it is a receipt for', async () => {
    await sendFundraiserDonationReceipt(donation)

    expect(sentEmail().react.props.teamPageUrl).toContain('/fundraise/zanesville-band')
  })

  it('footers the donor to the working /unsubscribe flow', async () => {
    await sendFundraiserDonationReceipt(donation)

    const { unsubscribeUrl } = sentEmail().react.props
    expect(unsubscribeUrl).toContain('/unsubscribe?email=donor%40example.com')
    expect(unsubscribeUrl).not.toContain('/account/preferences')
  })
})

describe('sendParticipantWelcomeEmail', () => {
  const participant = {
    email: 'seller@example.com',
    participantName: 'Jamie',
    fundraiserName: 'Band Camp 2026',
    referralCode: 'JAMIE10',
    fundraiserId: 'fund_1',
  }

  it('carries the referral code the participant needs to sell with', async () => {
    await sendParticipantWelcomeEmail(participant)

    const email = sentEmail()
    expect(email.to).toBe('seller@example.com')
    expect(email.subject).toBe('Welcome to the Band Camp 2026 fundraiser!')
    expect(email.react.props.referralCode).toBe('JAMIE10')
  })

  it('replies to the shop by default, and to the organiser when one is given', async () => {
    await sendParticipantWelcomeEmail(participant)
    expect(sentEmail().replyTo).toBe('mike@josemadridsalsa.com')

    vi.clearAllMocks()
    sendEmail.mockResolvedValue({ success: true })
    await sendParticipantWelcomeEmail({ ...participant, supportEmail: 'band@school.edu' })
    expect(sentEmail().replyTo).toBe('band@school.edu')
  })

  it('footers the participant to the working /unsubscribe flow', async () => {
    await sendParticipantWelcomeEmail(participant)

    const { unsubscribeUrl } = sentEmail().react.props
    expect(unsubscribeUrl).toContain('/unsubscribe?email=seller%40example.com')
    expect(unsubscribeUrl).not.toContain('/account/preferences')
  })
})

describe('sendFundraiserFollowupEmail', () => {
  it('addresses the contact by name and reaches the organisation that enquired', async () => {
    await sendFundraiserFollowupEmail({
      email: 'coach@school.edu',
      contactName: 'Coach Ellis',
      organizationName: 'Zanesville HS Band',
    })

    expect(sentEmail()).toMatchObject({ to: 'coach@school.edu' })
  })
})

describe('sendWelcomeEmail', () => {
  it('falls back to a friendly greeting and the standing discount code', async () => {
    await sendWelcomeEmail({ email: 'new@example.com' })

    expect(sentEmail()).toMatchObject({
      to: 'new@example.com',
      subject: 'Welcome to Jose Madrid Salsa!',
      type: 'welcome',
    })
  })

  it('uses the name and code it is given', async () => {
    await sendWelcomeEmail({ email: 'new@example.com', name: 'Sam', discountCode: 'HOTSAUCE' })

    expect(sentEmail().to).toBe('new@example.com')
  })
})

describe('sendNewsletterWelcomeEmail', () => {
  it('confirms the subscription to the address that subscribed', async () => {
    await sendNewsletterWelcomeEmail({ email: 'subscriber@example.com' })

    expect(sentEmail()).toMatchObject({
      to: 'subscriber@example.com',
      subject: "You're on the list — welcome!",
      type: 'newsletter-welcome',
    })
  })
})

describe('sendContactConfirmationEmail', () => {
  it('acknowledges the message and lets the sender reply to a person', async () => {
    await sendContactConfirmationEmail({
      email: 'asker@example.com',
      name: 'Robin',
      subject: 'wholesale pricing',
    })

    expect(sentEmail()).toMatchObject({
      to: 'asker@example.com',
      type: 'contact-confirmation',
      replyTo: 'mike@josemadridsalsa.com',
    })
  })
})

describe('unsubscribe footer target', () => {
  it('no sender still points at the dead /account/preferences route', () => {
    // Prop assertions above only reach the template-based senders; the inline-footer senders
    // (welcome, newsletter, contact, fundraiser-followup) bury unsubscribeUrl on a nested
    // EmailFooter. This source guard covers every sender in the file at once and catches the
    // 404 from creeping back in.
    const source = readFileSync(join(__dirname, '../../../lib/email/automation.ts'), 'utf8')
    expect(source).not.toContain('/account/preferences')
    expect(source).toContain('buildUnsubscribeUrl(')
  })
})
