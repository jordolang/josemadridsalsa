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
import { ProductImportButton } from '@/components/admin/ProductImportButton'
import { formatHeatLevel, getHeatLevelClass } from '@/lib/heat-level'
import { cn } from '@/lib/utils'

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
          <div className="grid gap-4 md:grid-cols-4">
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
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Heat Level</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Inventory</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-muted-foreground"
                >
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const lowStock = product.inventory <= product.lowStockThreshold
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.featuredImage && (
                          <div className="relative size-10 shrink-0">
                            <Image
                              src={product.featuredImage}
                              alt={product.name}
                              fill
                              className="rounded object-cover"
                              sizes="40px"
                            />
                          </div>
                        )}
                        <div>
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {product.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            SKU: {product.sku}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.category.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getHeatLevelClass(product.heatLevel)}
                      >
                        {formatHeatLevel(product.heatLevel)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      ${Number(product.price).toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums',
                        lowStock && 'font-medium text-destructive'
                      )}
                    >
                      {product.inventory}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? 'default' : 'outline'}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            href={`/products/${product.slug}`}
                            target="_blank"
                            aria-label={`View ${product.name} on storefront`}
                          >
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        {canWrite && (
                          <Button variant="ghost" size="icon" asChild>
                            <Link
                              href={`/admin/products/${product.id}/edit`}
                              aria-label={`Edit ${product.name}`}
                            >
                              <Edit className="size-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

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
