'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

const idSchema = z.string().cuid()

// Only PENDING applications are decided here; the updateMany guard makes a
// double-click or a stale tab a no-op instead of overwriting a prior decision.
async function decide(formData: FormData, status: 'APPROVED' | 'REJECTED') {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'users:write'))) {
    throw new Error('Not authorized')
  }

  const id = idSchema.parse(formData.get('id'))
  const approved = status === 'APPROVED'

  const { count } = await prisma.wholesaleAccount.updateMany({
    where: { id, status: 'PENDING' },
    data: {
      status,
      approvedAt: approved ? new Date() : null,
      approvedBy: approved ? user.id : null,
    },
  })

  if (count > 0) {
    await logAudit({
      userId: user.id,
      action: approved ? 'approve' : 'reject',
      entityType: 'WholesaleAccount',
      entityId: id,
      changes: { status },
    })
  }

  revalidatePath('/admin/wholesale')
}

export async function approveWholesaleAccount(formData: FormData) {
  await decide(formData, 'APPROVED')
}

export async function rejectWholesaleAccount(formData: FormData) {
  await decide(formData, 'REJECTED')
}
