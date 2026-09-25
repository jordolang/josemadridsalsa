import { sendEmail, substituteVariables } from './sender'
import { orderCancellationTemplate } from './templates/order-cancellation'
import { refundProcessedTemplate } from './templates/refund-processed'
import { reviewRequestTemplate } from './templates/review-request'
import { giftCertificateDeliveryTemplate } from './templates/gift-certificate-delivery'
import { orderReadyPickupTemplate } from './templates/order-ready-pickup'
import { SITE_URL } from '@/lib/site-url'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? SITE_URL

function footerVars(email: string) {
  return {
    UNSUBSCRIBE_URL: `${BASE_URL}/unsubscribe?email=${encodeURIComponent(email)}`,
    NEWSLETTER_PREFERENCES_URL: `${BASE_URL}/account/settings`,
    VIEW_IN_BROWSER_URL: '',
    FORWARD_TO_FRIEND_URL: '',
  }
}

export async function sendOrderCancellationEmail({
  email,
  name,
  orderNumber,
}: {
  email: string
  name: string
  orderNumber: string
}): Promise<void> {
  const vars = {
    name,
    orderNumber,
    cancellationDate: new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    ...footerVars(email),
  }
  await sendEmail({
    to: email,
    subject: substituteVariables(orderCancellationTemplate.subject, vars),
    html: substituteVariables(orderCancellationTemplate.html, vars),
    text: substituteVariables(orderCancellationTemplate.text, vars),
  })
}

export async function sendRefundProcessedEmail({
  email,
  name,
  orderNumber,
  refundAmount,
  refundMethod,
  originalOrderDate,
}: {
  email: string
  name: string
  orderNumber: string
  refundAmount: string
  refundMethod: string
  originalOrderDate: string
}): Promise<void> {
  const vars = {
    name,
    orderNumber,
    refundAmount,
    refundMethod,
    originalOrderDate,
    processingDays: '3–5 business days',
    ...footerVars(email),
  }
  await sendEmail({
    to: email,
    subject: substituteVariables(refundProcessedTemplate.subject, vars),
    html: substituteVariables(refundProcessedTemplate.html, vars),
    text: substituteVariables(refundProcessedTemplate.text, vars),
  })
}

export async function sendReviewRequestEmail({
  email,
  name,
  orderNumber,
  productName,
}: {
  email: string
  name: string
  orderNumber: string
  productName: string
}): Promise<void> {
  const reviewUrl = `${BASE_URL}/account/orders/${orderNumber}/review`
  const vars = {
    name,
    productName,
    reviewUrl,
    orderNumber,
    ...footerVars(email),
  }
  await sendEmail({
    to: email,
    subject: substituteVariables(reviewRequestTemplate.subject, vars),
    html: substituteVariables(reviewRequestTemplate.html, vars),
    text: substituteVariables(reviewRequestTemplate.text, vars),
  })
}

export async function sendOrderReadyForPickupEmail({
  email,
  name,
  orderNumber,
  pickupLocation = 'José Madrid Salsa, Zanesville, OH',
  pickupHours = 'Mon–Fri 9am–5pm',
  pickupDeadline,
}: {
  email: string
  name: string
  orderNumber: string
  pickupLocation?: string
  pickupHours?: string
  pickupDeadline?: string
}): Promise<void> {
  const vars = {
    name,
    orderNumber,
    pickupLocation,
    pickupHours,
    pickupDeadline: pickupDeadline ?? '',
    ...footerVars(email),
  }
  await sendEmail({
    to: email,
    subject: substituteVariables(orderReadyPickupTemplate.subject, vars),
    html: substituteVariables(orderReadyPickupTemplate.html, vars),
    text: substituteVariables(orderReadyPickupTemplate.text, vars),
  })
}

export async function sendGiftCertificateDeliveryEmail({
  recipientEmail,
  recipientName,
  purchaserName,
  code,
  amount,
  message,
  theme,
}: {
  recipientEmail: string
  recipientName: string
  purchaserName: string
  code: string
  amount: string
  message?: string | null
  theme: string
}): Promise<void> {
  const redeemUrl = `${BASE_URL}/gift-certificates/balance?code=${encodeURIComponent(code)}`
  const vars = {
    recipientName,
    purchaserName,
    code,
    amount,
    message: message ?? '',
    theme,
    redeemUrl,
    ...footerVars(recipientEmail),
  }
  await sendEmail({
    to: recipientEmail,
    subject: substituteVariables(giftCertificateDeliveryTemplate.subject, vars),
    html: substituteVariables(giftCertificateDeliveryTemplate.html, vars),
    text: substituteVariables(giftCertificateDeliveryTemplate.text, vars),
  })
}
