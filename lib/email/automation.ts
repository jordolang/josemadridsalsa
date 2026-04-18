import { format } from 'date-fns'
import React from 'react'
import { sendEmail } from '@/lib/email/client'
import { prisma } from '@/lib/prisma'
import { OrderConfirmationEmail } from '@/emails/order-confirmation'
import { FundraiserDonationReceipt } from '@/emails/fundraiser-donation-receipt'
import { CampaignLaunchEmail } from '@/lib/email/templates/campaign-launch'
import { ParticipantWelcomeEmail } from '@/lib/email/templates/participant-welcome'
import { ParticipantMilestoneEmail } from '@/lib/email/templates/participant-milestone'
import { CampaignSummaryEmail } from '@/lib/email/templates/campaign-summary'
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
    replyTo: 'mike@josemadrid.net',
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

export async function sendFundraiserDonationReceipt(options: {
  donorEmail: string
  donorName?: string | null
  donorUserId?: string | null
  isAnonymous?: boolean
  teamName: string
  teamSchool: string
  teamSlug: string
  amountCents: number
  currency?: string
  receiptId: string
  comment?: string | null
  receiptDate?: Date
}) {
  const {
    donorEmail,
    donorName,
    donorUserId,
    isAnonymous = false,
    teamName,
    teamSchool,
    teamSlug,
    amountCents,
    currency = 'USD',
    receiptId,
    comment,
    receiptDate = new Date(),
  } = options

  const amountFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amountCents / 100)

  const teamPageUrl = `${defaultAppUrl}/fundraise/${teamSlug}`
  const unsubscribeUrl = `${defaultAppUrl}/account/preferences`

  const emailContent = React.createElement(FundraiserDonationReceipt, {
    donorName,
    isAnonymous,
    teamName,
    teamSchool,
    teamPageUrl,
    amountFormatted,
    receiptDate: format(receiptDate, 'MMMM d, yyyy'),
    receiptId,
    comment,
    unsubscribeUrl,
  })

  return sendEmail({
    to: donorEmail,
    subject: `Thanks for supporting ${teamName}! Receipt for ${amountFormatted}`,
    react: emailContent,
    replyTo: 'mike@josemadrid.net',
    type: 'fundraiser-donation-receipt',
    userId: donorUserId ?? undefined,
  })
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

export async function sendCampaignLaunchEmail(options: {
  email: string
  coordinatorName: string
  campaignName: string
  organizationName: string
  campaignUrl: string
  startDate: string
  endDate: string
  goalAmount?: string
  supportEmail?: string
}) {
  const unsubscribeUrl = `${defaultAppUrl}/account/preferences`
  const supportEmail = options.supportEmail || 'fundraising@josemadridsalsa.com'

  const emailContent = React.createElement(CampaignLaunchEmail, {
    coordinatorName: options.coordinatorName,
    campaignName: options.campaignName,
    organizationName: options.organizationName,
    campaignUrl: options.campaignUrl,
    startDate: options.startDate,
    endDate: options.endDate,
    goalAmount: options.goalAmount,
    supportEmail,
    unsubscribeUrl,
  })

  return sendEmail({
    to: options.email,
    subject: `Your ${options.campaignName} fundraiser is ready to launch!`,
    react: emailContent,
    replyTo: supportEmail,
    type: 'campaign-launch',
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
      { style: { padding: '24px 0', textAlign: 'center' as const } },
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

export async function sendParticipantWelcomeEmail(options: {
  email: string
  participantName: string
  fundraiserName: string
  referralCode: string
  fundraiserId: string
  supportEmail?: string
}) {
  const unsubscribeUrl = `${defaultAppUrl}/account/preferences`
  const fundraiserUrl = `${defaultAppUrl}/fundraisers/${options.fundraiserId}`
  const supportEmail = options.supportEmail || 'fundraising@josemadridsalsa.com'

  const emailContent = React.createElement(ParticipantWelcomeEmail, {
    participantName: options.participantName,
    fundraiserName: options.fundraiserName,
    referralCode: options.referralCode,
    fundraiserUrl,
    supportEmail,
    unsubscribeUrl,
  })

  return sendEmail({
    to: options.email,
    subject: `Welcome to the ${options.fundraiserName} fundraiser!`,
    react: emailContent,
    replyTo: supportEmail,
    type: 'participant-welcome',
  })
}

export async function sendParticipantMilestoneEmail(options: {
  email: string
  participantName: string
  fundraiserName: string
  milestone: number
  totalSales: number
  totalRaised: number
  fundraiserId: string
  supportEmail?: string
}) {
  const unsubscribeUrl = `${defaultAppUrl}/account/preferences`
  const dashboardUrl = `${defaultAppUrl}/fundraisers/${options.fundraiserId}/dashboard`
  const supportEmail = options.supportEmail || 'fundraising@josemadridsalsa.com'
  const totalRaised = `$${options.totalRaised.toFixed(2)}`

  const emailContent = React.createElement(ParticipantMilestoneEmail, {
    participantName: options.participantName,
    fundraiserName: options.fundraiserName,
    milestone: options.milestone,
    totalSales: options.totalSales,
    totalRaised,
    dashboardUrl,
    supportEmail,
    unsubscribeUrl,
  })

  return sendEmail({
    to: options.email,
    subject: `Congratulations! You've reached ${options.milestone} sales for ${options.fundraiserName}!`,
    react: emailContent,
    replyTo: supportEmail,
    type: 'participant-milestone',
  })
}

export async function sendCampaignSummaryEmail(fundraiserId: string) {
  const fundraiser = await prisma.fundraiser.findUnique({
    where: { id: fundraiserId },
    include: {
      orders: {
        select: {
          id: true,
          total: true,
          participantId: true,
        },
      },
      participants: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!fundraiser) {
    return { success: false, error: 'Fundraiser not found' }
  }

  // Use organizationName as the coordinator contact point
  const coordinatorEmail = fundraiser.contactEmail
  if (!coordinatorEmail) {
    return { success: false, error: 'Coordinator email missing' }
  }

  const totalOrders = fundraiser.orders.length
  const totalRevenue = fundraiser.orders.reduce(
    (sum: number, order: { total: import('@prisma/client').Prisma.Decimal }) => sum + Number(order.total),
    0
  )
  // Use commissionRate as profit margin proxy
  const commissionRate = Number(fundraiser.commissionRate ?? 0)
  const totalRaised = totalRevenue * (commissionRate / 100)

  const participantSales = new Map<string, { name: string; sales: number }>()
  fundraiser.participants.forEach((participant: { id: string; name: string }) => {
    participantSales.set(participant.id, { name: participant.name, sales: 0 })
  })

  fundraiser.orders.forEach((order: { participantId: string | null }) => {
    if (order.participantId && participantSales.has(order.participantId)) {
      const participant = participantSales.get(order.participantId)!
      participant.sales += 1
    }
  })

  const topParticipants = Array.from(participantSales.values())
    .filter((p) => p.sales > 0)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5)

  const unsubscribeUrl = `${defaultAppUrl}/account/preferences`
  const campaignUrl = `${defaultAppUrl}/fundraisers/${fundraiser.id}/dashboard`
  const supportEmail = 'fundraising@josemadridsalsa.com'

  const emailContent = React.createElement(CampaignSummaryEmail, {
    coordinatorName: fundraiser.organizationName,
    campaignName: fundraiser.name,
    organizationName: fundraiser.organizationName,
    totalOrders,
    totalRevenue: `$${totalRevenue.toFixed(2)}`,
    totalRaised: `$${totalRaised.toFixed(2)}`,
    participantCount: fundraiser.participants.length,
    topParticipants,
    campaignUrl,
    supportEmail,
    unsubscribeUrl,
  })

  return sendEmail({
    to: coordinatorEmail,
    subject: `${fundraiser.name} Campaign Summary`,
    react: emailContent,
    replyTo: supportEmail,
    type: 'campaign-summary',
  })
}
