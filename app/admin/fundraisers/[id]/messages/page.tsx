'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowLeft, MessageSquareHeart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface AdminMessage {
  id: string
  authorName: string
  authorEmail: string | null
  authorAvatar: string | null
  content: string
  isHidden: boolean
  isApproved: boolean
  createdAt: string
}

export default function FundraiserMessagesAdminPage() {
  const params = useParams()
  const fundraiserId = params?.id as string

  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`/api/admin/fundraisers/${fundraiserId}/messages`)
      if (!res.ok) throw new Error('Failed to load messages')
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch {
      setError('Failed to load messages.')
    } finally {
      setLoading(false)
    }
  }, [fundraiserId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const toggleHidden = async (messageId: string, currentHidden: boolean) => {
    setToggling(messageId)
    try {
      const res = await fetch(
        `/api/admin/fundraisers/${fundraiserId}/messages/${messageId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isHidden: !currentHidden }),
        }
      )
      if (!res.ok) throw new Error('Failed to update')
      const data = await res.json()
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? data.message : m))
      )
    } catch {
      alert('Failed to update message visibility.')
    } finally {
      setToggling(null)
    }
  }

  const visible = messages.filter((m) => !m.isHidden)
  const hidden = messages.filter((m) => m.isHidden)

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <Button asChild variant="ghost" className="mb-4 -ml-2">
          <Link href={`/admin/fundraisers/${fundraiserId}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Fundraiser
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center">
            <MessageSquareHeart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold">Supporter Messages</h1>
            <p className="text-sm text-muted-foreground">
              Moderate community messages on this fundraiser page
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive mb-6">
          {error}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-foreground">{messages.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-green-600">{visible.length}</p>
            <p className="text-xs text-muted-foreground">Visible</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-destructive">{hidden.length}</p>
            <p className="text-xs text-muted-foreground">Hidden</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4 h-20" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 text-center">
            <MessageSquareHeart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No messages yet for this fundraiser.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Messages</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-4 px-6 py-4 ${msg.isHidden ? 'opacity-60 bg-muted/40' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm text-foreground">{msg.authorName}</span>
                      {msg.authorEmail && (
                        <span className="text-xs text-muted-foreground">{msg.authorEmail}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      {msg.isHidden && (
                        <Badge variant="secondary" className="text-xs">Hidden</Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-3 whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={toggling === msg.id}
                    onClick={() => toggleHidden(msg.id, msg.isHidden)}
                    className={msg.isHidden ? 'border-green-300 text-green-700 hover:bg-green-50' : 'border-destructive/30 text-destructive hover:bg-destructive/10'}
                    title={msg.isHidden ? 'Show message' : 'Hide message'}
                  >
                    {msg.isHidden ? (
                      <><Eye className="w-4 h-4 mr-1" /> Unhide</>
                    ) : (
                      <><EyeOff className="w-4 h-4 mr-1" /> Hide</>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
