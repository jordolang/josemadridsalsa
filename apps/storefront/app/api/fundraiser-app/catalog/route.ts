import { NextResponse } from 'next/server'
import { requireAppSession } from '@/lib/fundraiser-app/access'
import { fundraiserAppErrorResponse } from '@/lib/fundraiser-app/errors'
import { loadAppCatalog } from '@/lib/fundraiser-app/orders'

/** The salsas this group sells, at its prices. */
export async function GET(request: Request) {
  try {
    const session = await requireAppSession(request, { unlocked: true })
    return NextResponse.json({ products: await loadAppCatalog(session) })
  } catch (error) {
    return fundraiserAppErrorResponse(error, 'Catalog failed')
  }
}
