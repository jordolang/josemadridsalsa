import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getSeoConfiguration, updateSeoConfiguration } from '@/lib/seo/configuration'

export async function GET() {
  const config = await getSeoConfiguration()
  return NextResponse.json(config || {})
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permitted = await hasPermission(session.user as any, 'seo:manage')
    if (!permitted) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()
    await updateSeoConfiguration(data)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update SEO configuration', details: String(error) },
      { status: 500 }
    )
  }
}
