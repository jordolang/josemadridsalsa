import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission, isStaff } from '@/lib/rbac'
import { SECTION_PERMISSION } from '@/lib/admin-desktop/access'
import type { ScanProduct } from '@/lib/admin-desktop/scan'

/**
 * The catalogue the scan sheet matches barcodes against, with each product's
 * current count.
 *
 * Read when the sheet opens rather than shipped with the Inventory page, so the
 * "on hand" it shows is the count the scanned total will be compared with. Gated
 * like the Inventory section; applying the tally then goes through
 * `inventory.adjust`, which asks for `inventory:write` on its own.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !isStaff(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const permission = SECTION_PERMISSION.inventory
  if (permission && !(await hasPermission(user, permission))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const products: ScanProduct[] = await prisma.product.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, sku: true, barcode: true, inventory: true },
    })
    return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[admin-desktop] scan catalogue failed:', error)
    return NextResponse.json({ error: 'Could not load the catalogue' }, { status: 500 })
  }
}
