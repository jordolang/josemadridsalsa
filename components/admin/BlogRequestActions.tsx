'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface BlogRequestActionsProps {
  requestId: string
}

export function BlogRequestActions({ requestId }: BlogRequestActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/blog/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to update request')
        return
      }

      router.refresh()
    } catch {
      alert('Failed to update request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="text-green-600 hover:bg-green-50"
        disabled={loading}
        onClick={() => handleAction('APPROVED')}
      >
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-red-600 hover:bg-red-50"
        disabled={loading}
        onClick={() => handleAction('REJECTED')}
      >
        Reject
      </Button>
    </div>
  )
}
