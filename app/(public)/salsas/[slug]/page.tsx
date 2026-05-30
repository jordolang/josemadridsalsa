import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getProductBySlug, getProducts } from '@/lib/db/products'
import { ProductDetailClient, type Product } from './product-detail-client'

export const dynamic = 'force-dynamic'

type ProductPageProps = {
  params: Promise<{ slug: string }>
}

const imageFallback = '/images/shared/salsa-bowl.png'

const loadProduct = async (slug: string): Promise<Product | null> => {
  if (!process.env.DATABASE_URL) {
    return null
  }

  try {
    // Add timeout to prevent hanging (3 second max)
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 3000)
    })

    const product = await Promise.race([getProductBySlug(slug), timeoutPromise])

    if (product) {
      // Transform to expected Product type
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description || '',
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        featuredImage: product.featuredImage || imageFallback,
        images: product.images || [],
        heatLevel: product.heatLevel,
        sku: product.sku,
        inventory: product.inventory,
        isFeatured: product.isFeatured,
        ingredients: product.ingredients || [],
        searchKeywords: product.searchKeywords || [],
        weight: product.weight ? String(product.weight) : null,
        dimensions: product.dimensions ? JSON.stringify(product.dimensions) : null,
        nutritionalInfo: product.nutritionalInfo,
        productIngredients: product.productIngredients,
      }
    }
  } catch (error) {
    // Log but continue - will use fallback
  }

  return null
}

export const revalidate = 3600 // Revalidate every hour

export async function generateStaticParams() {
  // During build, prefer static data to avoid database connection issues
  if (process.env.VERCEL || process.env.CI || !process.env.DATABASE_URL) {
    return []
  }

  try {
    // Add timeout to prevent hanging during build (5 second max)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 5000)
    })

    const products = await Promise.race([
      getProducts({ take: 100 }),
      timeoutPromise,
    ])

    if (products.length > 0) {
      return products.map((product) => ({ slug: product.slug }))
    }
  } catch (error) {
    // Fallback to empty array
  }

  return []
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await loadProduct(slug)

  if (!product) {
    return {
      title: 'Product Not Found',
    }
  }

  const title = `${product.name} | Jose Madrid Salsa`
  const description =
    product.description || 'Premium salsa made with authentic ingredients.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: product.featuredImage || imageFallback,
        },
      ],
    },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const product = await loadProduct(slug)

  if (!product) {
    notFound()
  }

  return <ProductDetailClient product={product} />
}
