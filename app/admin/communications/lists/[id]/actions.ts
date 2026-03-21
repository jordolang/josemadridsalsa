'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { SubscriberStatus } from '@prisma/client'

export async function addSubscriber(listId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    throw new Error('Unauthorized')
  }

  const email = formData.get('email') as string
  const nameStr = formData.get('name') as string

  let firstName = null;
  let lastName = null;
  if (nameStr) {
    const parts = nameStr.trim().split(' ');
    firstName = parts[0] || null;
    lastName = parts.slice(1).join(' ') || null;
  }

  if (!email) {
    throw new Error('Email is required')
  }

  try {
    await prisma.mailingListSubscriber.create({
      data: {
        listId,
        email,
        firstName,
        lastName,
        source: 'manual_admin',
      },
    })
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new Error('Subscriber already exists on this list')
    }
    throw new Error('Failed to add subscriber')
  }

  revalidatePath(`/admin/communications/lists/${listId}`)
}

export async function updateSubscriberStatus(id: string, listId: string, status: SubscriberStatus) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    throw new Error('Unauthorized')
  }

  await prisma.mailingListSubscriber.update({
    where: { id },
    data: { status },
  })

  revalidatePath(`/admin/communications/lists/${listId}`)
}

export async function removeSubscriber(id: string, listId: string) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    throw new Error('Unauthorized')
  }

  await prisma.mailingListSubscriber.delete({
    where: { id },
  })

  revalidatePath(`/admin/communications/lists/${listId}`)
}
