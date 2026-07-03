import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { generateOrganizationSchema, generateProductSchema } from '@/lib/seo/schema-generator'

/**
 * Generate the default JSON-LD for an entity so admins can start
 * from the auto-generated schema and customize it.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const permitted = await hasPermission(session.user as any, 'seo:manage')
  if (!permitted) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const entityType = request.nextUrl.searchParams.get('entityType')
  const entityId = request.nextUrl.searchParams.get('entityId')

  try {
    if (entityType === 'ORGANIZATION') {
      return NextResponse.json({ jsonLd: await generateOrganizationSchema() })
    }

    if (entityType === 'PRODUCT') {
      if (!entityId) {
        return NextResponse.json({ error: 'Missing entityId parameter' }, { status: 400 })
      }
      const jsonLd = await generateProductSchema(entityId)
      if (!jsonLd) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      return NextResponse.json({ jsonLd })
    }

    return NextResponse.json(
      { error: `No generator available for entity type ${entityType}` },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate structured data', details: String(error) },
      { status: 500 }
    )
  }
}
