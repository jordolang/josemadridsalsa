import { redirect, notFound } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import ProductForm from '@/components/admin/ProductForm'
import prisma from '@/lib/prisma'

export const metadata = {
  title: 'Edit Product | Admin',
  description: 'Edit product details',
}

async function getFormData(productId: string) {
  const [product, categories] = await Promise.all([
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
  ])

  if (!product) {
    notFound()
  }

  return { product, categories }
}

export default async function EditProductPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'products:write'))) {
    redirect('/admin/products')
  }

  const { product, categories } = await getFormData(params.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Product</h1>
        <p className="text-slate-600">Update product details</p>
      </div>

      <ProductForm product={product} categories={categories} />
    </div>
  )
}
