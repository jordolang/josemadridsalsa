'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { refreshOpenOrdersList } from '@/lib/email/open-orders'

export async function createMailingList(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    throw new Error('Unauthorized')
  }

  const name = formData.get('name') as string
  const description = formData.get('description') as string

  if (!name) {
    throw new Error('Name is required')
  }

  await prisma.mailingList.create({
    data: {
      name,
      description: description || null,
    },
  })

  revalidatePath('/admin/communications/lists')
}

export async function deleteMailingList(id: string) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    throw new Error('Unauthorized')
  }

  await prisma.mailingList.delete({
    where: { id },
  })

  revalidatePath('/admin/communications/lists')
}

/** Purge the Open Orders list and rebuild it from the orders that are open now. */
export async function refreshOpenOrdersListAction() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    throw new Error('Unauthorized')
  }

  const result = await refreshOpenOrdersList(user.id)
  await logAudit({
    userId: user.id,
    action: 'mailingList.openOrders.refresh',
    entityType: 'mailingList',
    entityId: result.listId,
    changes: { ...result },
  })

  revalidatePath('/admin/communications/lists')
  return result
}
