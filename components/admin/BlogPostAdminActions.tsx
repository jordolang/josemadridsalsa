'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface BlogPostAdminActionsProps {
  postId: string
  currentStatus: string
}

export function BlogPostAdminActions({ postId, currentStatus }: BlogPostAdminActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleAction = async (status: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/blog/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to update post')
        return
      }

      router.refresh()
    } catch {
      alert('Failed to update post')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this blog post?')) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/blog/posts/${postId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to delete post')
        return
      }

      router.refresh()
    } catch {
      alert('Failed to delete post')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-1.5">
      {currentStatus === 'PENDING_REVIEW' && (
        <>
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 hover:bg-green-50 text-xs h-7 px-2"
            disabled={loading}
            onClick={() => handleAction('PUBLISHED')}
          >
            Publish
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:bg-red-50 text-xs h-7 px-2"
            disabled={loading}
            onClick={() => handleAction('REJECTED')}
          >
            Reject
          </Button>
        </>
      )}
      {currentStatus === 'DRAFT' && (
        <Button
          size="sm"
          variant="outline"
          className="text-green-600 hover:bg-green-50 text-xs h-7 px-2"
          disabled={loading}
          onClick={() => handleAction('PUBLISHED')}
        >
          Publish
        </Button>
      )}
      {currentStatus === 'PUBLISHED' && (
        <Button
          size="sm"
          variant="outline"
          className="text-orange-600 hover:bg-orange-50 text-xs h-7 px-2"
          disabled={loading}
          onClick={() => handleAction('DRAFT')}
        >
          Unpublish
        </Button>
      )}
      {currentStatus === 'REJECTED' && (
        <Button
          size="sm"
          variant="outline"
          className="text-green-600 hover:bg-green-50 text-xs h-7 px-2"
          disabled={loading}
          onClick={() => handleAction('PUBLISHED')}
        >
          Publish
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="text-red-600 hover:bg-red-50 text-xs h-7 px-2"
        disabled={loading}
        onClick={handleDelete}
      >
        Delete
      </Button>
    </div>
  )
}
