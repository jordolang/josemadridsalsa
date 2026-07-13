'use client'

import { useMemo, useState } from 'react'
import { ExternalLink, Star } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ReviewsData } from '@/lib/server/google-data'

const googleBusinessUrl =
  process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL ??
  'https://g.page/jose-madrid-salsa/review'

const facebookUrl =
  process.env.NEXT_PUBLIC_FACEBOOK_URL ??
  'https://www.facebook.com/josemadridsalsa'

type Review = ReviewsData['reviews'][number]

interface AnimatedTestimonialsProps {
  /** Pre-fetched reviews data passed from the server component — NO client API call needed */
  reviewsData: ReviewsData
}

interface ReviewCardProps {
  review: Review
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function StarRating({ rating }: { rating: number }) {
  const rounded = Math.round(rating)
  return (
    <div
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`${rounded} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`h-4 w-4 ${
            i < rounded
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-muted text-muted-foreground/40'
          }`}
        />
      ))}
    </div>
  )
}

function stableReviewScore(review: Review): number {
  const input = `${review.authorName}:${review.text}:${review.rating}`
  let hash = 0

  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }

  return hash
}

function ReviewCard({ review }: ReviewCardProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const showPhoto = Boolean(review.profilePhotoUrl) && !imgFailed

  return (
    <Card className="flex h-full flex-col bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <CardContent className="flex flex-1 flex-col gap-4 p-6">
        {/* Avatar | First Name Last Name */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0 border border-border">
            {showPhoto && review.profilePhotoUrl ? (
              <AvatarImage
                src={review.profilePhotoUrl}
                alt={review.authorName}
                onError={() => setImgFailed(true)}
              />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-salsa-500 to-chile-600 text-xs font-semibold text-white">
              {getInitials(review.authorName) || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight text-foreground">
              {review.authorName}
            </p>
            {review.relativePublishTime ? (
              <p className="truncate text-xs text-muted-foreground">
                {review.relativePublishTime}
              </p>
            ) : null}
          </div>
        </div>

        {/* Stars */}
        <StarRating rating={review.rating} />

        {/* Testimonial / review */}
        <p className="text-sm leading-relaxed text-foreground/90">
          &ldquo;{review.text}&rdquo;
        </p>
      </CardContent>
    </Card>
  )
}

function LeaveReviewCard() {
  return (
    <Card className="flex h-full flex-col border-dashed bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              aria-hidden="true"
              className="h-5 w-5 fill-yellow-400 text-yellow-400"
            />
          ))}
        </div>
        <p className="text-base font-semibold text-foreground">
          Share your experience
        </p>
        <p className="text-sm text-muted-foreground">
          Tried our salsa? Let the next customer know what you thought.
        </p>
        <Button asChild className="bg-salsa-600 hover:bg-salsa-700">
          <a href={googleBusinessUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Leave a Review
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

export function AnimatedTestimonials({ reviewsData }: AnimatedTestimonialsProps) {
  // Keep the review selection deterministic so server and client hydration match.
  const reviews = useMemo(
    () => [...reviewsData.reviews]
      .sort((a, b) => stableReviewScore(a) - stableReviewScore(b))
      .slice(0, 5),
    [reviewsData.reviews],
  )

  const { totalRating, totalReviews } = reviewsData

  if (reviews.length === 0) {
    return (
      <section className="bg-background py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-serif text-4xl font-bold text-foreground">
              What Our Customers Say
            </h2>
            <p className="mb-8 text-xl text-muted-foreground">
              No reviews available at this time.
            </p>
            <Button asChild className="bg-salsa-500 hover:bg-salsa-600">
              <a href={googleBusinessUrl} target="_blank" rel="noopener noreferrer">
                Leave a Review
              </a>
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative overflow-hidden bg-background py-20">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-serif text-4xl font-bold text-foreground">
            What Our Customers Say
          </h2>
          {totalRating > 0 && totalReviews > 0 ? (
            <div className="mb-2 flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      aria-hidden="true"
                      className={`h-6 w-6 ${
                        i < Math.round(totalRating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'fill-gray-300 text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-2xl font-bold text-foreground">
                  {totalRating.toFixed(1)}
                </span>
              </div>
              <span className="text-lg text-muted-foreground">
                Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          ) : null}
        </div>

        {/* Card grid + leaning silhouette */}
        <div className="relative">
          {/* Decorative leaning cowboy silhouette (CC0 — OpenClipart / Firkin).
              Sits BEHIND the card grid (z-0) so she leans against the cards
              rather than covering them. Filter flips the black source fill:
              - light mode → white silhouette with dark drop-shadow
              - dark mode  → dark silhouette with bright glow */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/shared/leaning-silhouette.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -right-[1.25in] z-0 hidden h-full w-auto opacity-95 brightness-0 invert drop-shadow-[0_10px_22px_rgba(0,0,0,0.35)] lg:block dark:invert-0 dark:drop-shadow-[0_0_28px_rgba(255,255,255,0.55)]"
          />

          <div className="relative z-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 lg:pr-40 xl:grid-cols-3 xl:pr-48">
            {reviews.map((review, index) => (
              <ReviewCard key={`${review.authorName}-${index}`} review={review} />
            ))}
            <LeaveReviewCard />
          </div>
        </div>

        {/* CTA buttons */}
        <div className="mt-16 text-center">
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild className="bg-salsa-600 px-8 py-3 text-lg hover:bg-salsa-700">
              <a href={googleBusinessUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Write a Review
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-salsa-600 px-8 py-3 text-lg text-salsa-600 hover:bg-salsa-50 dark:hover:bg-salsa-900/20"
            >
              <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Follow on Facebook
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
