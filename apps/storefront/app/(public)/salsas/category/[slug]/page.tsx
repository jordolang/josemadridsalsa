import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'

import { getCategoryBySlug, getProducts } from '@/lib/db/products'
import { ProductCard, type Product } from '@/components/store/product-card'

export const revalidate = 300 // 5 minutes

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  if (!category) return { title: 'Category not found' }

  const title = category.metaTitle || category.name
  const description = category.metaDescription || category.description || undefined
  const image = category.ogImage || category.image
  return {
    title,
    description,
    alternates: { canonical: `/salsas/category/${slug}` },
    openGraph: { title, description, images: image ? [image] : undefined },
  }
}

export default async function SalsaCategoryPage({ params }: PageProps) {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  if (!category) notFound()

  const products = await getProducts({ category: slug })

  const cardProducts: Product[] = products.map((product) => ({
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
  }))

  return (
    <div className="container mx-auto px-4 py-10">
      <header className="mb-10 grid items-center gap-6 md:grid-cols-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{category.name}</h1>
          {category.description && (
            <p className="mt-3 max-w-xl text-muted-foreground">{category.description}</p>
          )}
        </div>
        {category.image && (
          <Image
            src={category.image}
            alt={`${category.name} from Jose Madrid Salsa`}
            width={1200}
            height={630}
            priority
            className="h-auto w-full rounded-lg"
          />
        )}
      </header>

      {cardProducts.length === 0 ? (
        <p className="text-muted-foreground">No salsas in this category yet.</p>
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
