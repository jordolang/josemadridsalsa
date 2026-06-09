import { ProductsClient } from './products-client'
import type { Product } from '@/components/store/product-card'
import { getProducts, getCategories } from '@/lib/db/products'

export const dynamic = 'force-dynamic'

export const revalidate = 0

interface SearchParams {
  category?: string
  heatLevel?: string
  search?: string
  view?: 'grid' | 'list'
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  // Next.js 16: searchParams is now a Promise
  const params = await searchParams

  let products: Product[] = []
  let categories: Array<{ id: string; name: string; slug: string; _count: { products: number } }> = []

  try {
    // Fetch products using the new query layer with filters
    const rawProducts = await getProducts({
      category: params.category,
      heatLevel: params.heatLevel,
      search: params.search,
    })

    // Convert to Product type expected by ProductCard
    products = rawProducts.map(product => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? undefined,
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

    // Fetch categories for filter UI
    categories = await getCategories()
  } catch (error) {
    console.error('[Products Page] Error loading products:', error)
    // Return empty arrays on error - page will show "no products" message
    products = []
    categories = []
  }

  return (
    <ProductsClient
      initialProducts={products}
      categories={categories}
      initialCategory={params.category}
      initialHeatLevel={params.heatLevel}
      initialSearch={params.search}
      initialView={params.view}
    />
  )
}
