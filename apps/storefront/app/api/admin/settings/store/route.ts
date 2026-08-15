import { NextRequest } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { getStoreSettings } from '@/lib/store-settings'

/** Empty string from a form clears the field back to null. */
const nullableText = z
  .string()
  .trim()
  .max(2000)
  .transform((s) => (s.length > 0 ? s : null))
  .nullable()
  .optional()

const StoreSettingsSchema = z.object({
  allowGuestCheckout: z.boolean().optional(),
  minimumOrderCents: z.number().int().min(0).max(100_000_000).optional(),
  businessName: nullableText,
  supportEmail: z.string().trim().email().nullable().optional().or(z.literal('').transform(() => null)),
  supportPhone: nullableText,
  businessAddress: nullableText,
  defaultLowStockThreshold: z.number().int().min(0).max(1_000_000).optional(),
  termsContent: z.string().max(50_000).nullable().optional(),
  privacyContent: z.string().max(50_000).nullable().optional(),
  returnsContent: z.string().max(50_000).nullable().optional(),
})

export async function GET() {
  try {
    await requirePermission('settings:read')
    return ok({ settings: await getStoreSettings() })
  } catch (error) {
    return failFromError(error, 'Failed to load store settings')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requirePermission('settings:write')
    const body = await request.json()
    const data = StoreSettingsSchema.parse(body)

    const settings = await prisma.storeSettings.upsert({
      where: { singleton: 'singleton' },
      create: { singleton: 'singleton', ...data, updatedById: user.id },
      update: { ...data, updatedById: user.id },
    })

    await logAudit({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'StoreSettings',
      entityId: settings.id,
      changes: data,
    })

    return ok({ settings })
  } catch (error: any) {
    if (error instanceof SyntaxError) return fail('Invalid JSON body', 400)
    if (error?.name === 'ZodError') return fail('Invalid settings', 400, error.issues)
    return failFromError(error, 'Failed to save store settings')
  }
}
