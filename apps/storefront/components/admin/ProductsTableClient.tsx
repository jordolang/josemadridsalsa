'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Edit, Eye } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LowStockAlert } from '@/components/admin/LowStockAlert'
import { ProductBulkActions } from '@/components/admin/ProductBulkActions'
import { cn } from '@/lib/utils'

export interface ProductRow {
  id: string
  name: string
  slug: string
  sku: string
  featuredImage: string | null
  categoryName: string
  heatLevel: string
  heatLevelLabel: string
  heatLevelClass: string
  price: string
  inventory: number
  lowStockThreshold: number
  isActive: boolean
}

/**
 * Product list with row selection, so an edit that applies to a dozen products is one
 * action rather than a dozen page visits. Mirrors the selection behaviour the orders table
 * already has.
 */
export function ProductsTableClient({
  products,
  categories,
  canWrite,
}: {
  products: ProductRow[]
  categories: { id: string; name: string }[]
  canWrite: boolean
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const allSelected = products.length > 0 && selectedIds.size === products.length
  const someSelected = selectedIds.size > 0

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(products.map((p) => p.id)) : new Set())
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Columns shift by one when the checkbox column is present.
  const columnCount = canWrite ? 8 : 7

  return (
    <div className="space-y-3">
      {canWrite && (
        <ProductBulkActions
          selectedIds={[...selectedIds]}
          categories={categories}
          onDone={() => setSelectedIds(new Set())}
        />
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {canWrite && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(value) => toggleAll(value === true)}
                    aria-label="Select all products"
                  />
                </TableHead>
              )}
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
                <TableCell colSpan={columnCount} className="py-12 text-center text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const lowStock = product.inventory <= product.lowStockThreshold
                const selected = selectedIds.has(product.id)

                return (
                  <TableRow key={product.id} data-state={selected ? 'selected' : undefined}>
                    {canWrite && (
                      <TableCell>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleRow(product.id)}
                          aria-label={`Select ${product.name}`}
                        />
                      </TableCell>
                    )}
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
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/products/${product.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {product.name}
                            </Link>
                            <LowStockAlert
                              inventory={product.inventory}
                              threshold={product.lowStockThreshold}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{product.categoryName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={product.heatLevelClass}>
                        {product.heatLevelLabel}
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
    </div>
  )
}
