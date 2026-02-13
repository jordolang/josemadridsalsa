import { ProductsClient } from './products-client'
import type { Product } from '@/components/store/product-card'

export const revalidate = 0

export default async function ProductsPage() {
  let products: Product[] = []

  try {
    const prisma = (await import('@/lib/prisma')).default

    // Try to connect and query
    await prisma.$connect()
    const rawProducts = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { isFeatured: 'desc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      include: {
        productTags: {
          include: {
            tag: true,
          },
        },
      },
    })

    // Convert Decimal prices to numbers and format response
    products = rawProducts.map(product => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: parseFloat(String(product.price)),
      compareAtPrice: product.compareAtPrice ? parseFloat(String(product.compareAtPrice)) : undefined,
      featuredImage: product.featuredImage,
      images: product.images || [],
      heatLevel: product.heatLevel,
      sku: product.sku,
      inventory: product.inventory,
      isFeatured: product.isFeatured,
      ingredients: product.ingredients || [],
      searchKeywords: product.searchKeywords || [],
      tags: product.productTags?.map(({ tag }) => tag.slug) || [],
    }))
  } catch (error) {
    console.error('[Products Page] Error loading products:', error)
    // Return empty array on error - page will show "no products" message
    products = []
  }

  return <ProductsClient initialProducts={products} />
}
