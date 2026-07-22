import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { getAppBaseUrl, getQuickBooksAppCredentials } from '@/lib/quickbooks/config'
import {
  getOAuthCookieOptions,
  parseOAuthSession,
  QUICKBOOKS_OAUTH_COOKIE_NAME,
  exchangeCodeForTokens,
} from '@/lib/quickbooks/oauth'
import { saveConnection } from '@/lib/quickbooks/connection'
import { getCompanyInfo } from '@/lib/quickbooks/client'
import { prisma } from '@/lib/prisma'

const SETTINGS_PATH = '/admin/settings/integrations'

function redirectBack(params: { status: 'connected' | 'error'; message?: string }) {
  const url = new URL(`${getAppBaseUrl()}${SETTINGS_PATH}`)
  url.searchParams.set('quickbooks', params.status)
  if (params.message) url.searchParams.set('message', params.message)
  const response = NextResponse.redirect(url.toString())
  // Clear the one-shot OAuth cookie.
  response.cookies.set(QUICKBOOKS_OAUTH_COOKIE_NAME, '', {
    ...getOAuthCookieOptions(),
    maxAge: 0,
  })
  return response
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'api_keys:manage'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const realmId = searchParams.get('realmId')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return redirectBack({ status: 'error', message: oauthError })
  }
  if (!code || !state || !realmId) {
    return redirectBack({ status: 'error', message: 'Missing code, state, or realmId' })
  }

  const cookieStore = await cookies()
  const session = parseOAuthSession(cookieStore.get(QUICKBOOKS_OAUTH_COOKIE_NAME)?.value)
  if (!session || session.state !== state) {
    return redirectBack({ status: 'error', message: 'Invalid or expired OAuth state' })
  }
  if (session.userId !== user.id) {
    return redirectBack({ status: 'error', message: 'OAuth session user mismatch' })
  }

  const creds = await getQuickBooksAppCredentials(session.environment)
  if (!creds) {
    return redirectBack({ status: 'error', message: 'QuickBooks client not configured' })
  }

  try {
    const tokens = await exchangeCodeForTokens({ code, creds })

    // Persist first so the API client can resolve a valid token, then enrich
    // with the company name.
    await saveConnection({
      realmId,
      environment: session.environment,
      tokens,
      connectedById: user.id,
    })

    let companyName: string | null = null
    try {
      companyName = (await getCompanyInfo(realmId)).CompanyName ?? null
      if (companyName) {
        await prisma.quickBooksConnection.update({
          where: { realmId },
          data: { companyName },
        })
      }
    } catch {
      // Company-info lookup is non-fatal; the connection is still valid.
    }

    await logAudit({
      userId: user.id,
      action: 'integration.connect',
      entityType: 'QuickBooksConnection',
      entityId: realmId,
      changes: { environment: session.environment, companyName },
    })

    return redirectBack({ status: 'connected' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QuickBooks connection failed'
    return redirectBack({ status: 'error', message })
  }
}
