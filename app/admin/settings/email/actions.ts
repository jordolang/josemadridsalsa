'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import nodemailer from 'nodemailer'
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
    
    if (!config.smtpHost) {
      return { success: false, message: 'No SMTP configuration to test' }
    }
    
    // Decrypt password — handle both encrypted and plaintext (legacy/seed) values
    const decryptedPassword = config.smtpPassword
      ? isEncrypted(config.smtpPassword)
        ? decrypt(config.smtpPassword)
        : config.smtpPassword
      : null
    
    const port = config.smtpPort || 587
    // Port 465 = implicit SSL (secure: true), port 587 = STARTTLS (secure: false)
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

    // Verify connection
    await transporter.verify()
    
    return { 
      success: true, 
      message: 'Connection successful! SMTP server is configured correctly.' 
    }
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
