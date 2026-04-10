'use client'

import { useState } from 'react'
import { Plus, Edit, Trash2, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ProductVariant {
  id: string
  name: string
  type: string
  price: number | null
  sku: string | null
  inStock: boolean
}

interface VariantEditorProps {
  productId: string
  variants: ProductVariant[]
  onUpdate?: () => void
}

interface VariantFormData {
  name: string
  type: string
  price: string
  sku: string
  inStock: boolean
}

export function VariantEditor({
  productId,
  variants,
  onUpdate,
}: VariantEditorProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    null
  )
  const [formData, setFormData] = useState<VariantFormData>({
    name: '',
    type: 'size',
    price: '',
    sku: '',
    inStock: true,
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'size',
      price: '',
      sku: '',
      inStock: true,
    })
    setError('')
  }

  const handleAddClick = () => {
    resetForm()
    setIsAddDialogOpen(true)
  }

  const handleEditClick = (variant: ProductVariant) => {
    setSelectedVariant(variant)
    setFormData({
      name: variant.name,
      type: variant.type,
      price: variant.price != null ? variant.price.toString() : '',
      sku: variant.sku || '',
      inStock: variant.inStock,
    })
    setError('')
    setIsEditDialogOpen(true)
  }

  const handleDeleteClick = (variant: ProductVariant) => {
    setSelectedVariant(variant)
    setIsDeleteDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent, isEdit: boolean = false) => {
    e.preventDefault()
    setError('')
    setIsProcessing(true)

    try {
      // Validate name
      if (!formData.name.trim()) {
        throw new Error('Variant name is required')
      }

      // Validate type
      if (!formData.type.trim()) {
        throw new Error('Variant type is required')
      }

      // Validate price if provided
      let priceValue: number | null = null
      if (formData.price.trim()) {
        priceValue = parseFloat(formData.price)
        if (isNaN(priceValue) || priceValue < 0) {
          throw new Error('Price must be a valid positive number')
        }
      }

      const payload = {
        name: formData.name.trim(),
        type: formData.type.trim(),
        price: priceValue,
        sku: formData.sku.trim() || null,
        inStock: formData.inStock,
      }

      const url = isEdit
        ? `/api/admin/products/${productId}/variants/${selectedVariant?.id}`
        : `/api/admin/products/${productId}/variants`

      const method = isEdit ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${isEdit ? 'update' : 'create'} variant`)
      }

      // Close dialog and reset form
      if (isEdit) {
        setIsEditDialogOpen(false)
      } else {
        setIsAddDialogOpen(false)
      }
      resetForm()
      setSelectedVariant(null)

      // Call onUpdate callback to refresh data
      if (onUpdate) {
        onUpdate()
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedVariant) return

    setIsProcessing(true)
    setError('')

    try {
      const response = await fetch(
        `/api/admin/products/${productId}/variants/${selectedVariant.id}`,
        {
          method: 'DELETE',
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete variant')
      }

      setIsDeleteDialogOpen(false)
      setSelectedVariant(null)

      // Call onUpdate callback to refresh data
      if (onUpdate) {
        onUpdate()
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow empty string, numbers, and decimal points
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData({ ...formData, price: value })
      setError('')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Product Variants</h3>
          <p className="text-sm text-muted-foreground">
            Manage size, flavor, and other product variations
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddClick}>
              <Plus className="mr-2 h-4 w-4" />
              Add Variant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={(e) => handleSubmit(e, false)}>
              <DialogHeader>
                <DialogTitle>Add Product Variant</DialogTitle>
                <DialogDescription>
                  Create a new variant for this product (e.g., different size or
                  flavor)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="add-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., 16 oz, Mild, Extra Spicy"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-type">
                    Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger id="add-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="size">Size</SelectItem>
                      <SelectItem value="flavor">Flavor</SelectItem>
                      <SelectItem value="heat">Heat Level</SelectItem>
                      <SelectItem value="pack">Pack Size</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-price">Price Override (optional)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="add-price"
                      type="text"
                      value={formData.price}
                      onChange={handlePriceChange}
                      placeholder="Leave empty to use base price"
                      className="pl-7"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Override the base product price for this variant
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-sku">SKU (optional)</Label>
                  <Input
                    id="add-sku"
                    type="text"
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    placeholder="e.g., SAL-MLD-16OZ"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use parent product SKU
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-inStock">Stock Status</Label>
                  <Select
                    value={formData.inStock ? 'true' : 'false'}
                    onValueChange={(value) =>
                      setFormData({ ...formData, inStock: value === 'true' })
                    }
                  >
                    <SelectTrigger id="add-inStock">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">In Stock</SelectItem>
                      <SelectItem value="false">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false)
                    resetForm()
                  }}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isProcessing}>
                  {isProcessing ? 'Creating...' : 'Create Variant'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {variants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No variants yet. Click &quot;Add Variant&quot; to create one.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price Override</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <TableRow key={variant.id}>
                  <TableCell className="font-medium">{variant.name}</TableCell>
                  <TableCell className="capitalize">{variant.type}</TableCell>
                  <TableCell>
                    {variant.price != null ? (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        {variant.price.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {variant.sku ? (
                      <code className="rounded bg-muted px-2 py-1 text-xs">
                        {variant.sku}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={variant.inStock ? 'default' : 'destructive'}
                      className={
                        variant.inStock
                          ? 'bg-primary/10 text-primary'
                          : undefined
                      }
                    >
                      {variant.inStock ? 'In Stock' : 'Out of Stock'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(variant)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(variant)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <form onSubmit={(e) => handleSubmit(e, true)}>
            <DialogHeader>
              <DialogTitle>Edit Variant</DialogTitle>
              <DialogDescription>
                Update the variant details below
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., 16 oz, Mild, Extra Spicy"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-type">
                  Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger id="edit-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="size">Size</SelectItem>
                    <SelectItem value="flavor">Flavor</SelectItem>
                    <SelectItem value="heat">Heat Level</SelectItem>
                    <SelectItem value="pack">Pack Size</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-price">Price Override (optional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="edit-price"
                    type="text"
                    value={formData.price}
                    onChange={handlePriceChange}
                    placeholder="Leave empty to use base price"
                    className="pl-7"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-sku">SKU (optional)</Label>
                <Input
                  id="edit-sku"
                  type="text"
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                  placeholder="e.g., SAL-MLD-16OZ"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-inStock">Stock Status</Label>
                <Select
                  value={formData.inStock ? 'true' : 'false'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, inStock: value === 'true' })
                  }
                >
                  <SelectTrigger id="edit-inStock">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">In Stock</SelectItem>
                    <SelectItem value="false">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false)
                  setSelectedVariant(null)
                  resetForm()
                }}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? 'Updating...' : 'Update Variant'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Variant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the variant &quot;
              {selectedVariant?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setSelectedVariant(null)
                setError('')
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isProcessing}
            >
              {isProcessing ? 'Deleting...' : 'Delete Variant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default VariantEditor
