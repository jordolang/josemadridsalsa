import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import ProductForm from '@/components/admin/ProductForm'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Add Product - Jose Madrid Salsa Admin',
  description: 'Create a new product in the Jose Madrid Salsa catalog.',
  pathname: '/admin/products',
})

async function getFormData() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return { categories }
}

export default async function NewProductPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'products:write'))) {
    redirect('/admin/products')
  }

  const { categories } = await getFormData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add Product</h1>
        <p className="text-slate-600">Create a new salsa product</p>
      </div>

      <ProductForm categories={categories} />
    </div>
  )
}
