import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The transactional senders — cancellation, refund, review request, pickup, gift certificate.
 *
 * These build their message by substituting variables into a stored template, which is the part
 * that fails quietly: a missing variable does not throw, it ships a placeholder to the customer.
 * The assertions below are mostly "no `{{TOKEN}}` survived", plus the unsubscribe footer every
 * one of them is obliged to carry.
 */

const sendEmail = vi.fn()

vi.mock('@/lib/email/sender', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/sender')>()
  // The real `substituteVariables` is kept: it is the behaviour under test.
  return { ...actual, sendEmail }
})

const {
  sendOrderCancellationEmail,
  sendRefundProcessedEmail,
  sendReviewRequestEmail,
  sendOrderReadyForPickupEmail,
  sendGiftCertificateDeliveryEmail,
} = await import('@/lib/email/transactional')

function sentEmail() {
  expect(sendEmail).toHaveBeenCalledTimes(1)
  return sendEmail.mock.calls[0][0]
}

/** Every field the customer can see, so an unsubstituted token cannot hide in one of them. */
function visibleText(email: { subject: string; html: string; text: string }) {
  return [email.subject, email.html, email.text].join('\n')
}

beforeEach(() => {
  vi.clearAllMocks()
  sendEmail.mockResolvedValue(undefined)
})

describe('sendOrderCancellationEmail', () => {
  it('addresses the customer and names the cancelled order', async () => {
    await sendOrderCancellationEmail({
      email: 'buyer@example.com',
      name: 'Sam',
      orderNumber: 'JMS-4001',
    })

    const email = sentEmail()
    expect(email.to).toBe('buyer@example.com')
    expect(visibleText(email)).toContain('JMS-4001')
  })

  it('leaves no unsubstituted template tokens in anything the customer reads', async () => {
    await sendOrderCancellationEmail({
      email: 'buyer@example.com',
      name: 'Sam',
      orderNumber: 'JMS-4001',
    })

    expect(visibleText(sentEmail())).not.toMatch(/\{\{\s*\w+\s*\}\}/)
  })

  it('carries an unsubscribe link for the address it is sent to', async () => {
    await sendOrderCancellationEmail({
      email: 'buyer+tag@example.com',
      name: 'Sam',
      orderNumber: 'JMS-4001',
    })

    // Encoded, because a raw `+` in a query string reads as a space and unsubscribes nobody.
    expect(sentEmail().html).toContain('buyer%2Btag%40example.com')
  })
})

describe('sendRefundProcessedEmail', () => {
  const refund = {
    email: 'buyer@example.com',
    name: 'Sam',
    orderNumber: 'JMS-4002',
    refundAmount: '$24.00',
    refundMethod: 'Visa ending 4242',
    originalOrderDate: 'August 1, 2026',
  }

  it('tells the customer the amount and where it is going back to', async () => {
    await sendRefundProcessedEmail(refund)

    const text = visibleText(sentEmail())
    expect(text).toContain('$24.00')
    expect(text).toContain('Visa ending 4242')
  })

  it('sets the expectation of when the money lands', async () => {
    await sendRefundProcessedEmail(refund)

    // A refund email that omits the settlement window generates the support ticket it exists
    // to prevent.
    expect(visibleText(sentEmail())).toContain('3–5 business days')
  })

  it('leaves no unsubstituted template tokens', async () => {
    await sendRefundProcessedEmail(refund)

    expect(visibleText(sentEmail())).not.toMatch(/\{\{\s*\w+\s*\}\}/)
  })
})

describe('sendReviewRequestEmail', () => {
  it('links to the review form for that order', async () => {
    await sendReviewRequestEmail({
      email: 'buyer@example.com',
      name: 'Sam',
      orderNumber: 'JMS-4003',
      productName: 'Black Bean & Corn',
    })

    const email = sentEmail()
    expect(visibleText(email)).toContain('/account/orders/JMS-4003/review')
    expect(visibleText(email)).toContain('Black Bean & Corn')
  })

  it('leaves no unsubstituted template tokens', async () => {
    await sendReviewRequestEmail({
      email: 'buyer@example.com',
      name: 'Sam',
      orderNumber: 'JMS-4003',
      productName: 'Black Bean & Corn',
    })

    expect(visibleText(sentEmail())).not.toMatch(/\{\{\s*\w+\s*\}\}/)
  })
})

describe('sendOrderReadyForPickupEmail', () => {
  it('falls back to the shop address and hours when the caller gives none', async () => {
    await sendOrderReadyForPickupEmail({
      email: 'buyer@example.com',
      name: 'Sam',
      orderNumber: 'JMS-4004',
    })

    const text = visibleText(sentEmail())
    expect(text).toContain('Zanesville')
    expect(text).toContain('Mon–Fri')
  })

  it('uses the location it is given', async () => {
    await sendOrderReadyForPickupEmail({
      email: 'buyer@example.com',
      name: 'Sam',
      orderNumber: 'JMS-4004',
      pickupLocation: 'Farmers Market stall 12',
      pickupHours: 'Saturday 8am–1pm',
    })

    const text = visibleText(sentEmail())
    expect(text).toContain('Farmers Market stall 12')
    expect(text).toContain('Saturday 8am–1pm')
  })
})

describe('sendGiftCertificateDeliveryEmail', () => {
  it('delivers the code to the recipient rather than to the purchaser', async () => {
    await sendGiftCertificateDeliveryEmail({
      recipientEmail: 'recipient@example.com',
      recipientName: 'Robin',
      purchaserName: 'Sam',
      code: 'GC-ABCD-1234',
      amount: '$50.00',
    })

    const email = sentEmail()
    expect(email.to).toBe('recipient@example.com')
    expect(visibleText(email)).toContain('GC-ABCD-1234')
    expect(visibleText(email)).toContain('$50.00')
  })

  it('leaves no unsubstituted template tokens when the optional message is omitted', async () => {
    await sendGiftCertificateDeliveryEmail({
      recipientEmail: 'recipient@example.com',
      recipientName: 'Robin',
      purchaserName: 'Sam',
      code: 'GC-ABCD-1234',
      amount: '$50.00',
    })

    expect(visibleText(sentEmail())).not.toMatch(/\{\{\s*\w+\s*\}\}/)
  })
})
