import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { sendOrderShippedEmail } from '@/lib/email/automation'
import { parseCsv } from '@/lib/csv'
import { parseTrackingRows, trackingUrlFor } from '@/lib/shipping/pirate-ship'

/**
 * Import Pirate Ship's tracking export.
 *
 * After buying labels in Pirate Ship you export a spreadsheet of shipments with
 * tracking numbers. Upload it here (multipart form field `file`) and every row
 * whose order reference matches an order is marked SHIPPED with its tracking
 * number, and a shipped email is sent. Closes the loop without visiting each
 * order.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const permitted = await hasPermission(session.user as any, 'orders:write')
    if (!permitted) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No CSV file uploaded' }, { status: 400 })
    }

    const text = await file.text()
    const { headers, rows } = parseCsv(text)
    const { mapping, parsed } = parseTrackingRows(headers, rows)

    if (!mapping.reference || !mapping.trackingNumber) {
      return NextResponse.json(
        {
          error:
            'Could not find an order/reference column and a tracking-number column in the file.',
          detectedHeaders: headers,
        },
        { status: 400 }
      )
    }

    const results = {
      matched: 0,
      updated: 0,
      alreadyShipped: 0,
      notFound: [] as string[],
    }

    for (const row of parsed) {
      const order = await prisma.order.findFirst({
        where: { orderNumber: row.reference },
        select: { id: true, status: true, trackingNumber: true },
      })

      if (!order) {
        results.notFound.push(row.reference)
        continue
      }
      results.matched++

      const alreadyDone =
        order.status === 'SHIPPED' || order.status === 'DELIVERED'
      const trackingUrl = trackingUrlFor(row.carrier, row.trackingNumber)

      const advanceStatus =
        order.status !== 'SHIPPED' &&
        order.status !== 'DELIVERED' &&
        order.status !== 'CANCELLED' &&
        order.status !== 'REFUNDED'

      await prisma.order.update({
        where: { id: order.id },
        data: {
          trackingNumber: row.trackingNumber,
          ...(row.carrier ? { carrierName: row.carrier } : {}),
          ...(trackingUrl ? { trackingUrl } : {}),
          ...(advanceStatus ? { status: 'SHIPPED', shippedAt: new Date() } : {}),
        },
      })

      await logAudit({
        userId: (session.user as any).id,
        action: 'update',
        entityType: 'order',
        entityId: order.id,
        changes: {
          source: 'pirate-ship-tracking-import',
          trackingNumber: { from: order.trackingNumber, to: row.trackingNumber },
          ...(advanceStatus ? { status: { from: order.status, to: 'SHIPPED' } } : {}),
        },
      })

      if (alreadyDone) {
        results.alreadyShipped++
      } else {
        results.updated++
        // Best-effort: don't fail the import if an email bounces.
        sendOrderShippedEmail(order.id).catch((error) => {
          console.error('Failed to send shipped email after tracking import', {
            orderId: order.id,
            error,
          })
        })
      }
    }

    return NextResponse.json({ success: true, ...results })
  } catch (error) {
    console.error('Pirate Ship tracking import error:', error)
    return NextResponse.json(
      { error: 'Failed to import tracking file' },
      { status: 500 }
    )
  }
}
