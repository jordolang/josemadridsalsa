'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import {
  RewardAdminError,
  createReward,
  deleteReward,
  setRewardActive,
  updateReward,
} from '@/lib/loyalty-rewards'
import { rewardInputSchema } from '@/lib/loyalty-rewards-schema'

export type RewardActionResult = { success: true } | { error: string }

const PATH = '/admin/settings/loyalty-rewards'

async function authorize() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'settings:write'))) return null
  return user
}

function fail(error: unknown): RewardActionResult {
  if (error instanceof RewardAdminError) return { error: error.message }
  throw error
}

function parse(formData: FormData) {
  return rewardInputSchema.safeParse(Object.fromEntries(formData))
}

export async function saveRewardAction(id: string | null, formData: FormData): Promise<RewardActionResult> {
  const user = await authorize()
  if (!user) return { error: 'Unauthorized' }

  const parsed = parse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  try {
    const reward = id ? await updateReward(id, parsed.data) : await createReward(parsed.data)
    await logAudit({
      userId: user.id,
      action: id ? 'update' : 'create',
      entityType: 'LoyaltyReward',
      entityId: reward.id,
      changes: parsed.data,
    })
  } catch (error) {
    return fail(error)
  }

  revalidatePath(PATH)
  return { success: true }
}

export async function toggleRewardAction(id: string, isActive: boolean): Promise<RewardActionResult> {
  const user = await authorize()
  if (!user) return { error: 'Unauthorized' }

  try {
    await setRewardActive(id, isActive)
  } catch (error) {
    return fail(error)
  }
  await logAudit({ userId: user.id, action: 'update', entityType: 'LoyaltyReward', entityId: id, changes: { isActive } })

  revalidatePath(PATH)
  return { success: true }
}

export async function deleteRewardAction(id: string): Promise<RewardActionResult> {
  const user = await authorize()
  if (!user) return { error: 'Unauthorized' }

  try {
    await deleteReward(id)
  } catch (error) {
    return fail(error)
  }
  await logAudit({ userId: user.id, action: 'delete', entityType: 'LoyaltyReward', entityId: id })

  revalidatePath(PATH)
  return { success: true }
}
