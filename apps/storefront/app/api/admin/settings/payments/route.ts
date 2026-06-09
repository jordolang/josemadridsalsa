import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const UpdateProviderSchema = z.object({
  provider: z.enum(['STRIPE', 'SQUARE', 'PAYPAL']),
  isActive: z.boolean().optional(),
  testMode: z.boolean().optional(),
  supportedMethods: z.array(z.string()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

export async function GET() {
  try {
    const user = await requirePermission('settings:read')

    const configs = await prisma.paymentProviderConfig.findMany({
      orderBy: { provider: 'asc' },
    })

    // Strip sensitive credential fields before returning
    const sanitized = configs.map((config) => ({
      id: config.id,
      provider: config.provider,
      isActive: config.isActive,
      testMode: config.testMode,
      supportedMethods: config.supportedMethods,
      config: config.config,
      hasCredentials: config.credentials !== null,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }))

    return NextResponse.json({ success: true, providers: sanitized })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Get payment settings error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requirePermission('settings:write')

    const body = await request.json()
    const { provider, isActive, testMode, supportedMethods, config } =
      UpdateProviderSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (isActive !== undefined) updateData.isActive = isActive
    if (testMode !== undefined) updateData.testMode = testMode
    if (supportedMethods !== undefined) updateData.supportedMethods = supportedMethods
    if (config !== undefined) updateData.config = JSON.parse(JSON.stringify(config))

    const updated = await prisma.paymentProviderConfig.upsert({
      where: { provider },
      create: {
        provider,
        isActive: isActive ?? false,
        testMode: testMode ?? true,
        supportedMethods: supportedMethods ?? [],
        config: config ? JSON.parse(JSON.stringify(config)) : undefined,
      },
      update: updateData,
    })

    await logAudit({
      userId: (user as any).id,
      action: 'update',
      entityType: 'payment_provider_config',
      entityId: updated.id,
      changes: {
        provider,
        ...updateData,
      },
    })

    return NextResponse.json({
      success: true,
      provider: {
        id: updated.id,
        provider: updated.provider,
        isActive: updated.isActive,
        testMode: updated.testMode,
        supportedMethods: updated.supportedMethods,
        hasCredentials: updated.credentials !== null,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Update payment settings error:', error)
    return NextResponse.json(
      { error: 'Failed to update payment settings' },
      { status: 500 }
    )
  }
}
