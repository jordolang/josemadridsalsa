import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { getShippingClient } from '@/lib/shipping-api'
import { isTerminalReturnStatus } from '@/lib/orders/returns'
import {
  buildReturnAddresses,
  DEFAULT_RETURN_PARCEL,
  ReturnLabelRequestSchema,
  selectReturnRate,
} from '@/lib/shipping/return-label'

/**
 * POST /api/admin/returns/[id]/return-label
 *
 * Buy a prepaid label so the customer can send the goods back, and store it on the return.
 *
 * This spends money at the carrier, so it refuses in every case where the spend would be
 * wasted: a return that is already finished, or one that already has a label.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'orders:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = ReturnLabelRequestSchema.parse(await request.json().catch(() => ({})))

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id },
      select: {
        id: true,
        rmaNumber: true,
        status: true,
        orderId: true,
        returnLabelTrackingCode: true,
        order: {
          select: {
            orderNumber: true,
            shippingAddress: {
              select: {
                firstName: true,
                lastName: true,
                street: true,
                city: true,
                state: true,
                zipCode: true,
                country: true,
                phone: true,
              },
            },
          },
        },
      },
    })

    if (!returnRequest) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 })
    }

    // Buying twice charges twice, and the customer only needs one label.
    if (returnRequest.returnLabelTrackingCode) {
      return NextResponse.json(
        { error: 'This return already has a label.' },
        { status: 409 }
      )
    }

    if (isTerminalReturnStatus(returnRequest.status)) {
      return NextResponse.json(
        {
          error: `This return is ${returnRequest.status.toLowerCase()}, so a label would never be used.`,
        },
        { status: 409 }
      )
    }

    const settings = await prisma.shippingSettings.findUnique({
      where: { singleton: 'singleton' },
      select: { originAddress: true },
    })

    // Settings first, environment as the fallback — the same order the rest of the shipping
    // code resolves the origin in.
    const configured = (settings?.originAddress ?? null) as Record<string, string> | null
    const addresses = buildReturnAddresses(returnRequest.order.shippingAddress, {
      name: process.env.SHIP_FROM_NAME,
      street: configured?.street || process.env.SHIP_FROM_STREET,
      city: configured?.city || process.env.SHIP_FROM_CITY,
      state: configured?.state || process.env.SHIP_FROM_STATE,
      zipCode: configured?.zipCode || process.env.SHIP_FROM_ZIP,
      country: configured?.country || process.env.SHIP_FROM_COUNTRY,
    })

    if (!addresses.ok) {
      return NextResponse.json({ error: addresses.error.message }, { status: 400 })
    }

    const parcel = body.parcel ?? DEFAULT_RETURN_PARCEL
    const client = getShippingClient()

    // A shipment then a purchase, rather than the rates-only call the outbound route makes:
    // `buyShipmentLabel` needs a shipment id, and only a bought shipment yields a real label.
    const shipment = await client.createShipment({
      fromAddress: addresses.addresses.from,
      toAddress: addresses.addresses.to,
      parcel,
      reference: `Return ${returnRequest.rmaNumber}`,
    })

    const selected = selectReturnRate(shipment.rates, body.rateId)
    if (!selected.ok) {
      return NextResponse.json({ error: selected.message }, { status: 400 })
    }

    const label = await client.buyShipmentLabel(shipment.id, selected.rate.id)

    const updated = await prisma.returnRequest.update({
      where: { id },
      data: {
        returnLabelShipmentId: label.id,
        returnLabelTrackingCode: label.trackingCode,
        returnLabelUrl: label.labelUrl,
        returnLabelCarrier: label.carrier,
        returnLabelService: label.service,
        returnLabelCostCents: Math.round(label.rate * 100),
        returnLabelPurchasedAt: new Date(),
      },
      select: {
        returnLabelUrl: true,
        returnLabelTrackingCode: true,
        returnLabelCarrier: true,
        returnLabelService: true,
        returnLabelCostCents: true,
      },
    })

    // Recorded in the audit log rather than as a domain event: this is an admin spending money,
    // which is what `AuditLog` is for, and the domain-event catalogue has no return entity yet.
    // A `return.label_purchased` type would be a reasonable addition alongside the automation
    // work, which owns that catalogue.
    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'create',
        entityType: 'return_label',
        entityId: id,
        changes: {
          rmaNumber: returnRequest.rmaNumber,
          orderNumber: returnRequest.order.orderNumber,
          carrier: label.carrier,
          service: label.service,
          costCents: Math.round(label.rate * 100),
          trackingCode: label.trackingCode,
        },
      },
      request
    )

    return NextResponse.json({ label: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Return label purchase error:', error)
    return NextResponse.json(
      {
        // The carrier's own message is the useful part — "address not found", "insufficient
        // funds on the EasyPost account" — so it is passed through rather than flattened.
        error: error instanceof Error ? error.message : 'Failed to buy a return label',
      },
      { status: 502 }
    )
  }
}
