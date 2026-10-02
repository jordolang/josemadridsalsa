import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { syncTerminalCheckout, TerminalCheckoutError } from '@/lib/pos/terminal-checkout'

export async function GET(request: NextRequest) {
  try {
    await requirePermission('orders:read')

    const checkoutId = request.nextUrl.searchParams.get('checkoutId')
    if (!checkoutId) {
      return NextResponse.json(
        { error: 'Missing checkoutId parameter' },
        { status: 400 }
      )
    }

    const { status, orderNumber } = await syncTerminalCheckout(checkoutId)

    return NextResponse.json({
      status,
      orderNumber,
    })
  } catch (error) {
    if (error instanceof TerminalCheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[POS] Terminal status check error:', error)
    return NextResponse.json(
      { error: 'Unable to check terminal status' },
      { status: 500 }
    )
  }
}
