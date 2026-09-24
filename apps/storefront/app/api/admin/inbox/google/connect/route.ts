import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'

import { requirePermission } from '@/lib/rbac'
import { ok, failFromError } from '@/lib/api'
import { buildGmailAuthUrl } from '@/lib/inbox/gmail'

/**
 * GET /api/admin/inbox/google/connect
 *
 * Hands back the Google consent URL for the browser to follow, rather than redirecting to
 * it — the same shape the calendar connection uses, so the panel can report a configuration
 * error in place instead of bouncing the operator to Google and back.
 *
 * The state is a random value kept in a short-lived, http-only cookie and compared on the
 * way back, so a link to the callback cannot make somebody else's browser complete a
 * connection.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requirePermission('api_keys:manage')

    const state = randomBytes(24).toString('hex')

    const jar = await cookies()
    jar.set('gmail_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    })

    return ok({ url: await buildGmailAuthUrl(state) })
  } catch (error) {
    return failFromError(error, 'Could not start the Gmail connection')
  }
}
