'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption'

export async function saveEmailConfig(formData: FormData) {
  const user = await getCurrentUser()
  
  if (!user || !(await hasAnyPermission(user, ['settings:write']))) {
    return { error: 'Unauthorized' }
  }
  
  try {
    const name = formData.get('name') as string
    const fromEmail = formData.get('fromEmail') as string
    const fromName = (formData.get('fromName') as string) || null
    const replyToEmail = (formData.get('replyToEmail') as string) || null
    
    const smtpHost = (formData.get('smtpHost') as string) || null
    const smtpPort = formData.get('smtpPort') ? parseInt(formData.get('smtpPort') as string) : null
    const smtpUsername = (formData.get('smtpUsername') as string) || null
    const smtpPassword = (formData.get('smtpPassword') as string) || null
    const smtpSecure = formData.get('smtpSecure') === 'on'
    
    const useResend = formData.get('useResend') === 'on'
    const isDefault = formData.get('isDefault') === 'on'
    const isActive = formData.get('isActive') === 'on'
    
    const maxPerHour = parseInt(formData.get('maxPerHour') as string) || 1000
    const maxPerDay = parseInt(formData.get('maxPerDay') as string) || 10000
    
    if (!name || !fromEmail) {
      return { error: 'Name and from email are required' }
    }
    
    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.emailConfiguration.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }
    
    // Create configuration
    // Encrypt SMTP password before storing
    const encryptedPassword = smtpPassword ? encrypt(smtpPassword) : null
    
    await prisma.emailConfiguration.create({
      data: {
        name,
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPassword: encryptedPassword,
        smtpSecure,
        fromEmail,
        fromName,
        replyToEmail,
        isDefault,
        isActive,
        useResend,
        maxPerHour,
        maxPerDay,
      },
    })
    
    revalidatePath('/admin/settings/email')
    
    return { success: true }
  } catch (error) {
    console.error('Error saving email config:', error)
    return { error: 'Failed to save configuration' }
  }
}

export async function testEmailConfig(configId: string) {
  const user = await getCurrentUser()
  
  if (!user || !(await hasAnyPermission(user, ['settings:write']))) {
    return { success: false, message: 'Unauthorized' }
  }
  
  try {
    const config = await prisma.emailConfiguration.findUnique({
      where: { id: configId },
    })
    
    if (!config) {
      return { success: false, message: 'Configuration not found' }
    }
    
    // Test SMTP if configured
    if (config.smtpHost) {
      const decryptedPassword = config.smtpPassword
        ? isEncrypted(config.smtpPassword)
          ? decrypt(config.smtpPassword)
          : config.smtpPassword
        : null

      const port = config.smtpPort || 587
      const secure = port === 465

      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port,
        secure,
        auth: config.smtpUsername && decryptedPassword ? {
          user: config.smtpUsername,
          pass: decryptedPassword,
        } : undefined,
      })

      await transporter.verify()

      return {
        success: true,
        message: 'SMTP connection successful!',
      }
    }

    // Test Resend if configured
    if (config.useResend) {
      const resendApiKey = process.env.RESEND_API_KEY
      if (!resendApiKey) {
        return { success: false, message: 'RESEND_API_KEY environment variable is not set' }
      }

      const resend = new Resend(resendApiKey)
      // Send a test email to verify the API key and from address work
      const result = await resend.emails.send({
        from: `${config.fromName || 'Jose Madrid Salsa'} <${config.fromEmail}>`,
        to: config.replyToEmail || config.fromEmail,
        subject: 'Jose Madrid Salsa - Email Test',
        html: '<p>This is a test email from Jose Madrid Salsa. Your email configuration is working correctly.</p>',
      })

      if (result.error) {
        return { success: false, message: `Resend error: ${result.error.message}` }
      }

      return {
        success: true,
        message: `Resend connection successful! Test email sent to ${config.replyToEmail || config.fromEmail}.`,
      }
    }

    return { success: false, message: 'No email provider configured (SMTP or Resend)' }
  } catch (error) {
    console.error('SMTP test error:', error)
    return { 
      success: false, 
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

export async function updateSmtpPassword(configId: string, password: string) {
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['settings:write']))) {
    return { error: 'Unauthorized' }
  }

  try {
    const encryptedPassword = password ? encrypt(password) : null

    await prisma.emailConfiguration.update({
      where: { id: configId },
      data: { smtpPassword: encryptedPassword },
    })

    revalidatePath('/admin/settings/email')

    return { success: true }
  } catch (error) {
    console.error('Error updating SMTP password:', error)
    return { error: 'Failed to update password' }
  }
}

export async function deleteEmailConfig(configId: string) {
  const user = await getCurrentUser()
  
  if (!user || !(await hasAnyPermission(user, ['settings:write']))) {
    return { error: 'Unauthorized' }
  }
  
  try {
    await prisma.emailConfiguration.delete({
      where: { id: configId },
    })
    
    revalidatePath('/admin/settings/email')
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting email config:', error)
    return { error: 'Failed to delete configuration' }
  }
}
