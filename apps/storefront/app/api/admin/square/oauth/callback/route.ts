import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { completeSquareConnection, verifyOAuthState } from '@/lib/square/oauth'

export const dynamic = 'force-dynamic'

const SETTINGS_PAGE = '/admin/settings/payments'

const Query = z.object({
  code: z.string().min(1).max(512).optional(),
  state: z.string().min(1).max(1024).optional(),
  error: z.string().max(256).optional(),
  error_description: z.string().max(1024).optional(),
})

/**
 * Square sends the admin back here. The state must be one this same admin started in the
 * last 15 minutes; the code is then traded for tokens (lib/square/oauth).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const back = new URL(SETTINGS_PAGE, request.url)
  const fail = (reason: string) => {
    back.searchParams.set('square', 'error')
    back.searchParams.set('reason', reason)
    return NextResponse.redirect(back)
  }

  const user = await getCurrentUser()
  if (!user) {
    // Finished in a browser that is not signed in (the desktop app hands Square's page to the
    // default browser): sign in, then come straight back with the same code.
    const signin = new URL('/auth/signin', request.url)
    signin.searchParams.set('callbackUrl', `${url.pathname}${url.search}`)
    return NextResponse.redirect(signin)
  }
  if (!(await hasPermission(user, 'settings:write'))) return fail('Your account cannot change payment settings.')

  const parsed = Query.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return fail('Square sent back an unexpected answer.')
  const { code, state, error, error_description } = parsed.data
  if (error) return fail(error_description ?? (error === 'access_denied' ? 'Connect Square was canceled.' : error))
  if (!code || !state || !verifyOAuthState(state, user.id)) {
    return fail('That Connect Square link expired or was started by someone else. Please try again.')
  }

  try {
    const { merchantId } = await completeSquareConnection(code, user.id)
    await logAuditWithRequest(
      { userId: user.id, action: 'connect', entityType: 'SquareOAuth', entityId: merchantId, changes: { merchantId } },
      request,
    )
    back.searchParams.set('square', 'connected')
    return NextResponse.redirect(back)
  } catch (connectError) {
    return fail(connectError instanceof Error ? connectError.message : 'Connect Square failed.')
  }
}
