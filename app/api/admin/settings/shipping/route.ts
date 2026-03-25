import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAuditWithRequest } from '@/lib/audit'
import { Prisma } from '@prisma/client'
import { ALLOWED_CARRIERS } from '@/lib/shipping-carriers'

const carrierEnum = z.enum(ALLOWED_CARRIERS)

const OriginAddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
})

const ShippingSettingsSchema = z
  .object({
    freeShippingThreshold: z.number().positive().nullable().optional(),
    originAddress: OriginAddressSchema.nullable().optional(),
    defaultCarrier: carrierEnum.nullable().optional(),
    enabledCarriers: z.array(carrierEnum).optional(),
  })
  .refine(
    (data) => {
      if (data.defaultCarrier && data.enabledCarriers) {
        return data.enabledCarriers.includes(data.defaultCarrier)
      }
      return true
    },
    { message: 'Default carrier must be one of the enabled carriers' }
  )

export async function GET(request: NextRequest) {
  try {
    await requirePermission('settings:read')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const settings = await prisma.shippingSettings.findUnique({
      where: { singleton: 'singleton' },
    })

    if (!settings) {
      return NextResponse.json({ data: null }, { status: 200 })
    }

    return NextResponse.json({
      data: {
        id: settings.id,
        freeShippingThreshold: settings.freeShippingThreshold,
        originAddress: settings.originAddress,
        defaultCarrier: settings.defaultCarrier,
        enabledCarriers: settings.enabledCarriers,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      },
    })
  } catch (error) {
    console.error('[Shipping Settings API] Get settings error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shipping settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requirePermission('settings:write')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const payload = await request.json()
    const parsed = ShippingSettingsSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid shipping settings data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data

    const upsertData = {
      freeShippingThreshold: data.freeShippingThreshold ?? null,
      originAddress: data.originAddress ? data.originAddress : Prisma.JsonNull,
      defaultCarrier: data.defaultCarrier ?? null,
      enabledCarriers: data.enabledCarriers ?? [],
      updatedById: user.id,
    }

    const settings = await prisma.shippingSettings.upsert({
      where: { singleton: 'singleton' },
      create: upsertData,
      update: upsertData,
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'shipping_settings.upsert',
        entityType: 'ShippingSettings',
        entityId: settings.id,
        changes: {
          freeShippingThreshold: data.freeShippingThreshold,
          originAddress: data.originAddress,
          defaultCarrier: data.defaultCarrier,
          enabledCarriers: data.enabledCarriers,
        },
      },
      request
    )

    return NextResponse.json({
      data: {
        id: settings.id,
        freeShippingThreshold: settings.freeShippingThreshold,
        originAddress: settings.originAddress,
        defaultCarrier: settings.defaultCarrier,
        enabledCarriers: settings.enabledCarriers,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      },
    })
  } catch (error) {
    console.error('[Shipping Settings API] Save settings error:', error)
    return NextResponse.json(
      { error: 'Failed to save shipping settings' },
      { status: 500 }
    )
  }
}
