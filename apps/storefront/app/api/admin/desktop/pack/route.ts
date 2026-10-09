import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission, isStaff } from '@/lib/rbac'
import { SECTION_PERMISSION } from '@/lib/admin-desktop/access'
import { loadPackOrder } from '@/lib/admin-desktop/fulfil'

/**
 * An order for the pack sheet: its lines with the barcodes to scan, whether it
 * can be packed, any postage it already has, and its packing slip.
 *
 * `?order=` takes an id or an order number, which is what the receipt's
 * barcode carries. Read-only; buying the label afterwards is the existing
 * shipping-label route, which asks for `orders:write` on its own.
 */

export const dynamic = 'force-dynamic'

const Query = z.object({ order: z.string().trim().min(1).max(64) })

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isStaff(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const permission = SECTION_PERMISSION.orders
  if (permission && !(await hasPermission(user, permission))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = Query.safeParse({ order: request.nextUrl.searchParams.get('order') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Scan or type an order number' }, { status: 400 })
  }

  try {
    const order = await loadPackOrder(parsed.data.order)
    if (!order) return NextResponse.json({ error: `No order ${parsed.data.order}` }, { status: 404 })
    return NextResponse.json({ order }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[admin-desktop] pack order failed:', error)
    return NextResponse.json({ error: 'Could not load that order' }, { status: 500 })
  }
}
