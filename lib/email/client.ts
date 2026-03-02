/**
 * Email Client with React Email Support
 * Handles email sending with React Email template rendering, logging, and unsubscribe checking
 */

import { Resend } from 'resend'
import { render } from '@react-email/render'
import React from 'react'
import { createHash } from 'crypto'
import { logEmailSend, checkUnsubscribed } from './logger'

let resendApiKeyWarned = false

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    if (!resendApiKeyWarned) {
      console.warn('RESEND_API_KEY environment variable is not set')
      resendApiKeyWarned = true
    }
    return null
  }
  return new Resend(apiKey)
}

/** Hash email for safe logging */
function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 12)
}

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
  const emailHash = hashEmail(recipientEmail)

  try {
    const resend = getResendClient()

    // Check if Resend is configured
    if (!resend) {
      const errorMsg = 'Resend client not initialized - RESEND_API_KEY missing'
      console.error(errorMsg)

      // Log error
      await logEmailSend({
        recipientEmail,
        recipientName: undefined,
        userId,
        templateId: type,
        subject,
        status: 'FAILED',
        errorMessage: errorMsg,
        metadata: orderId ? { orderId } : undefined,
      }).catch((err) => {
        console.error('Failed to log email error:', err)
      })

      return {
        success: false,
        error: errorMsg,
      }
    }

    // Check unsubscribe preferences (only for non-transactional emails)
    // Transactional emails (order, shipping, delivery) should always be sent
    const isTransactional = ['order-confirmation', 'shipping-notification', 'delivery-confirmation'].includes(type)

    if (!isTransactional) {
      const isUnsubscribed = await checkUnsubscribed({ email: recipientEmail, category: type })
      if (isUnsubscribed) {
        console.log(`Email not sent - user unsubscribed: ${emailHash}`)
        return { success: false, error: 'User unsubscribed' }
      }
    }

    // Render React Email template to HTML
    const html = await render(react)

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

      // Log error
      await logEmailSend({
        recipientEmail,
        recipientName: undefined,
        userId,
        templateId: type,
        subject,
        status: 'FAILED',
        errorMessage: result.error.message,
        metadata: orderId ? { orderId } : undefined,
      }).catch((err) => {
        console.error('Failed to log email error:', err)
      })

      return {
        success: false,
        error: result.error.message,
      }
    }

    // Log successful send
    await logEmailSend({
      recipientEmail,
      recipientName: undefined,
      userId,
      templateId: type,
      subject,
      status: 'SENT',
      metadata: orderId ? { orderId } : undefined,
    }).catch((err) => {
      // Don't fail email send if logging fails
      console.error('Failed to log email send:', err)
    })

    console.log(`Email sent successfully: ${type} to ${emailHash}`)

    return {
      success: true,
      messageId: result.data?.id,
      data: result.data,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Email send error:', error)

    // Log error
    await logEmailSend({
      recipientEmail,
      recipientName: undefined,
      userId,
      templateId: type,
      subject,
      status: 'FAILED',
      errorMessage,
      metadata: orderId ? { orderId } : undefined,
    }).catch((err) => {
      console.error('Failed to log email error:', err)
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Render React Email template to HTML (for preview/testing)
 */
export async function renderEmailTemplate(react: React.ReactElement): Promise<string> {
  return await render(react)
}
