import { z } from 'zod'

/**
 * Input for the public order-tracking lookup.
 *
 * A customer finds an order one of two ways: the order number plus a phone number on that
 * order (which unlocks the full history), or a carrier tracking number alone (which only
 * shows the shipment, because tracking numbers get printed on boxes and shared freely).
 */
export const orderLookupSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('order'),
    orderNumber: z
      .string()
      .trim()
      .min(1, 'Enter your order number.')
      .max(40, 'That order number is too long.')
      .transform((value) => value.replace(/^#/, '').toUpperCase()),
    phone: z
      .string()
      .trim()
      .min(1, 'Enter the phone number on the order.')
      .max(30, 'That phone number is too long.'),
  }),
  z.object({
    method: z.literal('tracking'),
    trackingNumber: z
      .string()
      .trim()
      .min(6, 'Enter the full tracking number.')
      .max(60, 'That tracking number is too long.')
      .regex(/^[A-Za-z0-9 -]+$/, 'Tracking numbers only contain letters and numbers.')
      .transform((value) => value.replace(/[\s-]/g, '').toUpperCase()),
  }),
])

export type OrderLookupInput = z.infer<typeof orderLookupSchema>

/**
 * Reduce a phone number to its last ten digits, so "(740) 555-1234", "740.555.1234" and
 * "+1 740 555 1234" all compare equal. Returns null when fewer than ten digits remain,
 * because a shorter match would be too easy to guess.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.slice(-10)
}

/** Format a US number as E.164 (+1XXXXXXXXXX) for storage and sending. */
export function toE164(value: string): string | null {
  const ten = normalizePhone(value)
  return ten ? `+1${ten}` : null
}

/** True when the entered phone matches any phone recorded on the order. */
export function phoneMatchesOrder(
  entered: string,
  orderPhones: Array<string | null | undefined>
): boolean {
  const target = normalizePhone(entered)
  if (!target) return false
  return orderPhones.some((phone) => normalizePhone(phone) === target)
}

export const smsSignupSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  token: z.string().trim().min(1).max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((value) => normalizePhone(value) !== null, 'Enter a 10-digit US phone number.'),
  consent: z.literal(true, { message: 'Check the box to agree to receive texts.' }),
})

/** Shown beside the opt-in box and stored with every subscription as proof of consent. */
export const SMS_CONSENT_TEXT =
  'I agree to receive automated text messages from Jose Madrid Salsa about the status of this order. ' +
  'Message frequency varies. Message and data rates may apply. Reply STOP to cancel, HELP for help. ' +
  'Consent is not a condition of purchase.'
