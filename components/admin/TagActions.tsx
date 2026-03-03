'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import type { Tag } from '@prisma/client'

interface TagActionsProps {
  tag: Tag & {
    _count: {
      productTags: number
      recipeTags: number
      mediaTags: number
      eventTags: number
    }
  }
}

export default function TagActions({ tag }: TagActionsProps) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const totalUsage =
    tag._count.productTags +
    tag._count.recipeTags +
    tag._count.mediaTags +
    tag._count.eventTags

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/admin/tags/${tag.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to delete tag')
      }

      router.refresh()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => router.push(`/admin/tags/${tag.id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag &quot;{tag.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              {totalUsage > 0 ? (
                <>
                  This tag is currently used in {totalUsage}{' '}
                  {totalUsage === 1 ? 'item' : 'items'}. Deleting it will remove
                  it from all associated content.
                </>
              ) : (
                <>
                  This action cannot be undone. The tag will be permanently
                  deleted.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
