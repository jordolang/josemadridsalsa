'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

const REQUIRED_PERMS = ['orders:write']

const formSchema = z.object({
  code: z.string().min(1).max(50),
  description: z.string().max(255).optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value: z.coerce.number().min(0),
  maxUses: z.coerce.number().int().positive().optional(),
  maxUsesPerUser: z.coerce.number().int().positive().optional(),
  minPurchase: z.coerce.number().nonnegative().optional(),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional(),
  isActive: z.coerce.boolean().default(true),
})

export type DiscountCodeFormResult =
  | { success: true; id: string }
  | { error: string; fieldErrors?: Record<string, string[]> }

function pickValues(formData: FormData): Record<string, unknown> {
  const fields = [
    'code',
    'description',
    'type',
    'value',
    'maxUses',
    'maxUsesPerUser',
    'minPurchase',
    'startsAt',
    'expiresAt',
  ] as const
  const out: Record<string, unknown> = {
    isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
  }
  for (const f of fields) {
    const v = formData.get(f)
    if (typeof v === 'string' && v.length > 0) out[f] = v
  }
  return out
}

export async function createDiscountCode(
  formData: FormData,
): Promise<DiscountCodeFormResult> {
  const user = await getCurrentUser()
  if (!user || !(await hasAnyPermission(user, REQUIRED_PERMS))) {
    return { error: 'Unauthorized' }
  }

  const parsed = formSchema.safeParse(pickValues(formData))
  if (!parsed.success) {
    return {
      error: 'Invalid input',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const data = parsed.data
  const code = data.code.toUpperCase()

  const existing = await prisma.discountCode.findUnique({ where: { code } })
  if (existing) {
    return { error: 'A discount code with that code already exists' }
  }

  const created = await prisma.discountCode.create({
    data: {
      code,
      description: data.description || null,
      type: data.type,
      value: data.value,
      maxUses: data.maxUses ?? null,
      maxUsesPerUser: data.maxUsesPerUser ?? null,
      minPurchase: data.minPurchase ?? null,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: data.isActive,
      createdById: user.id,
    },
  })

  await logAudit({
    userId: user.id,
    action: 'CREATE',
    entityType: 'DiscountCode',
    entityId: created.id,
    changes: { code, type: data.type, value: data.value, isActive: data.isActive },
  })

  revalidatePath('/admin/settings/discount-codes')
  revalidatePath('/admin/email-campaigns/new')
  return { success: true, id: created.id }
}

export async function updateDiscountCode(
  id: string,
  formData: FormData,
): Promise<DiscountCodeFormResult> {
  const user = await getCurrentUser()
  if (!user || !(await hasAnyPermission(user, REQUIRED_PERMS))) {
    return { error: 'Unauthorized' }
  }

  const parsed = formSchema.safeParse(pickValues(formData))
  if (!parsed.success) {
    return {
      error: 'Invalid input',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const data = parsed.data
  const code = data.code.toUpperCase()

  const conflict = await prisma.discountCode.findFirst({
    where: { code, NOT: { id } },
    select: { id: true },
  })
  if (conflict) {
    return { error: 'Another discount code already uses that code' }
  }

  await prisma.discountCode.update({
    where: { id },
    data: {
      code,
      description: data.description || null,
      type: data.type,
      value: data.value,
      maxUses: data.maxUses ?? null,
      maxUsesPerUser: data.maxUsesPerUser ?? null,
      minPurchase: data.minPurchase ?? null,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: data.isActive,
    },
  })

  await logAudit({
    userId: user.id,
    action: 'UPDATE',
    entityType: 'DiscountCode',
    entityId: id,
    changes: { code, type: data.type, value: data.value, isActive: data.isActive },
  })

  revalidatePath('/admin/settings/discount-codes')
  revalidatePath('/admin/email-campaigns/new')
  return { success: true, id }
}

export async function toggleDiscountCode(
  id: string,
  isActive: boolean,
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser()
  if (!user || !(await hasAnyPermission(user, REQUIRED_PERMS))) {
    return { error: 'Unauthorized' }
  }

  await prisma.discountCode.update({
    where: { id },
    data: { isActive },
  })

  await logAudit({
    userId: user.id,
    action: 'UPDATE',
    entityType: 'DiscountCode',
    entityId: id,
    changes: { isActive },
  })

  revalidatePath('/admin/settings/discount-codes')
  revalidatePath('/admin/email-campaigns/new')
  return { success: true }
}

export async function deleteDiscountCode(
  id: string,
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser()
  if (!user || !(await hasAnyPermission(user, REQUIRED_PERMS))) {
    return { error: 'Unauthorized' }
  }

  const code = await prisma.discountCode.findUnique({
    where: { id },
    select: { _count: { select: { usages: true } } },
  })

  if (!code) return { error: 'Discount code not found' }
  if (code._count.usages > 0) {
    return {
      error: `Cannot delete — code has been used ${code._count.usages} time(s). Deactivate it instead.`,
    }
  }

  await prisma.discountCode.delete({ where: { id } })

  await logAudit({
    userId: user.id,
    action: 'DELETE',
    entityType: 'DiscountCode',
    entityId: id,
    changes: {},
  })

  revalidatePath('/admin/settings/discount-codes')
  revalidatePath('/admin/email-campaigns/new')
  return { success: true }
}
