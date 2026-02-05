'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Newspaper, Clock, CheckCircle, XCircle, PenLine } from 'lucide-react'

type BlogAccessStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | null

interface BlogAccessSectionProps {
  initialStatus: BlogAccessStatus
  businessName?: string | null
}

const statusConfig = {
  PENDING: {
    label: 'Pending Review',
    variant: 'outline' as const,
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    icon: Clock,
    message: 'Your blog access request is being reviewed by our team.',
  },
  APPROVED: {
    label: 'Approved',
    variant: 'outline' as const,
    className: 'bg-green-50 text-green-700 border-green-200',
    icon: CheckCircle,
    message: 'You have blog posting access! Start creating content for the community.',
  },
  REJECTED: {
    label: 'Rejected',
    variant: 'outline' as const,
    className: 'bg-red-50 text-red-700 border-red-200',
    icon: XCircle,
    message: 'Your blog access request was not approved at this time.',
  },
}

export function BlogAccessSection({ initialStatus, businessName }: BlogAccessSectionProps) {
  const [status, setStatus] = useState<BlogAccessStatus>(initialStatus)
  const [showForm, setShowForm] = useState(false)
  const [formBusinessName, setFormBusinessName] = useState('')
  const [formReason, setFormReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmitRequest = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/account/blog/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: formBusinessName || null,
          reason: formReason || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit request')
      }

      setStatus('PENDING')
      setShowForm(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // No request submitted yet
  if (!status) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-salsa-50 p-2 dark:bg-salsa-950">
            <Newspaper className="h-5 w-5 text-salsa-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium">Taste of Zanesville Blog</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Join our community blog! Share your stories, tips, updates, and articles with the
              Zanesville community. Perfect for local businesses, craftsmen, and chefs.
            </p>

            {!showForm ? (
              <Button
                onClick={() => setShowForm(true)}
                className="mt-3 bg-salsa-500 hover:bg-salsa-600"
                size="sm"
              >
                <PenLine className="mr-2 h-4 w-4" />
                Request Blog Access
              </Button>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-sm font-medium">Business Name (optional)</label>
                  <Input
                    placeholder="Your business or organization name"
                    value={formBusinessName}
                    onChange={(e) => setFormBusinessName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Why would you like to blog? (optional)</label>
                  <textarea
                    placeholder="Tell us about what you'd like to share with the community..."
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button
                    onClick={handleSubmitRequest}
                    disabled={loading}
                    size="sm"
                    className="bg-salsa-500 hover:bg-salsa-600"
                  >
                    {loading ? 'Submitting...' : 'Submit Request'}
                  </Button>
                  <Button
                    onClick={() => setShowForm(false)}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    )
  }

  // Request exists - show status
  const config = statusConfig[status]
  const StatusIcon = config.icon

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-salsa-50 p-2 dark:bg-salsa-950">
          <Newspaper className="h-5 w-5 text-salsa-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Taste of Zanesville Blog</h3>
            <Badge className={config.className}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{config.message}</p>
          {businessName && (
            <p className="text-xs text-muted-foreground mt-1">Business: {businessName}</p>
          )}
          {status === 'APPROVED' && (
            <div className="mt-3 flex gap-2">
              <Link href="/account/blog">
                <Button size="sm" className="bg-salsa-500 hover:bg-salsa-600">
                  <PenLine className="mr-2 h-4 w-4" />
                  Manage My Posts
                </Button>
              </Link>
              <Link href="/account/blog/new">
                <Button size="sm" variant="outline">
                  Create New Post
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
