'use client'

import { useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { MessageCircle, Loader2, Reply } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface CommentItem {
  id: string
  body: string
  createdAt: string
  user: { name: string | null }
  parentId: string | null
  replies?: CommentItem[]
}

interface CommentsSectionProps {
  postSlug: string
  initialComments: CommentItem[]
}

export function CommentsSection({ postSlug, initialComments }: CommentsSectionProps) {
  const { data: session } = useSession()
  const [comments, setComments] = useState<CommentItem[]>(initialComments)
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(parentId: string | null, text: string) {
    if (text.trim().length < 2) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/heat-index/posts/${postSlug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, parentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not post comment')
      toast.success('Thanks — your comment is in moderation.')
      if (parentId) {
        setReplyTo(null)
        setReplyBody('')
      } else {
        setBody('')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not post comment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="comments" className="mt-16">
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle className="w-5 h-5 text-salsa-600" />
        <h2 className="font-serif font-bold text-2xl text-foreground">
          Conversation ({comments.length})
        </h2>
      </div>

      {session ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit(null, body)
          }}
          className="mb-10 rounded-2xl border border-border bg-card p-5"
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share a thought, a recipe variation, or a memory…"
            rows={3}
            maxLength={2000}
            className="mb-3 resize-none"
            disabled={submitting}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Comments are reviewed before they appear.
            </span>
            <Button
              type="submit"
              disabled={submitting || body.trim().length < 2}
              className="bg-salsa-600 hover:bg-salsa-700 text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Post comment
            </Button>
          </div>
        </form>
      ) : (
        <div className="mb-10 rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
          <p className="text-muted-foreground mb-3">Sign in to join the conversation.</p>
          <Button onClick={() => signIn()} variant="outline">
            Sign in
          </Button>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Be the first to comment.</p>
      ) : (
        <ul className="space-y-6">
          {comments.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-semibold text-foreground">{c.user.name ?? 'Guest'}</span>
                <time
                  dateTime={c.createdAt}
                  className="text-xs text-muted-foreground"
                >
                  {new Date(c.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </time>
              </div>
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{c.body}</p>

              {session && (
                <button
                  type="button"
                  onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-salsa-600 hover:text-salsa-700"
                >
                  <Reply className="w-3 h-3" />
                  {replyTo === c.id ? 'Cancel' : 'Reply'}
                </button>
              )}

              {replyTo === c.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void submit(c.id, replyBody)
                  }}
                  className="mt-3"
                >
                  <Textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={2}
                    placeholder="Reply…"
                    maxLength={2000}
                    className="mb-2 resize-none"
                    disabled={submitting}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting || replyBody.trim().length < 2}
                  >
                    Post reply
                  </Button>
                </form>
              )}

              {c.replies && c.replies.length > 0 && (
                <ul className="mt-4 space-y-3 border-l-2 border-salsa-200 dark:border-salsa-900 pl-4">
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="font-semibold text-sm text-foreground">
                          {r.user.name ?? 'Guest'}
                        </span>
                        <time
                          dateTime={r.createdAt}
                          className="text-xs text-muted-foreground"
                        >
                          {new Date(r.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </time>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {r.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
