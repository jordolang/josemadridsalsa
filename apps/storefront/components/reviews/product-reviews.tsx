'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, MessageSquarePlus, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StarRatingDisplay, StarRatingInput } from './star-rating-input'

type PublicReview = {
  id: string
  rating: number
  title: string | null
  comment: string | null
  isVerified: boolean
  createdAt: string
  authorName: string
}

type FetchResponse = {
  reviews: PublicReview[]
  averageRating: number
  totalReviews: number
}

type Props = {
  productId: string
  productName: string
  initialAverageRating?: number
  initialReviewCount?: number
  isSignedIn?: boolean
  signInHref?: string
}

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function ProductReviews({
  productId,
  productName,
  initialAverageRating = 0,
  initialReviewCount = 0,
  isSignedIn = false,
  signInHref = '/auth/signin',
}: Props) {
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [average, setAverage] = useState<number>(initialAverageRating)
  const [total, setTotal] = useState<number>(initialReviewCount)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch(`/api/reviews/products/${productId}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to load reviews')
        const data = (await response.json()) as FetchResponse
        if (!cancelled) {
          setReviews(data.reviews)
          setAverage(data.averageRating)
          setTotal(data.totalReviews)
        }
      } catch {
        // keep initial values
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [productId])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (rating < 1) {
      setError('Please select a star rating.')
      return
    }
    setStatus('submitting')
    setError(null)
    try {
      const response = await fetch('/api/reviews/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          rating,
          title: title.trim() || undefined,
          comment: comment.trim() || undefined,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to submit review.')
      }
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unable to submit review.')
    }
  }

  return (
    <section aria-labelledby="reviews-heading" className="mt-12 border-t border-border pt-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="reviews-heading" className="text-2xl font-bold text-foreground">
            Customer Reviews
          </h2>
          <div className="mt-2 flex items-center gap-3">
            <StarRatingDisplay value={average} size="md" />
            <span className="text-sm text-muted-foreground">
              {total > 0 ? `${average.toFixed(1)} from ${total} review${total === 1 ? '' : 's'}` : 'No reviews yet'}
            </span>
          </div>
        </div>
        <Button
          onClick={() => setShowForm((prev) => !prev)}
          className="bg-salsa-600 hover:bg-salsa-700"
          aria-expanded={showForm}
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          {showForm ? 'Hide review form' : 'Write a review'}
        </Button>
      </div>

      {showForm ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          {!isSignedIn ? (
            <div className="text-sm">
              <p className="mb-3 text-muted-foreground">
                Sign in to leave a verified review for <span className="font-medium text-foreground">{productName}</span>.
              </p>
              <Button asChild variant="outline">
                <Link href={signInHref}>Sign in to review</Link>
              </Button>
            </div>
          ) : status === 'success' ? (
            <div className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-foreground">Thanks — your review has been submitted.</p>
                <p className="text-muted-foreground">
                  It will appear here after a quick moderation check.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Your rating</label>
                <StarRatingInput
                  value={rating}
                  onChange={setRating}
                  size="lg"
                  disabled={status === 'submitting'}
                />
              </div>
              <div>
                <label htmlFor="pr-title" className="mb-1 block text-sm font-medium">
                  Title <span className="text-muted-foreground">(optional)</span>
                </label>
                <Input
                  id="pr-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={160}
                  disabled={status === 'submitting'}
                />
              </div>
              <div>
                <label htmlFor="pr-comment" className="mb-1 block text-sm font-medium">
                  Review
                </label>
                <Textarea
                  id="pr-comment"
                  rows={4}
                  maxLength={2000}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={`What did you think of ${productName}?`}
                  disabled={status === 'submitting'}
                />
              </div>
              {error ? (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                className="bg-salsa-600 hover:bg-salsa-700"
                disabled={status === 'submitting' || rating < 1}
              >
                {status === 'submitting' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Star className="mr-2 h-4 w-4 fill-amber-400 text-amber-400" />
                )}
                Submit review
              </Button>
            </form>
          )}
        </div>
      ) : null}

      <div className="mt-8 space-y-4">
        {loading && reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Be the first to review {productName}.
          </p>
        ) : (
          reviews.map((review) => (
            <article key={review.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <StarRatingDisplay value={review.rating} size="sm" />
                  <span className="text-sm font-medium text-foreground">{review.authorName}</span>
                  {review.isVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-950 dark:text-green-200">
                      <CheckCircle2 className="h-3 w-3" /> Verified buyer
                    </span>
                  ) : null}
                </div>
                <time className="text-xs text-muted-foreground" dateTime={review.createdAt}>
                  {new Date(review.createdAt).toLocaleDateString()}
                </time>
              </header>
              {review.title ? (
                <p className="mt-2 text-sm font-semibold text-foreground">{review.title}</p>
              ) : null}
              {review.comment ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{review.comment}</p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  )
}

export default ProductReviews
