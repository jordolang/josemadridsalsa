import { prisma } from '@/lib/prisma'
import { generateOrganizationSchema } from '@/lib/seo/schema-generator'

/**
 * Renders the site's Organization JSON-LD.
 * An admin-edited entry (entityType ORGANIZATION, entityId "site") takes
 * precedence over the auto-generated schema.
 */
export async function OrganizationJsonLd() {
  try {
    const override = await prisma.structuredData.findUnique({
      where: { entityType_entityId: { entityType: 'ORGANIZATION', entityId: 'site' } },
    })

    const jsonLd = override?.isActive ? override.jsonLd : await generateOrganizationSchema()

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    )
  } catch (error) {
    console.error('Failed to render organization JSON-LD:', error)
    return null
  }
}
