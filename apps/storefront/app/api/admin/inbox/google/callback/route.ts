import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { prisma } from '@/lib/prisma'
import { encryptSecret } from '@/lib/crypto'
import { requirePermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { exchangeGmailCode, fetchGoogleEmail, GMAIL_SCOPES } from '@/lib/inbox/gmail'

/**
 * GET /api/admin/inbox/google/callback
 *
 * Completes the grant and stores the tokens encrypted. Every exit is a redirect back to
 * the settings page carrying a message, because this URL is reached by Google sending a
 * browser here — a JSON error body would be shown to a person as raw text.
 */

export const dynamic = 'force-dynamic'

function back(message: string, ok = false): NextResponse {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || 'http://localhost:3000'
  const params = new URLSearchParams(ok ? { connected: message } : { error: message })
  return NextResponse.redirect(`${base}/admin/inbox/settings?${params.toString()}`)
}

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('api_keys:manage')

    const url = new URL(request.url)
    const error = url.searchParams.get('error')
    if (error) return back(`Google returned "${error}".`)

    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) return back('Google did not return an authorization code.')

    const jar = await cookies()
    const expected = jar.get('gmail_oauth_state')?.value
    jar.delete('gmail_oauth_state')
    if (!expected || expected !== state) {
      return back('That connection attempt expired. Start it again.')
    }

    const tokens = await exchangeGmailCode(code)
    if (!tokens.refreshToken) {
      // Without a refresh token the sweep works until the access token expires an hour
      // later and then silently stops, which is the worst possible failure for this
      // feature. Refuse the connection instead.
      return back('Google did not issue a refresh token. Remove the app at myaccount.google.com/permissions and connect again.')
    }

    const mailbox = await fetchGoogleEmail(tokens.accessToken)
    if (!mailbox) return back('Could not read which Google account was connected.')

    const granted = new Set(tokens.scopes)
    const missing = GMAIL_SCOPES.filter(
      (scope) => scope.startsWith('https://') && !granted.has(scope),
    )
    if (missing.length > 0) {
      return back('The Gmail permissions were not all granted. Connect again and approve every box.')
    }

    const access = encryptSecret(tokens.accessToken)
    const refresh = encryptSecret(tokens.refreshToken)

    const data = {
      accessToken: access.encryptedValue,
      accessTokenIv: access.iv,
      refreshToken: refresh.encryptedValue,
      refreshTokenIv: refresh.iv,
      tokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      isActive: true,
      connectionError: null,
      connectedById: user.id,
    }

    await prisma.gmailConnection.upsert({
      where: { mailbox },
      create: { mailbox, ...data },
      update: data,
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'GMAIL_CONNECTED',
        entityType: 'GmailConnection',
        changes: { mailbox },
      },
      request,
    )

    return back(mailbox, true)
  } catch (error) {
    console.error('[inbox] Gmail callback failed:', error)
    return back(error instanceof Error ? error.message : 'The connection failed.')
  }
}
