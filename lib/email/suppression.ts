import { prisma } from '@/lib/prisma'

/**
 * Check if an email is on the suppression list or has globally unsubscribed
 */
export async function checkSuppression(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim()

  const [suppression, unsubPref] = await Promise.all([
    prisma.emailSuppression.findUnique({ where: { email: normalizedEmail } }),
    prisma.unsubscribePreference.findUnique({ where: { email: normalizedEmail } }),
  ])

  return !!suppression || !!(unsubPref?.unsubscribeAll)
}

/**
 * Add an email to the suppression list
 */
export async function addSuppression(
  email: string,
  reason: 'HARD_BOUNCE' | 'SOFT_BOUNCE' | 'SPAM_COMPLAINT' | 'MANUAL' | 'UNSUBSCRIBE' | 'ADMIN',
  source?: string,
  campaignId?: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim()
  await prisma.emailSuppression.upsert({
    where: { email: normalizedEmail },
    create: { email: normalizedEmail, reason, source, campaignId },
    update: { reason, source, campaignId },
  })
}
