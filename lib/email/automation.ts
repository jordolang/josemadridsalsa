import { format } from 'date-fns'
import React from 'react'
import { sendEmail } from '@/lib/email/client'
import { prisma } from '@/lib/prisma'
import { OrderConfirmationEmail } from '@/emails/order-confirmation'
import { Text, Section } from '@react-email/components'
import { EmailLayout } from '@/emails/components/EmailLayout'
import { EmailHeader } from '@/emails/components/EmailHeader'
import { EmailFooter } from '@/emails/components/EmailFooter'
import { Button } from '@/emails/components/Button'

const defaultAppUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  'https://www.josemadridsalsa.com'

export async function sendWelcomeEmail(options: {
  email: string
  name?: string | null
  discountCode?: string
}) {
  const name = options.name || 'Friend'
  const discountCode = options.discountCode || 'WELCOME15'
  const unsubscribeUrl = `${defaultAppUrl}/account/preferences`

  const emailContent = React.createElement(
    EmailLayout,
    { previewText: 'Welcome to Jose Madrid Salsa!' },
    React.createElement(EmailHeader, null),
    React.createElement(
      Section,
      { style: { padding: '0', margin: '24px 0' } },
      React.createElement(
        Text,
        { style: { margin: '0 0 24px', fontSize: '24px', fontWeight: '700', color: '#dc2626', fontFamily: 'Arial, sans-serif', lineHeight: '1.3' } },
        'Welcome to Jose Madrid Salsa!'
      ),
      React.createElement(
        Text,
        { style: { margin: '0 0 16px', fontSize: '16px', color: '#1f2937', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' } },
        `Hi ${name},`
      ),
      React.createElement(
        Text,
        { style: { margin: '0 0 16px', fontSize: '16px', color: '#1f2937', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' } },
        `Welcome to the Jose Madrid Salsa family. Use code ${discountCode} to save on your first order.`
      ),
      React.createElement(
        Text,
        { style: { margin: '0 0 16px', fontSize: '16px', color: '#1f2937', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' } },
        "We're excited to cook with you."
      )
    ),
    React.createElement(EmailFooter, { unsubscribeUrl })
  )

  return sendEmail({
    to: options.email,
    subject: 'Welcome to Jose Madrid Salsa!',
    react: emailContent,
    type: 'welcome',
  })
}

export async function sendOrderConfirmationEmail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      user: { select: { name: true, email: true } },
      fundraiser: { select: { name: true } },
    },
  })

  if (!order) {
    console.warn(`[EmailAutomation] Order ${orderId} not found for confirmation email`)
    return { success: false, error: 'Order not found' }
  }

  const recipientEmail = order.user?.email ?? order.guestEmail
  if (!recipientEmail) {
    console.warn(`[EmailAutomation] Order ${orderId} missing email, skipping confirmation email`)
    return { success: false, error: 'Order email missing' }
  }

  const items = order.items.map((item) => ({
    productName: item.productName,
    productSku: item.productSku,
    totalPrice: `$${Number(item.totalPrice).toFixed(2)}`,
    quantity: item.quantity,
  }))

  const shippingAddress =
    order.shippingMethod ||
    order.fundraiser?.name ||
    'Digital fulfillment'

  const trackingLink =
    order.trackingNumber
      ? `${defaultAppUrl}/track/${order.trackingNumber}`
      : `${defaultAppUrl}/account/orders`

  const unsubscribeUrl = `${defaultAppUrl}/account/preferences`

  const emailContent = React.createElement(OrderConfirmationEmail, {
    name: order.user?.name || 'there',
    orderNumber: order.orderNumber,
    orderDate: format(order.createdAt, 'MMMM d, yyyy'),
    orderTotal: `$${Number(order.total).toFixed(2)}`,
    items,
    shippingAddress,
    trackingLink,
    unsubscribeUrl,
  })

  const result = await sendEmail({
    to: recipientEmail,
    subject: `Order Confirmation #${order.orderNumber}`,
    react: emailContent,
    replyTo: 'orders@josemadridsalsa.com',
    type: 'order-confirmation',
    orderId: order.id,
    userId: order.userId ?? undefined,
  })

  if (result.success) {
    await prisma.order.update({
      where: { id: order.id },
      data: { confirmationEmailSentAt: new Date() },
    })
  }

  return result
}

export async function sendNewsletterWelcomeEmail(options: {
  email: string
  name?: string
}) {
  const name = options.name ?? 'Salsa Fan'
  const unsubscribeUrl = `${defaultAppUrl}/account/preferences`

  const emailContent = React.createElement(
    EmailLayout,
    { previewText: "You're on the list - welcome!" },
    React.createElement(EmailHeader, null),
    React.createElement(
      Section,
      { style: { padding: '0', margin: '24px 0' } },
      React.createElement(
        Text,
        { style: { margin: '0 0 24px', fontSize: '24px', fontWeight: '700', color: '#dc2626', fontFamily: 'Arial, sans-serif', lineHeight: '1.3' } },
        "You're on the list!"
      ),
      React.createElement(
        Text,
        { style: { margin: '0 0 16px', fontSize: '16px', color: '#1f2937', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' } },
        `Hi ${name},`
      ),
      React.createElement(
        Text,
        { style: { margin: '0 0 16px', fontSize: '16px', color: '#1f2937', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' } },
        'Thanks for subscribing to the Jose Madrid Salsa newsletter. Look out for recipes, tastings, and exclusive offers in your inbox.'
      )
    ),
    React.createElement(EmailFooter, { unsubscribeUrl })
  )

  return sendEmail({
    to: options.email,
    subject: "You're on the list — welcome!",
    react: emailContent,
    type: 'newsletter-welcome',
  })
}

export async function sendContactConfirmationEmail(options: {
  email: string
  name?: string
  subject?: string
}) {
  const name = options.name ?? 'there'
  const messageSubject = options.subject ?? 'your recent message'
  const unsubscribeUrl = `${defaultAppUrl}/account/preferences`

  const emailContent = React.createElement(
    EmailLayout,
    { previewText: 'Thanks for reaching out to Jose Madrid Salsa' },
    React.createElement(EmailHeader, null),
    React.createElement(
      Section,
      { style: { padding: '0', margin: '24px 0' } },
      React.createElement(
        Text,
        { style: { margin: '0 0 24px', fontSize: '24px', fontWeight: '700', color: '#dc2626', fontFamily: 'Arial, sans-serif', lineHeight: '1.3' } },
        'Thanks for reaching out!'
      ),
      React.createElement(
        Text,
        { style: { margin: '0 0 16px', fontSize: '16px', color: '#1f2937', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' } },
        `Hi ${name},`
      ),
      React.createElement(
        Text,
        { style: { margin: '0 0 16px', fontSize: '16px', color: '#1f2937', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' } },
        `Thanks for contacting us about ${messageSubject}. Our team will follow up shortly.`
      )
    ),
    React.createElement(EmailFooter, { unsubscribeUrl })
  )

  return sendEmail({
    to: options.email,
    subject: 'Thanks for reaching out to Jose Madrid Salsa',
    react: emailContent,
    replyTo: 'support@josemadridsalsa.com',
    type: 'contact-confirmation',
  })
}

export async function sendFundraiserFollowupEmail(options: {
  email: string
  contactName: string
  organizationName: string
  goal?: string
  supportEmail?: string
}) {
  const unsubscribeUrl = `${defaultAppUrl}/account/preferences`
  const supportEmail = options.supportEmail || 'fundraising@josemadridsalsa.com'

  const emailContent = React.createElement(
    EmailLayout,
    { previewText: "Let's get your fundraiser started!" },
    React.createElement(EmailHeader, null),
    React.createElement(
      Section,
      { style: { padding: '0', margin: '24px 0' } },
      React.createElement(
        Text,
        { style: { margin: '0 0 24px', fontSize: '24px', fontWeight: '700', color: '#dc2626', fontFamily: 'Arial, sans-serif', lineHeight: '1.3' } },
        "Let's get your fundraiser started!"
      ),
      React.createElement(
        Text,
        { style: { margin: '0 0 16px', fontSize: '16px', color: '#1f2937', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' } },
        `Hi ${options.contactName},`
      ),
      React.createElement(
        Text,
        { style: { margin: '0 0 16px', fontSize: '16px', color: '#1f2937', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' } },
        `Thanks for your interest in fundraising with Jose Madrid Salsa for ${options.organizationName}. We'll be in touch shortly to build your plan.`
      ),
      React.createElement(
        Text,
        { style: { margin: '0 0 16px', fontSize: '16px', color: '#1f2937', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' } },
        `Questions? Contact us at ${supportEmail}.`
      )
    ),
    React.createElement(EmailFooter, { unsubscribeUrl })
  )

  return sendEmail({
    to: options.email,
    subject: "Let's get your fundraiser started!",
    react: emailContent,
    replyTo: supportEmail,
    type: 'fundraiser-followup',
  })
}

interface CartItemData {
  id: string
  name: string
  slug: string
  price: number
  image: string
  quantity: number
  sku: string
  heatLevel: string
}

export async function sendAbandonedCartEmail(options: {
  email: string
  name?: string | null
  cartItems: CartItemData[]
  totalPrice: number
  recoveryToken: string
}) {
  const name = options.name || 'there'
  const recoveryUrl = `${defaultAppUrl}/checkout?recover=${options.recoveryToken}`
  const unsubscribeUrl = `${defaultAppUrl}/account/preferences`

  const emailContent = React.createElement(
    EmailLayout,
    { previewText: "Don't forget your salsa!" },
    React.createElement(EmailHeader, null),
    React.createElement(
      Section,
      { style: { padding: '0', margin: '24px 0' } },
      React.createElement(
        Text,
        { style: { margin: '0 0 24px', fontSize: '24px', fontWeight: '700', color: '#dc2626', fontFamily: 'Arial, sans-serif', lineHeight: '1.3' } },
        "Don't forget your salsa!"
      ),
      React.createElement(
        Text,
        { style: { margin: '0 0 16px', fontSize: '16px', color: '#1f2937', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' } },
        `Hi ${name},`
      ),
      React.createElement(
        Text,
        { style: { margin: '0 0 16px', fontSize: '16px', color: '#1f2937', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' } },
        "You left some delicious items in your cart. We've saved them for you!"
      ),
      React.createElement(
        Text,
        { style: { margin: '16px 0', fontSize: '16px', fontWeight: '600', color: '#1f2937', fontFamily: 'Arial, sans-serif' } },
        `Total: $${options.totalPrice.toFixed(2)}`
      ),
      React.createElement(
        Text,
        { style: { margin: '0 0 16px', fontSize: '16px', color: '#1f2937', fontFamily: 'Arial, sans-serif', lineHeight: '1.6' } },
        'Special offer: Use code COMEBACK10 at checkout to save 10% on your order!'
      )
    ),
    React.createElement(
      Section,
      { style: { padding: '24px 0', textAlign: 'center' } },
      React.createElement(Button, {
        href: recoveryUrl,
        variant: 'primary',
        size: 'medium',
      }, 'Complete Your Order')
    ),
    React.createElement(EmailFooter, { unsubscribeUrl })
  )

  return sendEmail({
    to: options.email,
    subject: 'You left something behind! Complete your order now',
    react: emailContent,
    replyTo: 'support@josemadridsalsa.com',
    type: 'abandoned-cart',
  })
}
