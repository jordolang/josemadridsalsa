import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { getSeoConfiguration, updateSeoConfiguration } from '@/lib/seo/configuration'

const configSchema = z.object({
  siteName: z.string().min(1).optional(),
  siteDescription: z.string().optional(),
  siteUrl: z.string().optional(),
  defaultOgImage: z.string().optional(),
  twitterHandle: z.string().optional(),
  facebookAppId: z.string().optional(),
  defaultKeywords: z.array(z.string()).optional(),
  productTitleTemplate: z.string().optional(),
  productDescTemplate: z.string().optional(),
  categoryTitleTemplate: z.string().optional(),
  categoryDescTemplate: z.string().optional(),
  recipeTitleTemplate: z.string().optional(),
  recipeDescTemplate: z.string().optional(),
  locationTitleTemplate: z.string().optional(),
  locationDescTemplate: z.string().optional(),
  robotsTxt: z.string().optional(),
  sitemapPriorities: z.record(z.string(), z.number().min(0).max(1)).optional(),
  googleSiteVerification: z.string().optional(),
  gscProperty: z.string().optional(),
  gscServiceAccountJson: z.string().nullable().optional(),
})

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

    const parsed = configSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid SEO configuration', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (parsed.data.gscServiceAccountJson) {
      try {
        const sa = JSON.parse(parsed.data.gscServiceAccountJson)
        if (typeof sa.client_email !== 'string' || typeof sa.private_key !== 'string') {
          throw new Error('missing client_email/private_key')
        }
      } catch {
        return NextResponse.json(
          { error: 'Service account JSON must include client_email and private_key' },
          { status: 400 }
        )
      }
    }

    await updateSeoConfiguration(parsed.data)

    // SEO configuration holds service-account credentials; the audit entry records the
    // keys that changed, never their values.
    await logAuditWithRequest(
      {
        userId: (session.user as any).id,
        action: 'update',
        entityType: 'seo_configuration',
        changes: { fields: Object.keys(parsed.data) },
      },
      request
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update SEO configuration', details: String(error) },
      { status: 500 }
    )
  }
}
