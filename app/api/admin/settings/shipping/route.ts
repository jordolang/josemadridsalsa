import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAuditWithRequest } from '@/lib/audit'
import { Prisma } from '@prisma/client'

const OriginAddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
})

const ShippingSettingsSchema = z.object({
  freeShippingThreshold: z.number().positive().nullable().optional(),
  originAddress: OriginAddressSchema.nullable().optional(),
  defaultCarrier: z.string().nullable().optional(),
  enabledCarriers: z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const hasPermission = await requirePermission('settings:read')

    if (!hasPermission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const settings = await prisma.shippingSettings.findFirst({
      orderBy: { createdAt: 'desc' },
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
  try {
    const hasPermission = await requirePermission('settings:write')

    if (!hasPermission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const payload = await request.json()
    const parsed = ShippingSettingsSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid shipping settings data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data

    const existing = await prisma.shippingSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    let settings

    if (existing) {
      const updateData: any = {
        updatedById: user.id,
      }

      if (data.freeShippingThreshold !== undefined) {
        updateData.freeShippingThreshold = data.freeShippingThreshold
      }

      if (data.originAddress !== undefined) {
        updateData.originAddress = data.originAddress ? data.originAddress : Prisma.JsonNull
      }

      if (data.defaultCarrier !== undefined) {
        updateData.defaultCarrier = data.defaultCarrier
      }

      if (data.enabledCarriers !== undefined) {
        updateData.enabledCarriers = { set: data.enabledCarriers }
      }

      settings = await prisma.shippingSettings.update({
        where: { id: existing.id },
        data: updateData,
      })

      await logAuditWithRequest(
        {
          userId: user.id,
          action: 'shipping_settings.update',
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
    } else {
      settings = await prisma.shippingSettings.create({
        data: {
          freeShippingThreshold: data.freeShippingThreshold ?? null,
          originAddress: data.originAddress ? data.originAddress : Prisma.JsonNull,
          defaultCarrier: data.defaultCarrier ?? null,
          enabledCarriers: data.enabledCarriers ?? [],
          updatedById: user.id,
        },
      })

      await logAuditWithRequest(
        {
          userId: user.id,
          action: 'shipping_settings.create',
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
    console.error('[Shipping Settings API] Save settings error:', error)
    return NextResponse.json(
      { error: 'Failed to save shipping settings' },
      { status: 500 }
    )
  }
}
