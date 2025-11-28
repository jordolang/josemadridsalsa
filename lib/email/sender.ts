/**
 * Email Sending Service
 * Handles bulk email sending with rate limiting, retries, and variable substitution
 */

import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import nodemailer from 'nodemailer'

const resendApiKey = process.env.RESEND_API_KEY

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

interface EmailRecipientData {
  id: string
  email: string
  name?: string
  variables?: Record<string, any>
}

interface CampaignSendOptions {
  campaignId: string
  batchSize?: number
  delayBetweenBatches?: number // milliseconds
}

/**
 * Replace template variables with actual values
 */
export function substituteVariables(
  template: string,
  variables: Record<string, any>
): string {
  let result = template
  
  // Replace {{variable}} patterns
  Object.keys(variables).forEach((key) => {
    const value = variables[key] ?? ''
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    result = result.replace(regex, String(value))
  })
  
  return result
}

/**
 * Get SMTP transporter from configuration
 */
async function getSMTPTransporter(configId?: string) {
  let config = null
  
  if (configId) {
    config = await prisma.emailConfiguration.findUnique({
      where: { id: configId, isActive: true },
    })
  } else {
    // Get default config
    config = await prisma.emailConfiguration.findFirst({
      where: { isDefault: true, isActive: true },
    })
  }
  
  if (!config || !config.smtpHost) {
    return null
  }
  
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort || 587,
    secure: config.smtpSecure,
    auth: config.smtpUsername && config.smtpPassword ? {
      user: config.smtpUsername,
      pass: config.smtpPassword, // TODO: Decrypt if encrypted
    } : undefined,
  })
  
  return { transporter, config }
}

/**
 * Send a single email using Resend or SMTP
 */
export async function sendEmail(
  options: SendEmailOptions,
  configId?: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    // Try SMTP first if configured
    const smtpConfig = await getSMTPTransporter(configId)
    
    if (smtpConfig) {
      const { transporter, config } = smtpConfig
      
      try {
        const replyTo = options.replyTo ?? config.replyToEmail ?? undefined
        const info = (await transporter.sendMail({
          from: options.from || `${config.fromName || 'Jose Madrid Salsa'} <${config.fromEmail}>`,
          to: options.to,
          replyTo,
          subject: options.subject,
          html: options.html,
          text: options.text,
        })) as nodemailer.SentMessageInfo
        
        return {
          success: true,
          messageId: info.messageId,
        }
      } catch (smtpError) {
        console.error('SMTP send failed:', smtpError)
        
        // Fall back to Resend if configured
        if (config.useResend && resendApiKey) {
          console.log('Falling back to Resend...')
        } else {
          throw smtpError
        }
      }
    }
    
    // Use Resend as fallback or primary
    if (resendApiKey) {
      const resend = new Resend(resendApiKey)
      
      const result = await resend.emails.send({
        from: options.from || process.env.FROM_EMAIL || 'no-reply@josemadridsalsa.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      })
      
      if (result.error) {
        return {
          success: false,
          error: result.error.message,
        }
      }
      
      return {
        success: true,
        messageId: result.data?.id,
      }
    }
    
    return {
      success: false,
      error: 'No email service configured (SMTP or Resend)',
    }
  } catch (error) {
    console.error('Email send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send email campaign to all recipients
 */
export async function sendCampaign({
  campaignId,
  batchSize = 50,
  delayBetweenBatches = 1000,
}: CampaignSendOptions): Promise<{
  success: boolean
  sent: number
  failed: number
  errors: Array<{ recipientId: string; error: string }>
}> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: {
      template: true,
      recipients: {
        where: {
          status: 'PENDING',
        },
      },
    },
  })
  
  if (!campaign) {
    throw new Error('Campaign not found')
  }
  
  if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
    throw new Error('Campaign must be in DRAFT or SCHEDULED status to send')
  }
  
  // Update campaign status
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: 'SENDING',
      startedAt: new Date(),
    },
  })
  
  const recipients = campaign.recipients
  const template = campaign.template
  
  let sent = 0
  let failed = 0
  const errors: Array<{ recipientId: string; error: string }> = []
  
  // Process in batches
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize)
    
    // Send batch in parallel
    await Promise.all(
      batch.map(async (recipient) => {
        try {
          // Mark as sending
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: { status: 'SENDING' },
          })
          
          // Prepare variables
          const variables = {
            ...(recipient.variables as Record<string, any> || {}),
            name: recipient.name || recipient.email.split('@')[0],
            email: recipient.email,
          }
          
          // Substitute variables in subject, html, and text
          const subject = substituteVariables(campaign.subject, variables)
          const html = substituteVariables(template.html, variables)
          const text = template.text ? substituteVariables(template.text, variables) : undefined
          
          // Send email
          const result = await sendEmail({
            to: recipient.email,
            subject,
            html,
            text,
          })
          
          if (result.success) {
            // Update recipient status
            await prisma.emailRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'SENT',
                sentAt: new Date(),
              },
            })
            
            sent++
          } else {
            // Mark as failed
            await prisma.emailRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'FAILED',
                failedAt: new Date(),
                errorMessage: result.error,
                retryCount: recipient.retryCount + 1,
              },
            })
            
            failed++
            errors.push({
              recipientId: recipient.id,
              error: result.error || 'Unknown error',
            })
          }
        } catch (error) {
          console.error(`Error sending to ${recipient.email}:`, error)
          
          // Mark as failed
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              retryCount: recipient.retryCount + 1,
            },
          })
          
          failed++
          errors.push({
            recipientId: recipient.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      })
    )
    
    // Update campaign progress
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        sentCount: sent,
        failedCount: failed,
      },
    })
    
    // Delay between batches to respect rate limits
    if (i + batchSize < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches))
    }
  }
  
  // Update campaign as completed
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: sent > 0 && failed === 0 ? 'SENT' : failed > 0 && sent === 0 ? 'FAILED' : 'SENT',
      completedAt: new Date(),
      sentCount: sent,
      failedCount: failed,
    },
  })
  
  // Update template sent count
  await prisma.emailTemplate.update({
    where: { id: template.id },
    data: {
      sentCount: { increment: sent },
      lastSentAt: new Date(),
    },
  })
  
  return {
    success: failed === 0,
    sent,
    failed,
    errors,
  }
}

/**
 * Retry failed recipients in a campaign
 */
export async function retryCampaignFailures(campaignId: string) {
  const failedRecipients = await prisma.emailRecipient.findMany({
    where: {
      campaignId,
      status: 'FAILED',
      retryCount: { lt: 3 }, // Max 3 retries
    },
  })
  
  // Reset to pending for retry
  await prisma.emailRecipient.updateMany({
    where: {
      id: { in: failedRecipients.map((r) => r.id) },
    },
    data: {
      status: 'PENDING',
      errorMessage: null,
    },
  })
  
  // Send campaign again (only pending recipients will be sent)
  return sendCampaign({ campaignId })
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Parse CSV content into recipient list
 */
export function parseCSV(csvContent: string): {
  recipients: Array<{ email: string; name?: string; variables?: Record<string, any> }>
  errors: string[]
} {
  const lines = csvContent.trim().split('\n')
  const recipients: Array<{ email: string; name?: string; variables?: Record<string, any> }> = []
  const errors: string[] = []
  
  if (lines.length === 0) {
    return { recipients, errors: ['CSV file is empty'] }
  }
  
  // Parse header
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const emailIndex = headers.findIndex((h) => h === 'email')
  
  if (emailIndex === -1) {
    return { recipients, errors: ['CSV must have an "email" column'] }
  }
  
  const nameIndex = headers.findIndex((h) => h === 'name')
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    const values = line.split(',').map((v) => v.trim())
    const email = values[emailIndex]
    
    if (!email) {
      errors.push(`Row ${i + 1}: Missing email`)
      continue
    }
    
    if (!isValidEmail(email)) {
      errors.push(`Row ${i + 1}: Invalid email: ${email}`)
      continue
    }
    
    const recipient: any = { email }
    
    if (nameIndex !== -1 && values[nameIndex]) {
      recipient.name = values[nameIndex]
    }
    
    // Add other columns as variables
    const variables: Record<string, any> = {}
    headers.forEach((header, idx) => {
      if (idx !== emailIndex && idx !== nameIndex && values[idx]) {
        variables[header] = values[idx]
      }
    })
    
    if (Object.keys(variables).length > 0) {
      recipient.variables = variables
    }
    
    recipients.push(recipient)
  }
  
  return { recipients, errors }
}

/**
 * Parse plain text email list (one email per line)
 */
export function parseTextList(textContent: string): {
  recipients: Array<{ email: string }>
  errors: string[]
} {
  const lines = textContent.trim().split('\n')
  const recipients: Array<{ email: string }> = []
  const errors: string[] = []
  
  lines.forEach((line, index) => {
    const email = line.trim()
    
    if (!email) return
    
    if (!isValidEmail(email)) {
      errors.push(`Line ${index + 1}: Invalid email: ${email}`)
      return
    }
    
    recipients.push({ email })
  })
  
  return { recipients, errors }
}
