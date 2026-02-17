/**
 * Email Type Definitions
 *
 * Centralized type definitions for email data structures used across
 * React Email templates and email sending functions.
 */

/**
 * Order item data for email templates
 */
export type OrderItem = {
  quantity: number
  productName: string
  productSku: string
  totalPrice: number | string
}

/**
 * Order confirmation email data
 */
export type OrderConfirmationData = {
  name?: string
  orderNumber: string
  orderDate: string
  orderTotal: string
  items: OrderItem[]
  shippingAddress: string
  trackingLink?: string
  unsubscribeUrl?: string
}

/**
 * Shipping notification email data
 */
export type ShippingNotificationData = {
  name?: string
  orderNumber: string
  trackingNumber: string
  trackingUrl: string
  carrier: string
  estimatedDelivery: string
  shippingAddress: string
  items: OrderItem[]
  unsubscribeUrl?: string
}

/**
 * Delivery confirmation email data
 */
export type DeliveryConfirmationData = {
  name?: string
  orderNumber: string
  deliveryDate: string
  items: OrderItem[]
  shippingAddress: string
  feedbackUrl?: string
  orderDetailsUrl?: string
  unsubscribeUrl?: string
}

/**
 * Contact form email data
 */
export type ContactFormData = {
  name: string
  email: string
  phone?: string
  message: string
  submittedAt?: string
  unsubscribeUrl?: string
}

/**
 * Email type categories for logging and tracking
 */
export type EmailType =
  | 'order-confirmation'
  | 'shipping-notification'
  | 'delivery-confirmation'
  | 'contact-form'
  | 'contact-confirmation'
  | 'welcome'
  | 'newsletter'
  | 'newsletter-welcome'
  | 'abandoned-cart'
  | 'fundraiser-followup'

/**
 * Email sending result
 */
export type EmailResult = {
  success: boolean
  data?: {
    id: string
  }
  error?: unknown
}

/**
 * Email logging data
 */
export type EmailLogData = {
  type: EmailType
  to: string
  from: string
  subject: string
  emailId?: string
  orderId?: string
  userId?: string
}
