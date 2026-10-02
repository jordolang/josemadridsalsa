import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { createOAuthState, squareAuthorizeUrl } from '@/lib/square/oauth'

export const dynamic = 'force-dynamic'

const SETTINGS_PAGE = '/admin/settings/payments'

/** Start Connect Square: send the admin to Square to authorize the kiosk card reader. */
export async function GET(request: Request) {
  const back = new URL(SETTINGS_PAGE, request.url)
  try {
    const user = await requirePermission('settings:write')
    return NextResponse.redirect(squareAuthorizeUrl(createOAuthState(user.id)))
  } catch (error) {
    back.searchParams.set('square', 'error')
    back.searchParams.set('reason', error instanceof Error ? error.message : 'Could not start Connect Square')
    return NextResponse.redirect(back)
  }
}
