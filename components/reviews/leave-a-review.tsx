'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { StarRatingInput } from './star-rating-input'

type Variant = 'card' | 'inline' | 'compact'
type Status = 'idle' | 'submitting' | 'success' | 'error'

const GOOGLE_BUSINESS_URL =
  process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL ?? 'https://g.page/jose-madrid-salsa/review'

export type LeaveAReviewProps = {
  source?: string
  variant?: Variant
  title?: string
  description?: string
  triggerLabel?: string
  className?: string
}

export function LeaveAReview({
  source = 'footer',
  variant = 'card',
  title = 'Loved your salsa? Leave us a review.',
  description = 'Rate your experience and (optionally) share a comment. We capture it here, then send you to Google so it appears on our business page.',
  triggerLabel = 'Leave a review',
  className,
}: LeaveAReviewProps) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setRating(0)
    setComment('')
    setName('')
    setEmail('')
    setStatus('idle')
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (rating < 1) {
      setError('Please select at least one star.')
      return
    }
    setStatus('submitting')
    setError(null)

    try {
      const response = await fetch('/api/reviews/site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || undefined,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          source,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to submit review.')
      }
      setStatus('success')
      window.open(GOOGLE_BUSINESS_URL, '_blank', 'noopener,noreferrer')
      setTimeout(() => {
        setOpen(false)
        reset()
      }, 1500)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unable to submit review.')
    }
  }

  const trigger =
    variant === 'compact' ? (
      <Button variant="outline" size="sm" className={className}>
        <Star className="mr-2 h-4 w-4 fill-amber-400 text-amber-400" />
        {triggerLabel}
      </Button>
    ) : variant === 'inline' ? (
      <Button className={className}>
        <Star className="mr-2 h-4 w-4 fill-amber-400 text-amber-400" />
        {triggerLabel}
      </Button>
    ) : (
      <div
        className={`flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center shadow-sm sm:flex-row sm:items-center sm:justify-between sm:text-left ${className ?? ''}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">Takes about 15 seconds — posts straight to Google.</p>
          </div>
        </div>
        <Button className="bg-salsa-600 hover:bg-salsa-700">{triggerLabel}</Button>
      </div>
    )

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset() }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Your rating</label>
            <StarRatingInput
              value={rating}
              onChange={setRating}
              size="lg"
              disabled={status === 'submitting'}
            />
          </div>
          <div>
            <label htmlFor="lar-comment" className="mb-1 block text-sm font-medium">
              Comment <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="lar-comment"
              rows={3}
              maxLength={1000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="What did you love?"
              disabled={status === 'submitting'}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="lar-name" className="mb-1 block text-sm font-medium">
                Name <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="lar-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                autoComplete="name"
                disabled={status === 'submitting'}
              />
            </div>
            <div>
              <label htmlFor="lar-email" className="mb-1 block text-sm font-medium">
                Email <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="lar-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={200}
                autoComplete="email"
                disabled={status === 'submitting'}
              />
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          {status === 'success' ? (
            <p role="status" className="text-xs text-primary">
              Thank you! Opening Google so you can post the same review there.
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={status === 'submitting'}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-salsa-600 hover:bg-salsa-700"
              disabled={status === 'submitting' || rating < 1}
            >
              {status === 'submitting' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Submit & open Google
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default LeaveAReview
