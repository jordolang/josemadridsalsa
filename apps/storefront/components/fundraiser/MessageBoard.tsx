'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { MessageSquareHeart, Send, User, LogIn } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SupporterMessage {
  id: string
  authorName: string
  authorAvatar: string | null
  content: string
  createdAt: string
}

interface MessageBoardProps {
  slug: string
}

function AvatarFallback({ name, src }: { name: string; src: string | null }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className="w-10 h-10 rounded-full object-cover"
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }

  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-salsa-500 to-chile-500 flex items-center justify-center text-white font-bold text-sm">
      {initials || <User className="w-5 h-5" />}
    </div>
  )
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MessageBoard({ slug }: MessageBoardProps) {
  const { data: session, status } = useSession()
  const [messages, setMessages] = useState<SupporterMessage[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [content, setContent] = useState('')
  const [guestName, setGuestName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const isLoggedIn = status === 'authenticated' && !!session?.user

  const fetchMessages = useCallback(
    async (pageNum: number, append = false) => {
      try {
        const res = await fetch(`/api/fundraisers/${slug}/messages?page=${pageNum}`)
        if (!res.ok) throw new Error('Failed to fetch messages')
        const data = await res.json()
        setMessages((prev) => (append ? [...prev, ...data.messages] : data.messages))
        setTotal(data.total)
        setHasMore(data.hasMore)
        setPage(pageNum)
      } catch {
        // silently fail for message fetch
      }
    },
    [slug]
  )

  useEffect(() => {
    setLoading(true)
    fetchMessages(1).finally(() => setLoading(false))
  }, [fetchMessages])

  const handleLoadMore = async () => {
    setLoadingMore(true)
    await fetchMessages(page + 1, true)
    setLoadingMore(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (!content.trim()) {
      setError('Please write a message before sharing.')
      return
    }
    if (content.trim().length > 1000) {
      setError('Message must be 1000 characters or less.')
      return
    }
    if (!isLoggedIn && guestName.trim().length < 2) {
      setError('Please enter your name (at least 2 characters).')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/fundraisers/${slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          authorName: isLoggedIn ? undefined : guestName.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to post message. Please try again.')
        return
      }

      // Optimistically prepend the new message
      setMessages((prev) => [data.message, ...prev])
      setTotal((t) => t + 1)
      setContent('')
      setGuestName('')
      setSuccessMsg('Your message has been shared! 🎉')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const charCount = content.length
  const charLeft = 1000 - charCount
  const charWarning = charLeft < 100

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-salsa-500 to-chile-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageSquareHeart className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-serif font-bold text-foreground mb-2">Supporter Wall</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Leave an encouraging message for this fundraiser. Your support means the world!
        </p>
        {total > 0 && (
          <p className="text-sm text-salsa-600 font-medium mt-1">
            {total} message{total !== 1 ? 's' : ''} of support
          </p>
        )}
      </div>

      {/* Post Form */}
      <Card className="border-salsa-200 bg-gradient-to-br from-white to-salsa-50/30 shadow-md">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Author info row */}
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <AvatarFallback
                  name={session.user?.name ?? 'You'}
                  src={(session.user as any)?.image ?? null}
                />
                <div>
                  <p className="font-semibold text-foreground">{session.user?.name ?? 'You'}</p>
                  <p className="text-xs text-muted-foreground">Posting as yourself</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="guest-name">
                  Your Name <span className="text-salsa-500">*</span>
                </label>
                <Input
                  id="guest-name"
                  type="text"
                  placeholder="Enter your name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  maxLength={80}
                  className="border-salsa-200 focus:border-salsa-400"
                />
              </div>
            )}

            {/* Message textarea */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="message-content">
                Your Message <span className="text-salsa-500">*</span>
              </label>
              <textarea
                id="message-content"
                placeholder="Write an encouraging message for this fundraiser..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                maxLength={1000}
                className="w-full rounded-md border border-salsa-200 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-salsa-400 focus:border-transparent resize-none transition-colors"
              />
              <div className="flex justify-between items-center">
                <span className={`text-xs ${charWarning ? 'text-chile-500 font-medium' : 'text-muted-foreground'}`}>
                  {charLeft} character{charLeft !== 1 ? 's' : ''} remaining
                </span>
              </div>
            </div>

            {/* Error / Success */}
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 font-medium">
                {successMsg}
              </div>
            )}

            {/* Submit row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700 text-white gap-2"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Sharing...' : 'Share Message'}
              </Button>

              {!isLoggedIn && status !== 'loading' && (
                <button
                  type="button"
                  onClick={() => signIn('google')}
                  className="flex items-center gap-2 text-sm text-salsa-600 hover:text-salsa-800 underline underline-offset-2 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in with Google to post with your profile
                </button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Messages List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <Card className="border-muted">
                <CardContent className="pt-4 pb-4">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/4" />
                      <div className="h-3 bg-muted rounded w-full" />
                      <div className="h-3 bg-muted rounded w-3/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <Card className="border-dashed border-salsa-200">
          <CardContent className="pt-10 pb-10 text-center">
            <MessageSquareHeart className="w-12 h-12 text-salsa-300 mx-auto mb-3" />
            <p className="text-lg font-semibold text-foreground mb-1">
              Be the first to leave a message of support!
            </p>
            <p className="text-sm text-muted-foreground">
              Share an encouraging word above — it makes a real difference.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => (
            <Card
              key={msg.id}
              className="border-salsa-100 hover:border-salsa-200 transition-colors shadow-sm"
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <AvatarFallback name={msg.authorName} src={msg.authorAvatar} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{msg.authorName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeDate(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 mt-1 leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {hasMore && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="border-salsa-300 text-salsa-700 hover:bg-salsa-50"
              >
                {loadingMore ? 'Loading...' : 'Load More Messages'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
