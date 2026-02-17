import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import ProductForm from '@/components/admin/ProductForm'
import VariantEditorWrapper from '@/components/admin/VariantEditorWrapper'
import ImageUploaderWrapper from '@/components/admin/ImageUploaderWrapper'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Edit Product - Jose Madrid Salsa Admin',
  description: 'Edit product details.',
  pathname: '/admin/products',
})

async function getFormData(productId: string) {
  const [product, categories, variants] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  if (!product) {
    notFound()
  }

  return { product, categories, variants }
}

export default async function ProductEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'products:write'))) {
    redirect('/admin/products')
  }

  const { product, categories, variants } = await getFormData(id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Product</h1>
        <p className="text-slate-600">Update product details</p>
      </div>

      <ImageUploaderWrapper productId={id} initialImages={product.images} />

      <ProductForm product={product} categories={categories} />

      <VariantEditorWrapper productId={id} variants={variants} />
    </div>
  )
}
