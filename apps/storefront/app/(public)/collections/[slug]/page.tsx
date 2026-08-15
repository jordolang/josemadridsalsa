import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getCollectionBySlug } from '@/lib/db/products'
import { ProductCard, type Product } from '@/components/store/product-card'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const result = await getCollectionBySlug(slug).catch(() => null)
  if (!result) return { title: 'Collection not found' }

  const { collection } = result
  return {
    title: collection.metaTitle || collection.name,
    description: collection.metaDescription || collection.description || undefined,
    openGraph: collection.ogImage ? { images: [collection.ogImage] } : undefined,
  }
}

export default async function CollectionPage({ params }: PageProps) {
  const { slug } = await params
  const result = await getCollectionBySlug(slug)
  if (!result) notFound()

  const { collection, products } = result

  const cardProducts: Product[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? undefined,
    featuredImage: product.featuredImage,
    heatLevel: product.heatLevel,
    sku: product.sku,
    inventory: product.inventory,
    isFeatured: product.isFeatured,
    ingredients: product.ingredients || [],
  }))

  return (
    <div className="container mx-auto px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{collection.name}</h1>
        {collection.description && (
          <p className="mt-2 max-w-2xl text-muted-foreground">{collection.description}</p>
        )}
      </header>

      {cardProducts.length === 0 ? (
        <p className="text-muted-foreground">This collection has no products yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cardProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
