import { prisma } from '@/lib/prisma'
import { StructuredDataType } from '@prisma/client'

export interface OrganizationSchema {
  '@context': 'https://schema.org'
  '@type': 'Organization'
  name: string
  url: string
  logo?: string
  contactPoint?: {
    '@type': 'ContactPoint'
    telephone: string
    contactType: string
  }
  sameAs?: string[]
}

export interface ProductSchema {
  '@context': 'https://schema.org'
  '@type': 'Product'
  name: string
  description?: string
  image?: string[]
  brand: {
    '@type': 'Brand'
    name: string
  }
  offers?: {
    '@type': 'Offer'
    price: string
    priceCurrency: string
    availability: string
  }
}

export async function generateOrganizationSchema(): Promise<OrganizationSchema> {
  const seoConfig = await prisma.seoConfiguration.findFirst()

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: seoConfig?.siteName || 'Jose Madrid Salsa',
    url: seoConfig?.siteUrl || 'https://www.josemadrid.net',
    logo: seoConfig?.defaultOgImage,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-XXX-XXX-XXXX',
      contactType: 'Customer Service',
    },
    sameAs: [
      seoConfig?.facebookAppId ? `https://facebook.com/${seoConfig.facebookAppId}` : '',
      seoConfig?.twitterHandle ? `https://twitter.com/${seoConfig.twitterHandle}` : '',
    ].filter(Boolean),
  }
}

export async function generateProductSchema(productId: string): Promise<ProductSchema | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  })

  if (!product) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    image: product.images,
    brand: {
      '@type': 'Brand',
      name: 'Jose Madrid Salsa',
    },
    offers: {
      '@type': 'Offer',
      price: product.price.toString(),
      priceCurrency: 'USD',
      availability: product.inventory > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  }
}

export async function saveStructuredData(
  entityType: StructuredDataType,
  entityId: string,
  schemaType: string,
  jsonLd: any
): Promise<void> {
  await prisma.structuredData.upsert({
    where: {
      entityType_entityId: {
        entityType,
        entityId,
      },
    },
    create: {
      entityType,
      entityId,
      schemaType,
      jsonLd,
    },
    update: {
      jsonLd,
    },
  })
}
