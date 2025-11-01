'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import CategoryForm from '@/components/admin/CategoryForm'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  const [deletingCategory, setDeletingCategory] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/admin/categories')
      const data = await response.json()
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const handleDelete = async () => {
    if (!deletingCategory) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/categories/${deletingCategory.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to delete')
        return
      }
      fetchCategories()
    } catch (error) {
      alert('Failed to delete category')
    } finally {
      setIsDeleting(false)
      setDeletingCategory(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Categories</h1>
          <p className="text-slate-600">
            Organize your products into categories
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Categories Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id} className="p-6">
            {category.image && (
              <img
                src={category.image}
                alt={category.name}
                className="mb-4 h-32 w-full rounded object-cover"
              />
            )}
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold">{category.name}</h3>
                <Badge
                  className={
                    category.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }
                >
                  {category.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {category.description && (
                <p className="text-sm text-slate-600 line-clamp-2">
                  {category.description}
                </p>
              )}
              <div className="flex items-center justify-between pt-2 text-sm">
                <span className="text-slate-600">
                  {category._count.products} products
                </span>
                <span className="text-slate-500">
                  Sort: {category.sortOrder}
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingCategory(category)}>
                  <Edit className="mr-1 h-3 w-3" />Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingCategory(category)}
                  className="text-red-600 hover:bg-red-50"
                  disabled={category._count.products > 0}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {categories.length === 0 && (
        <Card className="p-12">
          <div className="text-center">
            <p className="text-slate-500">No categories yet</p>
            <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Category
            </Button>
          </div>
        </Card>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
          </DialogHeader>
          <CategoryForm onSuccess={() => { setShowCreateDialog(false); fetchCategories() }} onCancel={() => setShowCreateDialog(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <CategoryForm
              category={editingCategory}
              onSuccess={() => { setEditingCategory(null); fetchCategories() }}
              onCancel={() => setEditingCategory(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCategory?.name}"?
              {deletingCategory?._count?.products > 0 && (
                <span className="block mt-2 text-red-600">This category has {deletingCategory._count.products} products and cannot be deleted.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || deletingCategory?._count?.products > 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
