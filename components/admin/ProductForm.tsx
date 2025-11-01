'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, X } from 'lucide-react'
import type { Product, Category } from '@prisma/client'

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  description: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  price: z.string().min(1, 'Price is required'),
  compareAtPrice: z.string().optional(),
  costPrice: z.string().optional(),
  inventory: z.string().min(0, 'Inventory must be 0 or greater'),
  lowStockThreshold: z.string().min(0, 'Low stock threshold must be 0 or greater'),
  weight: z.string().optional(),
  heatLevel: z.enum(['MILD', 'MEDIUM', 'HOT', 'EXTRA_HOT', 'FRUIT']),
  ingredients: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  featuredImage: z.string().optional(),
  images: z.string().optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImage: z.string().optional(),
  searchKeywords: z.string().optional(),
})

type ProductFormData = z.infer<typeof productSchema>

interface ProductFormProps {
  product?: Product & { category: Category }
  categories: Array<{ id: string; name: string }>
}

export default function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!product

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || '',
      slug: product?.slug || '',
      description: product?.description || '',
      sku: product?.sku || '',
      barcode: product?.barcode || '',
      price: product?.price.toString() || '',
      compareAtPrice: product?.compareAtPrice?.toString() || '',
      costPrice: product?.costPrice?.toString() || '',
      inventory: product?.inventory.toString() || '0',
      lowStockThreshold: product?.lowStockThreshold.toString() || '5',
      weight: product?.weight?.toString() || '',
      heatLevel: product?.heatLevel || 'MILD',
      ingredients: product?.ingredients.join(', ') || '',
      categoryId: product?.categoryId || '',
      featuredImage: product?.featuredImage || '',
      images: product?.images.join(', ') || '',
      isActive: product?.isActive ?? true,
      isFeatured: product?.isFeatured ?? false,
      sortOrder: product?.sortOrder.toString() || '0',
      metaTitle: product?.metaTitle || '',
      metaDescription: product?.metaDescription || '',
      ogImage: product?.ogImage || '',
      searchKeywords: product?.searchKeywords.join(', ') || '',
    },
  })

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Transform data for API
      const payload = {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        sku: data.sku,
        barcode: data.barcode || null,
        price: parseFloat(data.price),
        compareAtPrice: data.compareAtPrice ? parseFloat(data.compareAtPrice) : null,
        costPrice: data.costPrice ? parseFloat(data.costPrice) : null,
        inventory: parseInt(data.inventory),
        lowStockThreshold: parseInt(data.lowStockThreshold),
        weight: data.weight ? parseFloat(data.weight) : null,
        heatLevel: data.heatLevel,
        ingredients: data.ingredients
          ? data.ingredients.split(',').map((i) => i.trim()).filter(Boolean)
          : [],
        categoryId: data.categoryId,
        featuredImage: data.featuredImage || null,
        images: data.images
          ? data.images.split(',').map((i) => i.trim()).filter(Boolean)
          : [],
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        sortOrder: data.sortOrder ? parseInt(data.sortOrder) : 0,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        ogImage: data.ogImage || null,
        searchKeywords: data.searchKeywords
          ? data.searchKeywords.split(',').map((k) => k.trim()).filter(Boolean)
          : [],
      }

      const url = isEditing
        ? `/api/admin/products/${product.id}`
        : '/api/admin/products'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save product')
      }

      // Redirect to products list
      router.push('/admin/products')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    if (!isEditing) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      setValue('slug', slug)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Basic Information</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">
              Product Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              onChange={(e) => {
                register('name').onChange(e)
                handleNameChange(e)
              }}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">
              Slug <span className="text-red-500">*</span>
            </Label>
            <Input id="slug" {...register('slug')} />
            {errors.slug && (
              <p className="text-sm text-red-600">{errors.slug.message}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              rows={4}
              placeholder="Detailed product description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId">
              Category <span className="text-red-500">*</span>
            </Label>
            <Select
              value={watch('categoryId')}
              onValueChange={(value) => setValue('categoryId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && (
              <p className="text-sm text-red-600">{errors.categoryId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="heatLevel">
              Heat Level <span className="text-red-500">*</span>
            </Label>
            <Select
              value={watch('heatLevel')}
              onValueChange={(value: any) => setValue('heatLevel', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MILD">Mild</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HOT">Hot</SelectItem>
                <SelectItem value="EXTRA_HOT">Extra Hot</SelectItem>
                <SelectItem value="FRUIT">Fruit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ingredients">
              Ingredients (comma-separated)
            </Label>
            <Textarea
              id="ingredients"
              {...register('ingredients')}
              placeholder="Tomatoes, Onions, Jalapeños, Cilantro, Lime..."
              rows={2}
            />
          </div>
        </div>
      </Card>

      {/* Pricing & Inventory */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Pricing & Inventory</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="sku">
              SKU <span className="text-red-500">*</span>
            </Label>
            <Input id="sku" {...register('sku')} />
            {errors.sku && (
              <p className="text-sm text-red-600">{errors.sku.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode</Label>
            <Input id="barcode" {...register('barcode')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">
              Price ($) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              {...register('price')}
            />
            {errors.price && (
              <p className="text-sm text-red-600">{errors.price.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="compareAtPrice">Compare At Price ($)</Label>
            <Input
              id="compareAtPrice"
              type="number"
              step="0.01"
              {...register('compareAtPrice')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="costPrice">Cost Price ($)</Label>
            <Input
              id="costPrice"
              type="number"
              step="0.01"
              {...register('costPrice')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inventory">
              Inventory <span className="text-red-500">*</span>
            </Label>
            <Input
              id="inventory"
              type="number"
              {...register('inventory')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
            <Input
              id="lowStockThreshold"
              type="number"
              {...register('lowStockThreshold')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">Weight (oz)</Label>
            <Input
              id="weight"
              type="number"
              step="0.01"
              {...register('weight')}
            />
          </div>
        </div>
      </Card>

      {/* Images */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Images</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="featuredImage">Featured Image URL</Label>
            <Input
              id="featuredImage"
              {...register('featuredImage')}
              placeholder="https://..."
            />
            <p className="text-sm text-slate-500">
              Main product image displayed in lists and product pages
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="images">Additional Images (comma-separated URLs)</Label>
            <Textarea
              id="images"
              {...register('images')}
              placeholder="https://..., https://..."
              rows={2}
            />
            <p className="text-sm text-slate-500">
              Additional product images for gallery
            </p>
          </div>
        </div>
      </Card>

      {/* SEO */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">SEO</h2>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="metaTitle">Meta Title</Label>
            <Input
              id="metaTitle"
              {...register('metaTitle')}
              placeholder="Product name for search engines"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metaDescription">Meta Description</Label>
            <Textarea
              id="metaDescription"
              {...register('metaDescription')}
              placeholder="Brief description for search results"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ogImage">OG Image URL</Label>
            <Input
              id="ogImage"
              {...register('ogImage')}
              placeholder="https://... (for social media)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="searchKeywords">Search Keywords (comma-separated)</Label>
            <Input
              id="searchKeywords"
              {...register('searchKeywords')}
              placeholder="salsa, hot sauce, spicy..."
            />
          </div>
        </div>
      </Card>

      {/* Display Settings */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Display Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Active</Label>
              <p className="text-sm text-slate-500">
                Display product on storefront
              </p>
            </div>
            <Switch
              checked={watch('isActive')}
              onCheckedChange={(checked: boolean) => setValue('isActive', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Featured</Label>
              <p className="text-sm text-slate-500">
                Show in featured products section
              </p>
            </div>
            <Switch
              checked={watch('isFeatured')}
              onCheckedChange={(checked: boolean) => setValue('isFeatured', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sortOrder">Sort Order</Label>
            <Input
              id="sortOrder"
              type="number"
              {...register('sortOrder')}
              placeholder="0"
            />
            <p className="text-sm text-slate-500">
              Lower numbers appear first
            </p>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? 'Update Product' : 'Create Product'}
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/products')}
          disabled={isSubmitting}
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </form>
  )
}
