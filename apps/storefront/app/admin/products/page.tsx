import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Download, Edit, Eye, Plus, Search } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProductsTableClient } from '@/components/admin/ProductsTableClient'
import { ProductImportButton } from '@/components/admin/ProductImportButton'
import { formatHeatLevel, getHeatLevelClass } from '@/lib/heat-level'
import { cn } from '@/lib/utils'
import { LowStockAlert } from '@/components/admin/LowStockAlert'

interface SearchParams {
  search?: string
  category?: string
  heatLevel?: string
  active?: string
  lowStock?: string
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

  const [allForFilter, categories] = await Promise.all([
    // Low-stock filter requires comparing two columns; fetch all matching rows so
    // in-memory filtering can determine the true total before slicing.
    searchParams.lowStock === 'true'
      ? prisma.product.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: { category: { select: { name: true } } },
        })
      : Promise.resolve(null),
    prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  let products, total: number

  if (searchParams.lowStock === 'true' && allForFilter) {
    // In-memory filter then slice — acceptable because low-stock sets are small
    const filtered = allForFilter.filter((p) => p.inventory <= p.lowStockThreshold)
    total = filtered.length
    products = filtered.slice(skip, skip + limit)
  } else {
    // Normal path: delegate pagination to the database
    const [rows, count] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { category: { select: { name: true } } },
      }),
      prisma.product.count({ where }),
    ])
    products = rows
    total = count
  }

  return {
    products,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    categories,
  }
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'products:read'))) {
    redirect('/admin')
  }

  const canWrite = await hasPermission(user, 'products:write')
  const canExport = await hasPermission(user, 'products:export')
  const canImport = await hasPermission(user, 'products:import')

  const { products, total, page, totalPages, categories } = await getProducts(
    params
  )

  const buildPageHref = (targetPage: number) => {
    const qs = new URLSearchParams()
    qs.set('page', String(targetPage))
    if (params.search) qs.set('search', params.search)
    if (params.category) qs.set('category', params.category)
    if (params.heatLevel) qs.set('heatLevel', params.heatLevel)
    if (params.active) qs.set('active', params.active)
    if (params.lowStock) qs.set('lowStock', params.lowStock)
    return `/admin/products?${qs.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage your salsa products and inventory
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <Button variant="outline" asChild>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/api/admin/products/export">
                <Download className="mr-2 size-4" />
                Export
              </a>
            </Button>
          )}
          {canImport && <ProductImportButton />}
          {canWrite && (
            <Button asChild>
              <Link href="/admin/products/new">
                <Plus className="mr-2 size-4" />
                Add Product
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products..."
                defaultValue={params.search}
                className="pl-9"
              />
            </div>
            <Select defaultValue={params.category || 'all'}>
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
            <Select defaultValue={params.heatLevel || 'all'}>
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
            <Select defaultValue={params.active || 'all'}>
              <SelectTrigger>
                <SelectValue placeholder="All products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="true">Active Only</SelectItem>
                <SelectItem value="false">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue={params.lowStock || 'all'}>
              <SelectTrigger>
                <SelectValue placeholder="Stock level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock Levels</SelectItem>
                <SelectItem value="true">Low Stock Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <ProductsTableClient
        canWrite={canWrite}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          featuredImage: product.featuredImage,
          categoryName: product.category.name,
          heatLevel: product.heatLevel,
          heatLevelLabel: formatHeatLevel(product.heatLevel),
          heatLevelClass: getHeatLevelClass(product.heatLevel),
          price: product.price.toString(),
          inventory: product.inventory,
          lowStockThreshold: product.lowStockThreshold,
          isActive: product.isActive,
        }))}
      />


      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of{' '}
            {total} products
          </p>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              {page > 1 && (
                <PaginationItem>
                  <PaginationPrevious href={buildPageHref(page - 1)} />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationLink href="#" isActive>
                  {page}
                </PaginationLink>
              </PaginationItem>
              {page < totalPages && (
                <PaginationItem>
                  <PaginationNext href={buildPageHref(page + 1)} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
