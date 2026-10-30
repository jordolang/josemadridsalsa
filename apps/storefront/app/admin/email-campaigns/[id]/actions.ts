'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { z } from 'zod'
import { retryCampaignFailures } from '@/lib/email/sender'
import { AudienceCheckError, confirmAudience, getAudienceCheck } from '@/lib/email/audience-check'

export async function retryCampaignFailuresAction(campaignId: string) {
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }

  try {
    const result = await retryCampaignFailures(campaignId)

    if (!result.success) {
      return { error: result.error ?? 'Failed to retry campaign failures' }
    }

    revalidatePath('/admin/email-campaigns')
    revalidatePath(`/admin/email-campaigns/${campaignId}`)

    return { success: true, retriableCount: result.retriableCount }
  } catch (error) {
    console.error('Error retrying campaign failures:', error)
    return { error: 'Failed to retry campaign failures' }
  }
}

export async function getAudienceCheckAction(campaignId: string) {
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }

  try {
    const check = await getAudienceCheck(campaignId)
    if (!check) return { error: 'Campaign not found' }
    return { success: true, check }
  } catch (error) {
    console.error('Error loading campaign audience:', error)
    return { error: 'Failed to load the audience' }
  }
}

const confirmAudienceSchema = z.object({
  campaignId: z.string().min(1),
  expectedRecipients: z.number().int().min(0),
  onlyOpenOrders: z.boolean(),
})

export async function confirmAudienceAction(input: z.infer<typeof confirmAudienceSchema>) {
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }

  const parsed = confirmAudienceSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid request' }

  try {
    const result = await confirmAudience({ ...parsed.data, userId: user.id })

    revalidatePath('/admin/email-campaigns')
    revalidatePath(`/admin/email-campaigns/${parsed.data.campaignId}`)

    return { success: true, ...result }
  } catch (error) {
    if (error instanceof AudienceCheckError) return { error: error.message }
    console.error('Error confirming campaign audience:', error)
    return { error: 'Failed to confirm the audience' }
  }
}
