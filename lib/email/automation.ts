import { format } from 'date-fns'
import { sendEmail, substituteVariables } from '@/lib/email/sender'
import { prisma } from '@/lib/prisma'

type TemplateContent = {
  subject: string
  html: string
  text?: string
}

interface SendTemplateEmailOptions {
  templateKey: string
  to: string
  variables: Record<string, any>
  fallback: TemplateContent
  replyTo?: string
  configId?: string
}

const defaultAppUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  'https://www.josemadridsalsa.com'

async function loadTemplate(
  templateKey: string
): Promise<TemplateContent | null> {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { key: templateKey },
    })

    if (!template) {
      return null
    }

    return {
      subject: template.subject,
      html: template.html,
      text: template.text ?? undefined,
    }
  } catch (error) {
    console.error(`[EmailAutomation] Failed to load template ${templateKey}`, error)
    return null
  }
}

async function sendTemplateEmail({
  templateKey,
  to,
  variables,
  fallback,
  replyTo,
  configId,
}: SendTemplateEmailOptions) {
  const template = await loadTemplate(templateKey)
  const content = template ?? fallback

  const subject = substituteVariables(content.subject, variables)
  const html = substituteVariables(content.html, variables)
  const text = content.text
    ? substituteVariables(content.text, variables)
    : undefined

  return sendEmail(
    {
      to,
      subject,
      html,
      text,
      replyTo,
    },
    configId
  )
}

export async function sendWelcomeEmail(options: {
  email: string
  name?: string | null
  discountCode?: string
}) {
  const variables = {
    name: options.name || 'Friend',
    discountCode: options.discountCode || 'WELCOME15',
    unsubscribe_url: `${defaultAppUrl}/account/preferences`,
  }

  return sendTemplateEmail({
    templateKey: 'welcome_email',
    to: options.email,
    variables,
    fallback: {
      subject: 'Welcome to Jose Madrid Salsa!',
      html: `<p>Hi {{name}},</p><p>Welcome to the Jose Madrid Salsa family. Use code <strong>{{discountCode}}</strong> to save on your first order.</p><p>We&apos;re excited to cook with you.</p>`,
      text: 'Welcome to Jose Madrid Salsa! Use code {{discountCode}} to save on your first order.',
    },
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

  const orderItemsHtml = order.items.length
    ? order.items
        .map((item) => {
          const lineTotal = Number(item.totalPrice).toFixed(2)
          return `<div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <div><strong>${item.quantity}× ${item.productName}</strong><br/><span style="color:#6b7280;">SKU: ${item.productSku}</span></div>
              <div style="font-weight:600;">$${lineTotal}</div>
            </div>`
        })
        .join('')
    : '<p style="margin:0;color:#6b7280;">This order contains digital items.</p>'

  const orderItemsText = order.items.length
    ? order.items
        .map((item) => `${item.quantity}× ${item.productName} — $${Number(item.totalPrice).toFixed(2)}`)
        .join('\n')
    : 'Digital items'

  const shippingAddress =
    order.shippingMethod ||
    order.fundraiser?.name ||
    'Digital fulfillment'

  const trackingUrl =
    order.trackingNumber
      ? `${defaultAppUrl}/track/${order.trackingNumber}`
      : `${defaultAppUrl}/account/orders`

  const variables = {
    name: order.user?.name || 'there',
    orderNumber: order.orderNumber,
    orderDate: format(order.createdAt, 'MMMM d, yyyy'),
    orderTotal: `$${Number(order.total).toFixed(2)}`,
    orderItems: orderItemsHtml,
    orderItemsText,
    shippingAddress,
    trackingLink: trackingUrl,
  }

  const result = await sendTemplateEmail({
    templateKey: 'order_confirmation',
    to: recipientEmail,
    variables,
    fallback: {
      subject: `Order Confirmation #{{orderNumber}}`,
      html: `<p>Hi {{name}},</p><p>Thanks for your order #{{orderNumber}} placed on {{orderDate}}.</p><p><strong>Items:</strong><br/>{{orderItems}}</p><p>Total: {{orderTotal}}</p>`,
      text: `Order {{orderNumber}} confirmed on {{orderDate}} for {{orderTotal}}.\n\nItems:\n{{orderItemsText}}`,
    },
    replyTo: 'orders@josemadridsalsa.com',
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
  const variables = {
    name: options.name ?? 'Salsa Fan',
    unsubscribe_url: `${defaultAppUrl}/account/preferences`,
    month: format(new Date(), 'MMMM'),
    featuredRecipe: 'Family Salsa Flight',
    recipeLink: `${defaultAppUrl}/recipes`,
    newsUpdate: 'Thanks for subscribing to our monthly newsletter!',
    specialOffer: 'Save 10% on your next online order.',
    offerCode: 'SALSA10',
  }

  return sendTemplateEmail({
    templateKey: 'monthly_newsletter',
    to: options.email,
    variables,
    fallback: {
      subject: 'You’re on the list — welcome!',
      html: `<p>Hi {{name}},</p><p>Thanks for subscribing to the Jose Madrid Salsa newsletter. Look out for recipes, tastings, and exclusive offers in your inbox.</p>`,
      text: 'Thanks for subscribing to Jose Madrid Salsa news!',
    },
  })
}

export async function sendContactConfirmationEmail(options: {
  email: string
  name?: string
  subject?: string
}) {
  const variables = {
    name: options.name ?? 'there',
    subject: options.subject ?? 'your recent message',
  }

  return sendTemplateEmail({
    templateKey: 'thank_you',
    to: options.email,
    variables,
    fallback: {
      subject: 'Thanks for reaching out to Jose Madrid Salsa',
      html: `<p>Hi {{name}},</p><p>Thanks for contacting us about {{subject}}. Our team will follow up shortly.</p>`,
      text: 'Thanks for contacting Jose Madrid Salsa. We will follow up shortly.',
    },
    replyTo: 'support@josemadridsalsa.com',
  })
}

export async function sendFundraiserFollowupEmail(options: {
  email: string
  contactName: string
  organizationName: string
  goal?: string
  supportEmail?: string
}) {
  const variables = {
    contactName: options.contactName,
    organizationName: options.organizationName,
    fundraiserGoal: options.goal || '5,000',
    fundraiserEndDate: format(new Date(Date.now() + 1000 * 60 * 60 * 24 * 21), 'MMMM d, yyyy'),
    orderFormUrl: `${defaultAppUrl}/fundraising/forms`,
    dashboardUrl: `${defaultAppUrl}/admin/fundraisers`,
    supportEmail: options.supportEmail || 'fundraising@josemadridsalsa.com',
    profitPerJar: '4',
  }

  return sendTemplateEmail({
    templateKey: 'fundraiser_kickoff',
    to: options.email,
    variables,
    fallback: {
      subject: 'Let\'s get your fundraiser started!',
      html: `<p>Hi {{contactName}},</p><p>Thanks for your interest in fundraising with Jose Madrid Salsa. We&apos;ll be in touch shortly to build your plan.</p>`,
      text: 'Thanks for your interest in fundraising with Jose Madrid Salsa.',
    },
    replyTo: options.supportEmail ?? 'fundraising@josemadridsalsa.com',
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
  const cartItemsHtml = options.cartItems
    .map((item) => {
      const lineTotal = (item.price * item.quantity).toFixed(2)
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #e5e7eb;">
          <div style="display:flex;align-items:center;gap:16px;">
            <img src="${item.image}" alt="${item.name}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;" />
            <div>
              <div style="font-weight:600;font-size:16px;margin-bottom:4px;">${item.name}</div>
              <div style="color:#6b7280;font-size:14px;">Quantity: ${item.quantity}</div>
              <div style="color:#6b7280;font-size:14px;">Heat Level: ${item.heatLevel}</div>
            </div>
          </div>
          <div style="font-weight:600;font-size:16px;">$${lineTotal}</div>
        </div>`
    })
    .join('')

  const cartItemsText = options.cartItems
    .map((item) => `${item.quantity}× ${item.name} ($${item.price}) — $${(item.price * item.quantity).toFixed(2)}`)
    .join('\n')

  const recoveryUrl = `${defaultAppUrl}/checkout?recover=${options.recoveryToken}`

  const variables = {
    name: options.name || 'there',
    cartItems: cartItemsHtml,
    cartItemsText,
    totalPrice: `$${options.totalPrice.toFixed(2)}`,
    recoveryLink: recoveryUrl,
    discountCode: 'COMEBACK10',
    discountAmount: '10',
    unsubscribe_url: `${defaultAppUrl}/account/preferences`,
  }

  return sendTemplateEmail({
    templateKey: 'abandoned_cart',
    to: options.email,
    variables,
    fallback: {
      subject: 'You left something behind! Complete your order now',
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#dc2626;font-size:28px;margin-bottom:24px;">Don't forget your salsa!</h1>
        <p style="font-size:16px;line-height:1.6;margin-bottom:24px;">Hi {{name}},</p>
        <p style="font-size:16px;line-height:1.6;margin-bottom:24px;">
          You left some delicious items in your cart. We've saved them for you!
        </p>
        <div style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:24px;">
          {{cartItems}}
          <div style="display:flex;justify-content:space-between;padding:16px;font-size:18px;font-weight:700;border-top:2px solid #dc2626;">
            <span>Total:</span>
            <span style="color:#dc2626;">{{totalPrice}}</span>
          </div>
        </div>
        <p style="font-size:16px;line-height:1.6;margin-bottom:24px;">
          <strong>Special offer:</strong> Use code <strong style="color:#dc2626;">{{discountCode}}</strong> at checkout to save {{discountAmount}}% on your order!
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{recoveryLink}}" style="display:inline-block;background:#dc2626;color:white;padding:16px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">
            Complete Your Order
          </a>
        </div>
        <p style="font-size:14px;color:#6b7280;line-height:1.6;margin-top:32px;">
          Questions? Reply to this email or visit our store to browse more products.
        </p>
      </div>`,
      text: `Hi {{name}},\n\nYou left some items in your cart at Jose Madrid Salsa:\n\n{{cartItemsText}}\n\nTotal: {{totalPrice}}\n\nComplete your order now and use code {{discountCode}} to save {{discountAmount}}%!\n\n{{recoveryLink}}\n\nThanks,\nJose Madrid Salsa`,
    },
    replyTo: 'support@josemadridsalsa.com',
  })
}
