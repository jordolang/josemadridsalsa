import { prisma } from '@/lib/prisma'
import { StructuredDataType, Prisma } from '@prisma/client'

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
  sku?: string
  brand: {
    '@type': 'Brand'
    name: string
  }
  offers?: {
    '@type': 'Offer'
    price: string
    priceCurrency: string
    availability: string
    url?: string
  }
  aggregateRating?: {
    '@type': 'AggregateRating'
    ratingValue: string
    reviewCount: string
    bestRating: string
    worstRating: string
  }
  weight?: string
  nutrition?: {
    '@type': 'NutritionInformation'
    servingSize: string
    calories: string
    fatContent: string
    saturatedFatContent: string
    transFatContent: string
    cholesterolContent: string
    sodiumContent: string
    carbohydrateContent: string
    fiberContent: string
    sugarContent: string
    proteinContent: string
  }
  additionalProperty?: Array<{
    '@type': 'PropertyValue'
    name: string
    value: string
  }>
}

export interface ProductSchemaInput {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  compareAtPrice?: number | null
  featuredImage: string | null
  images: string[]
  sku: string
  inventory: number
  heatLevel: string
  weight?: number | string | null
  ingredients: string[] | null
  nutritionalInfo?: {
    servingSize: string
    calories: number
    totalFatG: number
    saturatedFatG: number
    transFatG: number
    cholesterolMg: number
    sodiumMg: number
    totalCarbG: number
    dietaryFiberG: number
    sugarsG: number
    proteinG: number
  } | null
  productIngredients?: Array<{
    ingredient: { name: string }
    qualifier: string | null
    sortOrder: number
  }>
  reviewStats?: {
    averageRating: number
    reviewCount: number
  } | null
}

export async function generateOrganizationSchema(): Promise<OrganizationSchema> {
  const seoConfig = await prisma.seoConfiguration.findFirst()

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: seoConfig?.siteName || 'Jose Madrid Salsa',
    url: seoConfig?.siteUrl || 'https://www.josemadrid.net',
    logo: seoConfig?.defaultOgImage || undefined,
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
  const [product, reviewStats] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      include: {
        nutritionalInfo: true,
        productIngredients: {
          include: { ingredient: true },
          orderBy: { sortOrder: 'asc' as const },
        },
      },
    }),
    prisma.review.aggregate({
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ])

  if (!product) return null

  return buildProductSchema({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: parseFloat(String(product.price)),
    featuredImage: product.featuredImage,
    images: product.images,
    sku: product.sku,
    inventory: product.inventory,
    heatLevel: product.heatLevel,
    weight: product.weight ? parseFloat(String(product.weight)) : null,
    ingredients: product.ingredients,
    nutritionalInfo: product.nutritionalInfo ?? null,
    productIngredients: product.productIngredients,
    reviewStats: reviewStats._count.rating > 0
      ? {
          averageRating: reviewStats._avg.rating ?? 0,
          reviewCount: reviewStats._count.rating,
        }
      : null,
  })
}

/**
 * Build product JSON-LD schema from pre-fetched product data.
 * Use this in server components where you already have the product loaded.
 */
export function buildProductSchema(product: ProductSchemaInput): ProductSchema {
  const siteUrl = 'https://www.josemadrid.net'

  const schema: ProductSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    image: product.images.length > 0
      ? product.images
      : product.featuredImage
        ? [product.featuredImage]
        : undefined,
    sku: product.sku,
    brand: {
      '@type': 'Brand',
      name: 'Jose Madrid Salsa',
    },
    offers: {
      '@type': 'Offer',
      price: product.price.toFixed(2),
      priceCurrency: 'USD',
      availability: product.inventory > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${siteUrl}/products/${product.slug}`,
    },
  }

  // Add aggregate rating from reviews
  if (product.reviewStats && product.reviewStats.reviewCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.reviewStats.averageRating.toFixed(1),
      reviewCount: String(product.reviewStats.reviewCount),
      bestRating: '5',
      worstRating: '1',
    }
  }

  // Add weight
  if (product.weight) {
    schema.weight = `${product.weight} oz`
  }

  // Add nutrition information
  if (product.nutritionalInfo) {
    const ni = product.nutritionalInfo
    schema.nutrition = {
      '@type': 'NutritionInformation',
      servingSize: ni.servingSize,
      calories: `${ni.calories} calories`,
      fatContent: `${ni.totalFatG}g`,
      saturatedFatContent: `${ni.saturatedFatG}g`,
      transFatContent: `${ni.transFatG}g`,
      cholesterolContent: `${ni.cholesterolMg}mg`,
      sodiumContent: `${ni.sodiumMg}mg`,
      carbohydrateContent: `${ni.totalCarbG}g`,
      fiberContent: `${ni.dietaryFiberG}g`,
      sugarContent: `${ni.sugarsG}g`,
      proteinContent: `${ni.proteinG}g`,
    }
  }

  // Add ingredients and heat level as additional properties
  const additionalProperties: ProductSchema['additionalProperty'] = []

  // Heat level
  additionalProperties.push({
    '@type': 'PropertyValue',
    name: 'Heat Level',
    value: product.heatLevel,
  })

  // Ingredients list
  const ingredientNames = product.productIngredients && product.productIngredients.length > 0
    ? product.productIngredients
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((pi) => {
          const name = pi.ingredient.name
          return pi.qualifier ? `${name} (${pi.qualifier})` : name
        })
    : product.ingredients

  if (ingredientNames && ingredientNames.length > 0) {
    additionalProperties.push({
      '@type': 'PropertyValue',
      name: 'Ingredients',
      value: ingredientNames.join(', '),
    })
  }

  if (additionalProperties.length > 0) {
    schema.additionalProperty = additionalProperties
  }

  return schema
}

export async function saveStructuredData(
  entityType: StructuredDataType,
  entityId: string,
  schemaType: string,
  jsonLd: Prisma.InputJsonValue
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
