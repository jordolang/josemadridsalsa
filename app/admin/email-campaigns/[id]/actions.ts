'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { retryCampaignFailures } from '@/lib/email/sender'

export async function retryCampaignFailuresAction(campaignId: string) {
  const user = await getCurrentUser()

  if (!user || !(await hasAnyPermission(user, ['content:write']))) {
    return { error: 'Unauthorized' }
  }

  try {
    retryCampaignFailures(campaignId).catch((error) => {
      console.error('Retry campaign failures error:', error)
    })

    revalidatePath('/admin/email-campaigns')
    revalidatePath(`/admin/email-campaigns/${campaignId}`)

    return { success: true }
  } catch (error) {
    console.error('Error retrying campaign failures:', error)
    return { error: 'Failed to retry campaign failures' }
  }
}
