import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { MerchPurchase } from '@/components/store/merch-purchase'
import { getMerchProduct } from '@/lib/merchandise/catalog'
import { createMetadata } from '@/lib/metadata'

export const revalidate = 300

type PageProps = { params: Promise<{ productId: string }> }

async function loadProduct(productId: string) {
  try {
    return await getMerchProduct(productId)
  } catch (error) {
    console.error('Failed to load merch product', { productId, error })
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { productId } = await params
  const product = await loadProduct(productId)
  if (!product) return { title: 'Merchandise - Jose Madrid Salsa' }
  return createMetadata({
    title: `${product.title} - Jose Madrid Salsa Merch`,
    description: product.description.slice(0, 160) || `${product.title} from Jose Madrid Salsa.`,
    pathname: `/merchandise/${product.id}`,
    imageOverride: product.images[0]?.src,
  })
}

export default async function MerchProductPage({ params }: PageProps) {
  const { productId } = await params
  const product = await loadProduct(productId)
  if (!product) notFound()

  return (
    <main className="bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12">
        <Link
          href="/merchandise"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          All merch
        </Link>
        <MerchPurchase product={product} />
      </div>
    </main>
  )
}
