import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Download, Search, Eye, Edit } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SearchParams {
  search?: string
  category?: string
  heatLevel?: string
  active?: string
  page?: string
}

async function getProducts(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1
  const limit = 50
  const skip = (page - 1) * limit

  const where: any = {}

  // Search filter
  if (searchParams.search) {
    where.OR = [
      { name: { contains: searchParams.search, mode: 'insensitive' } },
      { sku: { contains: searchParams.search, mode: 'insensitive' } },
      { description: { contains: searchParams.search, mode: 'insensitive' } },
    ]
  }

  // Category filter
  if (searchParams.category && searchParams.category !== 'all') {
    where.categoryId = searchParams.category
  }

  // Heat level filter
  if (searchParams.heatLevel && searchParams.heatLevel !== 'all') {
    where.heatLevel = searchParams.heatLevel
  }

  // Active filter
  if (searchParams.active) {
    where.isActive = searchParams.active === 'true'
  }

  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        category: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return {
    products,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    categories,
  }
}

const heatLevelColors = {
  MILD: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HOT: 'bg-orange-100 text-orange-800',
  EXTRA_HOT: 'bg-red-100 text-red-800',
  FRUIT: 'bg-purple-100 text-purple-800',
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'products:read'))) {
    redirect('/admin')
  }

  const canWrite = await hasPermission(user, 'products:write')
  const canExport = await hasPermission(user, 'products:export')

  const { products, total, page, totalPages, categories } = await getProducts(searchParams)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-slate-600">
            Manage your salsa products and inventory
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <Button variant="outline" asChild>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/api/admin/products/export">
                <Download className="mr-2 h-4 w-4" />
                Export
              </a>
            </Button>
          )}
          {canWrite && (
            <Button asChild>
              <Link href="/admin/products/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search products..."
              defaultValue={searchParams.search}
              className="pl-9"
            />
          </div>
          <Select defaultValue={searchParams.category || 'all'}>
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select defaultValue={searchParams.heatLevel || 'all'}>
            <SelectTrigger>
              <SelectValue placeholder="All heat levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Heat Levels</SelectItem>
              <SelectItem value="MILD">Mild</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HOT">Hot</SelectItem>
              <SelectItem value="EXTRA_HOT">Extra Hot</SelectItem>
              <SelectItem value="FRUIT">Fruit</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue={searchParams.active}>
            <SelectTrigger>
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="true">Active Only</SelectItem>
              <SelectItem value="false">Inactive Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Products Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Heat Level
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Inventory
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No products found
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {product.featuredImage && (
                          <img
                            src={product.featuredImage}
                            alt={product.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        )}
                        <div>
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {product.name}
                          </Link>
                          <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {product.category.name}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        className={
                          heatLevelColors[product.heatLevel as keyof typeof heatLevelColors]
                        }
                      >
                        {product.heatLevel}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      ${Number(product.price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={
                          product.inventory <= product.lowStockThreshold
                            ? 'text-red-600'
                            : ''
                        }
                      >
                        {product.inventory}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        className={
                          product.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {product.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/products/${product.slug}`} target="_blank">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canWrite && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/products/${product.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-6 py-4">
            <p className="text-sm text-slate-600">
              Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of{' '}
              {total} products
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/products?page=${page - 1}`}>
                    Previous
                  </Link>
                </Button>
              )}
              {page < totalPages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/products?page=${page + 1}`}>
                    Next
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
