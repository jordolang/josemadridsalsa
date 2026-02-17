/**
 * Email Logging and Unsubscribe Utilities
 * Handles email send logging and unsubscribe preference checking
 */

import { prisma } from '@/lib/prisma'
import { EmailLogStatus } from '@prisma/client'

interface LogEmailSendOptions {
  recipientEmail: string
  recipientName?: string
  userId?: string
  templateId?: string
  subject: string
  status?: EmailLogStatus
  metadata?: Record<string, any>
  errorMessage?: string
}

interface UpdateEmailLogOptions {
  id: string
  status?: EmailLogStatus
  openedAt?: Date
  clickedAt?: Date
  bouncedAt?: Date
  failedAt?: Date
  errorMessage?: string
}

interface CheckUnsubscribedOptions {
  email: string
  category?: string | string[]
}

/**
 * Log an email send attempt to the database
 */
export async function logEmailSend(options: LogEmailSendOptions) {
  try {
    const emailLog = await prisma.emailLog.create({
      data: {
        recipientEmail: options.recipientEmail,
        recipientName: options.recipientName,
        userId: options.userId,
        templateId: options.templateId,
        subject: options.subject,
        status: options.status || 'PENDING',
        metadata: options.metadata,
        errorMessage: options.errorMessage,
        sentAt: options.status === 'SENT' ? new Date() : undefined,
        failedAt: options.status === 'FAILED' ? new Date() : undefined,
      },
    })

    return emailLog
  } catch (error) {
    console.error('Error logging email send:', error)
    throw error
  }
}

/**
 * Update an email log with new status or tracking information
 */
export async function updateEmailLog(options: UpdateEmailLogOptions) {
  try {
    const emailLog = await prisma.emailLog.update({
      where: { id: options.id },
      data: {
        status: options.status,
        openedAt: options.openedAt,
        clickedAt: options.clickedAt,
        bouncedAt: options.bouncedAt,
        failedAt: options.failedAt,
        errorMessage: options.errorMessage,
        sentAt: options.status === 'SENT' && !options.failedAt ? new Date() : undefined,
      },
    })

    return emailLog
  } catch (error) {
    console.error('Error updating email log:', error)
    throw error
  }
}

/** Categories considered marketing (fail-closed on DB error) */
const MARKETING_CATEGORIES = ['marketing', 'newsletter', 'promotions', 'announcements']

/**
 * Check if a user has unsubscribed from emails
 * Returns true if user is unsubscribed from the specified category or all emails
 * Fails closed for marketing emails (returns true on DB error)
 */
export async function checkUnsubscribed(options: CheckUnsubscribedOptions): Promise<boolean> {
  const isMarketing = options.category
    ? (Array.isArray(options.category) ? options.category : [options.category])
        .some((c) => MARKETING_CATEGORIES.includes(c))
    : false

  try {
    const preference = await prisma.unsubscribePreference.findUnique({
      where: { email: options.email },
    })

    if (!preference) {
      return false
    }

    // Check if unsubscribed from all emails
    if (preference.unsubscribeAll) {
      return true
    }

    // Check if unsubscribed from specific category
    if (options.category) {
      const categories = Array.isArray(options.category) ? options.category : [options.category]

      return categories.some((cat) => preference.unsubscribedFrom.includes(cat))
    }

    return false
  } catch (error) {
    console.error('Error checking unsubscribe status:', error)
    // Fail closed for marketing emails - don't send if we can't verify
    return isMarketing
  }
}

/**
 * Add an unsubscribe preference for an email address
 * Uses Set to deduplicate categories
 */
export async function unsubscribeFromCategory(
  email: string,
  category: string | string[],
  userId?: string
) {
  try {
    const categories = Array.isArray(category) ? category : [category]

    // First check for existing record to deduplicate
    const existing = await prisma.unsubscribePreference.findUnique({
      where: { email },
    })

    const mergedCategories = existing
      ? [...new Set([...existing.unsubscribedFrom, ...categories])]
      : categories

    const preference = await prisma.unsubscribePreference.upsert({
      where: { email },
      create: {
        email,
        userId,
        unsubscribedFrom: categories,
        unsubscribeAll: false,
      },
      update: {
        unsubscribedFrom: mergedCategories,
      },
    })

    return preference
  } catch (error) {
    console.error('Error adding unsubscribe preference:', error)
    throw error
  }
}

/**
 * Unsubscribe from all emails
 */
export async function unsubscribeFromAll(email: string, userId?: string) {
  try {
    const preference = await prisma.unsubscribePreference.upsert({
      where: { email },
      create: {
        email,
        userId,
        unsubscribeAll: true,
        unsubscribedFrom: [],
      },
      update: {
        unsubscribeAll: true,
      },
    })

    return preference
  } catch (error) {
    console.error('Error unsubscribing from all emails:', error)
    throw error
  }
}

/**
 * Resubscribe to a specific category
 */
export async function resubscribeToCategory(email: string, category: string | string[]) {
  try {
    const preference = await prisma.unsubscribePreference.findUnique({
      where: { email },
    })

    if (!preference) {
      return null
    }

    const categories = Array.isArray(category) ? category : [category]
    const updatedCategories = preference.unsubscribedFrom.filter(
      (cat) => !categories.includes(cat)
    )

    const updated = await prisma.unsubscribePreference.update({
      where: { email },
      data: {
        unsubscribedFrom: updatedCategories,
        // Only clear unsubscribeAll if resubscribing to all categories
        // Don't force unsubscribeAll: false when resubscribing to a single category
      },
    })

    return updated
  } catch (error) {
    console.error('Error resubscribing to category:', error)
    throw error
  }
}

/**
 * Get email statistics for a recipient
 */
export async function getEmailStats(email: string) {
  try {
    const [stats, totalSent, totalOpened, totalClicked, lastEmail] = await Promise.all([
      prisma.emailLog.groupBy({
        by: ['status'],
        where: { recipientEmail: email },
        _count: true,
      }),
      prisma.emailLog.count({
        where: { recipientEmail: email, status: 'SENT' },
      }),
      prisma.emailLog.count({
        where: { recipientEmail: email, openedAt: { not: null } },
      }),
      prisma.emailLog.count({
        where: { recipientEmail: email, clickedAt: { not: null } },
      }),
      prisma.emailLog.findFirst({
        where: { recipientEmail: email },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return {
      stats,
      totalSent,
      totalOpened,
      totalClicked,
      openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
      clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
      lastEmail,
    }
  } catch (error) {
    console.error('Error getting email stats:', error)
    throw error
  }
}

/**
 * Get recent email logs for a user
 */
export async function getRecentEmailLogs(userId: string, limit = 10) {
  try {
    const logs = await prisma.emailLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return logs
  } catch (error) {
    console.error('Error getting recent email logs:', error)
    throw error
  }
}
