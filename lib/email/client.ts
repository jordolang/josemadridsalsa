/**
 * Email Client with React Email Support
 * Handles email sending with React Email template rendering, logging, and unsubscribe checking
 */

import { Resend } from 'resend'
import { render } from '@react-email/render'
import React from 'react'

const resendApiKey = process.env.RESEND_API_KEY

if (!resendApiKey) {
  console.warn('RESEND_API_KEY environment variable is not set')
}

// Initialize Resend client
export const resend = resendApiKey ? new Resend(resendApiKey) : null

interface SendEmailOptions {
  to: string | string[]
  subject: string
  react: React.ReactElement
  from?: string
  replyTo?: string
  type: string
  orderId?: string
  userId?: string
}

interface EmailSendResult {
  success: boolean
  error?: string
  messageId?: string
  data?: any
}

/**
 * Send an email using React Email template
 */
export async function sendEmail({
  to,
  subject,
  react,
  from = process.env.FROM_EMAIL || 'orders@josemadridsalsa.com',
  replyTo,
  type,
  orderId,
  userId,
}: SendEmailOptions): Promise<EmailSendResult> {
  const recipientEmail = Array.isArray(to) ? to[0] : to

  try {
    // Check if Resend is configured
    if (!resend) {
      const errorMsg = 'Resend client not initialized - RESEND_API_KEY missing'
      console.error(errorMsg)

      // Log error (import logger when available)
      // await logEmailError({ type, to: recipientEmail, from, subject, error: errorMsg, orderId })

      return {
        success: false,
        error: errorMsg,
      }
    }

    // Check unsubscribe preferences (only for non-transactional emails)
    // Transactional emails (order, shipping, delivery) should always be sent
    const isTransactional = ['order-confirmation', 'shipping-notification', 'delivery-confirmation'].includes(type)

    if (!isTransactional) {
      // When logger is available, check unsubscribe status:
      // const isUnsubscribed = await checkUnsubscribed(recipientEmail)
      // if (isUnsubscribed) {
      //   console.log(`Email not sent - user unsubscribed: ${recipientEmail}`)
      //   return { success: false, error: 'User unsubscribed' }
      // }
    }

    // Render React Email template to HTML
    const html = render(react)

    // Construct unsubscribe URL
    const unsubscribeUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://josemadrid.net'}/unsubscribe?email=${encodeURIComponent(recipientEmail)}`

    // Send email via Resend with List-Unsubscribe header for compliance
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
      replyTo,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    if (result.error) {
      console.error('Resend send error:', result.error)

      // Log error (import logger when available)
      // await logEmailError({
      //   type,
      //   to: recipientEmail,
      //   from,
      //   subject,
      //   error: result.error.message,
      //   orderId,
      // })

      return {
        success: false,
        error: result.error.message,
      }
    }

    // Log successful send (import logger when available)
    // await logEmailSend({
    //   type,
    //   to: recipientEmail,
    //   from,
    //   subject,
    //   emailId: result.data?.id,
    //   orderId,
    //   userId,
    // })

    console.log(`Email sent successfully: ${type} to ${recipientEmail}`)

    return {
      success: true,
      messageId: result.data?.id,
      data: result.data,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Email send error:', error)

    // Log error (import logger when available)
    // await logEmailError({
    //   type,
    //   to: recipientEmail,
    //   from,
    //   subject,
    //   error: errorMessage,
    //   orderId,
    // })

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Render React Email template to HTML (for preview/testing)
 */
export function renderEmailTemplate(react: React.ReactElement): string {
  return render(react)
}
