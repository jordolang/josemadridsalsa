import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getGscServiceAccount, getSeoConfiguration } from '@/lib/seo/configuration'
import { listSites } from '@/lib/seo/search-console'

/**
 * Connection status for the Search Console integration.
 * When credentials are stored, verifies them by listing accessible sites.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const permitted = await hasPermission(session.user as any, 'seo:manage')
  if (!permitted) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [config, serviceAccount] = await Promise.all([
    getSeoConfiguration(),
    getGscServiceAccount(),
  ])

  if (!serviceAccount) {
    return NextResponse.json({
      configured: false,
      property: config?.gscProperty || null,
    })
  }

  try {
    const sites = await listSites(serviceAccount)
    return NextResponse.json({
      configured: true,
      connected: true,
      serviceAccountEmail: serviceAccount.client_email,
      property: config?.gscProperty || null,
      sites,
    })
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      serviceAccountEmail: serviceAccount.client_email,
      property: config?.gscProperty || null,
      error: String(error),
    })
  }
}
