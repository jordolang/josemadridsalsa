import { NextResponse } from 'next/server'
import { requireKioskAccess } from '@/lib/kiosk/auth'
import { loadKioskCatalog } from '@/lib/kiosk/checkout'
import { kioskErrorResponse } from '@/lib/kiosk/respond'

export const dynamic = 'force-dynamic'

/** Which flavors this kiosk can sell right now, plus any it couldn't match to a product. */
export async function GET(request: Request) {
  try {
    await requireKioskAccess(request)
    const { items, unmatched } = await loadKioskCatalog()
    return NextResponse.json({
      flavors: items.map((i) => ({ key: i.key, available: !!i.productId, inStock: i.inStock })),
      unmatched,
    })
  } catch (error) {
    return kioskErrorResponse(error, 'Catalog load failed')
  }
}
